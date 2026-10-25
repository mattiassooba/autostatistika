from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ingestion.config import SAMPLE_DIR
from ingestion.db import session
from ingestion.discovery.transpordiamet import DiscoveredResource, discover_transpordiamet
from ingestion.download.fetch import archive_resource
from ingestion.parsers.registrations import PartialPeriodError
from ingestion.parsers.router import parse_workbook
from ingestion.seeds import seed
from ingestion.validation.checks import validate_facts


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def discover(conn=None) -> list[DiscoveredResource]:
    resources = discover_transpordiamet()
    closer = False
    if conn is None:
        from ingestion.db import session as db_session

        ctx = db_session()
        conn = ctx.__enter__()
        seed(conn)
        closer = True
    try:
        for resource in resources:
            conn.execute(
                """
                INSERT OR IGNORE INTO source_resources
                (id, source_id, source_url, title, reporting_period, snapshot_date, resource_kind, layout_hint, discovered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid5(uuid.NAMESPACE_URL, resource.source_url)),
                    resource.source_id,
                    resource.source_url,
                    resource.title,
                    resource.reporting_period,
                    resource.snapshot_date,
                    resource.resource_kind,
                    resource.layout_hint,
                    utcnow(),
                ),
            )
        conn.commit()
    finally:
        if closer:
            ctx.__exit__(None, None, None)
    return resources


def import_resource(resource: DiscoveredResource, local_path: Path | None = None) -> dict:
    with session() as conn:
        seed(conn)
        run_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO import_runs(id, source_id, command, status, started_at) VALUES (?,?,?,?,?)",
            (run_id, resource.source_id, "import", "running", utcnow()),
        )
        try:
            archived = None
            if local_path is None:
                archived = archive_resource(resource)
                path = archived.local_path
            else:
                path = local_path
            resource_id = str(uuid.uuid5(uuid.NAMESPACE_URL, resource.source_url))
            conn.execute(
                """
                INSERT OR IGNORE INTO source_resources
                (id, source_id, source_url, title, reporting_period, snapshot_date, resource_kind, layout_hint, discovered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resource_id,
                    resource.source_id,
                    resource.source_url,
                    resource.title,
                    resource.reporting_period,
                    resource.snapshot_date,
                    resource.resource_kind,
                    resource.layout_hint,
                    utcnow(),
                ),
            )
            sha = _sha256(path)
            file_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{resource.source_url}:{sha}"))
            conn.execute(
                """
                INSERT OR IGNORE INTO source_files(id, resource_id, local_path, sha256, byte_size, retrieved_at, content_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, resource_id, str(path), sha, path.stat().st_size, utcnow(), None),
            )
            facts = parse_workbook(path, resource)
            checks = validate_facts(facts, _kind(resource))
            blocking = [c for c in checks if c.severity == "error" and not c.passed]
            for check in checks:
                conn.execute(
                    "INSERT INTO data_quality_checks(run_id, check_code, severity, passed, details) VALUES (?,?,?,?,?)",
                    (run_id, check.code, check.severity, int(check.passed), check.details),
                )
            if blocking:
                conn.execute(
                    "UPDATE import_runs SET status='quarantined', finished_at=?, error_summary=?, file_id=? WHERE id=?",
                    (utcnow(), "; ".join(c.details for c in blocking), file_id, run_id),
                )
                return {"status": "quarantined", "run_id": run_id, "errors": [c.details for c in blocking]}
            # Re-importing a file replaces everything it produced before, so a
            # parser fix never leaves stale rows from the previous parse.
            for table in ("registration_facts", "vehicle_fleet_facts", "inspection_facts"):
                conn.execute(f"DELETE FROM {table} WHERE source_file_id=?", (file_id,))
            inserted = _store_facts(conn, facts, file_id, run_id)
            conn.execute(
                "UPDATE import_runs SET status='published', finished_at=?, records_staged=?, records_published=?, file_id=? WHERE id=?",
                (utcnow(), inserted, inserted, file_id, run_id),
            )
            conn.execute(
                """
                INSERT INTO ingestion_heartbeat(source_id, last_success_at, last_attempt_at, last_status, latest_period)
                VALUES (?, ?, ?, 'published', ?)
                ON CONFLICT(source_id) DO UPDATE SET
                  last_success_at=excluded.last_success_at,
                  last_attempt_at=excluded.last_attempt_at,
                  last_status='published',
                  latest_period=excluded.latest_period
                """,
                (resource.source_id, utcnow(), utcnow(), resource.reporting_period or resource.snapshot_date),
            )
            return {"status": "published", "run_id": run_id, "records": inserted, "path": str(path)}
        except PartialPeriodError as exc:
            conn.execute(
                "UPDATE import_runs SET status='quarantined', finished_at=?, error_summary=? WHERE id=?",
                (utcnow(), f"skipped: {exc}", run_id),
            )
            return {"status": "skipped", "run_id": run_id, "reason": str(exc)}
        except Exception as exc:  # noqa: BLE001
            conn.execute(
                "UPDATE import_runs SET status='failed', finished_at=?, error_summary=? WHERE id=?",
                (utcnow(), str(exc), run_id),
            )
            conn.execute(
                "INSERT INTO import_errors(run_id, severity, code, message, context_json) VALUES (?,?,?,?,?)",
                (run_id, "error", "import_failed", str(exc), json.dumps({"url": resource.source_url})),
            )
            return {"status": "failed", "run_id": run_id, "error": str(exc)}


def import_local_samples() -> list[dict]:
    samples = {
        "INFOLEHT-092026.xlsx": DiscoveredResource(
            "ta-infoleht",
            "https://www.transpordiamet.ee/sites/default/files/documents/2026-10/INFOLEHT-092026.xlsx",
            "Infoleht 09-2026",
            "registration_infoleht",
            "2026-09",
            None,
            "modern_v1",
        ),
        "INFOLEHT-112025.xls": DiscoveredResource(
            "ta-infoleht",
            "https://www.transpordiamet.ee/sites/default/files/documents/2025-12/INFOLEHT-112025.xls",
            "Infoleht 11-2025",
            "registration_infoleht",
            "2025-11",
            None,
            "modern_v1",
        ),
        "infoleht01-10.xls": DiscoveredResource(
            "ta-infoleht",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-11/infoleht01-10.xls",
            "INFOLEHT 01-10",
            "registration_infoleht",
            "2010-01",
            "2010-02-01",
            "legacy_2010",
        ),
        "infoleht01-06.xls": DiscoveredResource(
            "ta-infoleht",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-11/infoleht01-06.xls",
            "INFOLEHT 01-06",
            "registration_infoleht",
            "2006-01",
            "2006-02-01",
            "legacy_2006",
        ),
        "kuuaruanne_2019_04.xls": DiscoveredResource(
            "ta-inspections-xls",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-02/kuuaruanne_2019_04.xls",
            "aprilli kuuaruanne 2019",
            "inspection_monthly",
            "2019-04",
            None,
            "inspection_xls",
        ),
        "kuuaruanne_2010_01.xls": DiscoveredResource(
            "ta-inspections-xls",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-02/kuuaruanne_2010_01.xls",
            "jaanuari kuuaruanne 2010",
            "inspection_monthly",
            "2010-01",
            None,
            "inspection_xls",
        ),
        "bussid-311220.xlsx": DiscoveredResource(
            "ta-fleet-archive",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-11/bussid-311220.xlsx",
            "Arvel olevad bussid seisuga 31.12.2020",
            "fleet_snapshot",
            None,
            "2020-12-31",
            "fleet_workbook",
        ),
        "bussid-31122010.xls": DiscoveredResource(
            "ta-fleet-archive",
            "https://www.transpordiamet.ee/sites/default/files/documents/2021-11/arvel_olevad_bussid_seisuga_31.12.2010.xls",
            "Arvel olevad bussid seisuga 31.12.2010",
            "fleet_snapshot",
            None,
            "2010-12-31",
            "fleet_workbook",
        ),
    }
    results = []
    for name, resource in samples.items():
        path = SAMPLE_DIR / name
        if not path.exists():
            results.append({"status": "skipped", "file": name})
            continue
        results.append(import_resource(resource, path))
    return results


UNIQUE_KEYS = {
    "registration_facts": (
        "reporting_period", "metric_code", "category_code", "eu_category", "brand_slug",
        "model_source", "fuel_code", "vehicle_first_reg_year",
    ),
    "vehicle_fleet_facts": (
        "snapshot_date", "metric_code", "category_code", "eu_category", "brand_slug", "model_source",
        "fuel_code", "region_code", "status_code", "age_band", "manufacture_year",
    ),
    "inspection_facts": ("reporting_period", "metric_code", "population", "station_code", "bureau_code"),
}


def merge_duplicate_facts(facts):
    """Sum facts that land on the same unique key.

    Several source rows can normalise to one key: CNG and LPG both map to
    fuel ``gas``; "VOLKSWAGEN" and "VOLKSWAGEN, VW" both map to volkswagen; a
    model listed once per body type. ``INSERT OR REPLACE`` would keep only the
    last row and silently undercount, so the rows are added together and the
    merge is recorded on the fact."""
    merged: dict[tuple, object] = {}
    order: list[tuple] = []
    for fact in facts:
        key = (fact.table, *(getattr(fact, name) for name in UNIQUE_KEYS[fact.table]))
        existing = merged.get(key)
        if existing is None:
            merged[key] = fact
            order.append(key)
            continue
        existing.value += fact.value
        existing.extra = {**existing.extra, "merged_rows": existing.extra.get("merged_rows", 1) + 1}
        sources = {existing.fuel_source, fact.fuel_source} - {None}
        if sources:
            existing.fuel_source = " + ".join(sorted(sources))
    return [merged[key] for key in order]


def _store_facts(conn, facts, file_id: str, run_id: str) -> int:
    inserted = 0
    facts = merge_duplicate_facts(facts)
    for fact in facts:
        extra = json.dumps(fact.extra, ensure_ascii=True) if fact.extra else None
        if fact.category_code:
            conn.execute(
                "INSERT OR IGNORE INTO vehicle_categories(code, label_et, label_en, eu_codes) VALUES (?,?,?,?)",
                (fact.category_code, fact.category_code, fact.category_code, ""),
            )
        if fact.table == "registration_facts":
            conn.execute(
                """
                INSERT OR REPLACE INTO registration_facts(
                  source_file_id, import_run_id, reporting_period, metric_code, category_code, eu_category,
                  brand_slug, brand_source, model_source, fuel_code, fuel_source, vehicle_first_reg_year,
                  value, unit, publication_status, extra_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?)
                """,
                (
                    file_id,
                    run_id,
                    fact.reporting_period,
                    fact.metric_code,
                    fact.category_code,
                    fact.eu_category,
                    fact.brand_slug,
                    fact.brand_source,
                    fact.model_source,
                    fact.fuel_code,
                    fact.fuel_source,
                    fact.vehicle_first_reg_year,
                    fact.value,
                    fact.unit,
                    extra,
                ),
            )
            inserted += 1
        elif fact.table == "vehicle_fleet_facts":
            if fact.region_code:
                conn.execute(
                    "INSERT OR IGNORE INTO regions(code, label_et, label_en) VALUES (?,?,?)",
                    (fact.region_code, fact.region_source or fact.region_code, fact.region_source or fact.region_code),
                )
            conn.execute(
                """
                INSERT OR REPLACE INTO vehicle_fleet_facts(
                  source_file_id, import_run_id, snapshot_date, metric_code, category_code, eu_category,
                  brand_slug, brand_source, model_source, fuel_code, region_code, region_source, status_code,
                  age_band, manufacture_year, value, unit, publication_status, extra_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?)
                """,
                (
                    file_id,
                    run_id,
                    fact.snapshot_date,
                    fact.metric_code,
                    fact.category_code,
                    fact.eu_category,
                    fact.brand_slug,
                    fact.brand_source,
                    fact.model_source,
                    fact.fuel_code,
                    fact.region_code,
                    fact.region_source,
                    fact.status_code,
                    fact.age_band,
                    fact.manufacture_year,
                    fact.value,
                    fact.unit,
                    extra,
                ),
            )
            inserted += 1
        elif fact.table == "inspection_facts":
            conn.execute(
                """
                INSERT OR REPLACE INTO inspection_facts(
                  source_file_id, import_run_id, reporting_period, metric_code, population,
                  station_code, station_name, bureau_code, value, unit, publication_status, extra_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?)
                """,
                (
                    file_id,
                    run_id,
                    fact.reporting_period,
                    fact.metric_code,
                    fact.population,
                    fact.station_code,
                    fact.station_name,
                    fact.bureau_code,
                    fact.value,
                    fact.unit,
                    extra,
                ),
            )
            inserted += 1
    return inserted


def _sha256(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _kind(resource: DiscoveredResource) -> str:
    if resource.resource_kind == "inspection_monthly":
        return "inspections"
    if resource.resource_kind == "fleet_snapshot":
        return "vehicle_fleet"
    return "registrations"
