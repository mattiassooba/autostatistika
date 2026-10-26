from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ingestion.config import PUBLISH_DIR, ensure_dirs
from ingestion.db import session
from ingestion.insights.detect import build_insights
from ingestion.seeds import seed


def publish_bundle(dest: Path | None = None) -> Path:
    ensure_dirs()
    out_dir = dest or PUBLISH_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    with session() as conn:
        seed(conn)
        _dedupe_views(conn)
        bundle = {
            "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "disclaimer": {
                "et": "Autostatistika ei ole Transpordiameti ega Eesti riigi ametlik teenus.",
                "en": "Autostatistika is not an official service of Transpordiamet or the Estonian government.",
            },
            "sources": [dict(row) for row in conn.execute("SELECT * FROM data_sources")],
            "coverage": _coverage(conn),
            "registrations": _registrations(conn),
            "fleet": _fleet(conn),
            "inspections": _inspections(conn),
        }
        bundle["insights"] = build_insights(bundle)
        path = out_dir / "bundle.json"
        path.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        return path


def _dedupe_views(conn) -> None:
    """Some months have several source files (a stock leaflet and a
    first-registration leaflet, re-uploads with "(1)" or "_0"). Every fact key
    is taken from exactly one file: the most recent upload (the /documents/YYYY-MM/
    folder in the official URL), then the longer, more specific file name.
    Publishing reads these views, never the raw tables, so files never add up."""
    conn.executescript(
        """
        DROP VIEW IF EXISTS temp.file_rank;
        DROP VIEW IF EXISTS temp.reg_facts;
        DROP VIEW IF EXISTS temp.fleet_facts;
        DROP VIEW IF EXISTS temp.insp_facts;
        CREATE TEMP VIEW file_rank AS
          SELECT sf.id AS file_id,
                 CASE WHEN instr(sr.source_url, '/documents/') > 0
                      THEN substr(sr.source_url, instr(sr.source_url, '/documents/') + 11, 7) ELSE '' END AS upload_month,
                 length(sr.source_url) AS url_length
          FROM source_files sf JOIN source_resources sr ON sr.id = sf.resource_id;
        CREATE TEMP VIEW reg_facts AS
          SELECT * FROM (
            SELECT f.*, ROW_NUMBER() OVER (
              PARTITION BY f.reporting_period, f.metric_code, IFNULL(f.category_code, ''), IFNULL(f.eu_category, ''),
                           IFNULL(f.brand_slug, ''), IFNULL(f.model_source, ''), IFNULL(f.fuel_code, ''),
                           IFNULL(f.vehicle_first_reg_year, -1), IFNULL(json_extract(f.extra_json, '$.rollup'), '')
              ORDER BY r.upload_month DESC, r.url_length DESC, f.id DESC) AS rn
            FROM registration_facts f JOIN file_rank r ON r.file_id = f.source_file_id
          ) WHERE rn = 1;
        CREATE TEMP VIEW fleet_facts AS
          SELECT * FROM (
            SELECT f.*, ROW_NUMBER() OVER (
              PARTITION BY f.snapshot_date, f.metric_code, IFNULL(f.category_code, ''), IFNULL(f.eu_category, ''),
                           IFNULL(f.brand_slug, ''), IFNULL(f.model_source, ''), IFNULL(f.fuel_code, ''),
                           IFNULL(f.region_code, ''), IFNULL(f.status_code, ''), IFNULL(f.age_band, ''),
                           IFNULL(f.manufacture_year, -1), IFNULL(json_extract(f.extra_json, '$.grain'), '')
              ORDER BY r.upload_month DESC, r.url_length DESC, f.id DESC) AS rn
            FROM vehicle_fleet_facts f JOIN file_rank r ON r.file_id = f.source_file_id
          ) WHERE rn = 1;
        CREATE TEMP VIEW insp_facts AS
          SELECT * FROM (
            SELECT f.*, ROW_NUMBER() OVER (
              PARTITION BY f.reporting_period, f.metric_code, f.population, IFNULL(f.station_code, ''), IFNULL(f.bureau_code, '')
              ORDER BY r.upload_month DESC, r.url_length DESC, f.id DESC) AS rn
            FROM inspection_facts f JOIN file_rank r ON r.file_id = f.source_file_id
          ) WHERE rn = 1;
        """
    )


def _coverage(conn) -> dict:
    rows = conn.execute(
        """
        SELECT reporting_period AS period, category_code, metric_code
        FROM reg_facts
        WHERE publication_status='published'
        UNION
        SELECT snapshot_date, category_code, metric_code FROM fleet_facts WHERE publication_status='published'
        UNION
        SELECT reporting_period, population, metric_code FROM insp_facts WHERE publication_status='published'
        """
    ).fetchall()
    return [dict(row) for row in rows]


def _registrations(conn) -> dict:
    totals = conn.execute(
        """
        SELECT reporting_period, category_code, metric_code, SUM(value) AS value
        FROM reg_facts
        WHERE publication_status='published'
          AND brand_slug IS NULL
          AND fuel_code IS NULL
          AND model_source IS NULL
        GROUP BY 1,2,3
        ORDER BY 1
        """
    ).fetchall()
    brands = conn.execute(
        """
        SELECT reporting_period, category_code, brand_slug, MAX(brand_source) AS brand_source, SUM(value) AS value
        FROM reg_facts
        WHERE publication_status='published'
          AND metric_code='first_registrations'
          AND brand_slug IS NOT NULL
          AND vehicle_first_reg_year IS NULL
          AND extra_json LIKE '%brand_month_total%'
        GROUP BY 1,2,3
        """
    ).fetchall()
    fuels = conn.execute(
        """
        SELECT reporting_period, category_code, fuel_code, GROUP_CONCAT(DISTINCT fuel_source) AS fuel_source, metric_code,
               SUM(value) AS value
        FROM reg_facts
        WHERE publication_status='published' AND fuel_code IS NOT NULL AND brand_slug IS NULL
        GROUP BY 1,2,3,5
        """
    ).fetchall()
    models = conn.execute(
        """
        SELECT reporting_period, category_code, brand_slug, MAX(brand_source) AS brand_source, model_source,
               SUM(value) AS value
        FROM reg_facts
        WHERE publication_status='published' AND metric_code='new_vehicles' AND model_source IS NOT NULL
        GROUP BY 1,2,3,5
        """
    ).fetchall()
    return {
        "totals": [dict(r) for r in totals],
        "brands": [dict(r) for r in brands],
        "fuels": [dict(r) for r in fuels],
        "models": [dict(r) for r in models],
    }


def _fleet(conn) -> dict:
    """Fleet stocks by grain. Nothing here is summed across grains or dates.

    * stock_total: the family total stated by the source (Infoleht age sheet).
    * complete brand splits (bus register files, grain vehicle/brand): the
      stock is their sum when no stated total exists for that date.
    * brand_top: the source's "most registered" list. Published as a top list
      with ``complete: false``; never summed into a stock."""
    from ingestion.validation.plausibility import is_plausible_stock

    grain = "json_extract(extra_json, '$.grain')"
    stated_rows = conn.execute(
        f"""
        SELECT snapshot_date, category_code, SUM(value) AS value,
               MAX(json_extract(extra_json, '$.status_scope')) AS scope
        FROM fleet_facts
        WHERE publication_status='published' AND {grain}='stock_total'
        GROUP BY 1,2
        """
    ).fetchall()
    stated = {(r["snapshot_date"], r["category_code"]): r["value"] for r in stated_rows}
    scopes = {(r["snapshot_date"], r["category_code"]): r["scope"] for r in stated_rows}
    registered_only = {
        (r["snapshot_date"], r["category_code"]): r["value"]
        for r in conn.execute(
            f"""
            SELECT snapshot_date, category_code, SUM(value) AS value
            FROM fleet_facts
            WHERE publication_status='published' AND {grain}='stock_registered'
            GROUP BY 1,2
            """
        )
    }
    complete_rows = conn.execute(
        f"""
        SELECT snapshot_date, category_code, status_code, SUM(value) AS value
        FROM fleet_facts
        WHERE publication_status='published' AND {grain} IN ('vehicle','brand')
        GROUP BY 1,2,3
        """
    ).fetchall()
    # A stated total that includes suspended records is published as such
    # ("mixed"); when the source also states the registered-only count, the
    # total splits into registered + suspended (the difference).
    snapshot_rows = []
    for (d, c), v in stated.items():
        registered = registered_only.get((d, c))
        if registered is not None and registered <= v:
            snapshot_rows.append({"snapshot_date": d, "category_code": c, "status_code": "registered", "value": registered})
            snapshot_rows.append({"snapshot_date": d, "category_code": c, "status_code": "suspended", "value": v - registered})
        else:
            status = "mixed" if scopes.get((d, c)) == "includes_suspended" else None
            snapshot_rows.append({"snapshot_date": d, "category_code": c, "status_code": status, "value": v})
    for row in complete_rows:
        if (row["snapshot_date"], row["category_code"]) in stated:
            continue
        snapshot_rows.append(dict(row))
    snapshot_rows = [r for r in snapshot_rows if is_plausible_stock(r["category_code"], r["value"])]
    snapshot_rows.sort(key=lambda r: (r["snapshot_date"], r["category_code"] or "", r["status_code"] or ""))
    allowed = {(row["snapshot_date"], row["category_code"]) for row in snapshot_rows}

    brands = [
        {**dict(r), "complete": r["grain"] != "brand_top"}
        for r in conn.execute(
            f"""
            SELECT snapshot_date, category_code, brand_slug, MAX(brand_source) AS brand_source, SUM(value) AS value,
                   {grain} AS grain
            FROM fleet_facts
            WHERE publication_status='published' AND brand_slug IS NOT NULL
              AND {grain} IN ('vehicle','brand','brand_top')
            GROUP BY 1,2,3,6
            """
        ).fetchall()
        if (r["snapshot_date"], r["category_code"]) in allowed
    ]
    for item in brands:
        item.pop("grain", None)

    def by_grain(name: str, column: str) -> list[dict]:
        rows = [
            dict(r)
            for r in conn.execute(
                f"""
                SELECT snapshot_date, category_code, {column}, SUM(value) AS value
                FROM fleet_facts
                WHERE publication_status='published' AND {grain}='{name}'
                GROUP BY 1,2,3
                """
            ).fetchall()
        ]
        totals: dict[tuple, float] = {}
        for item in rows:
            key = (item["snapshot_date"], item["category_code"])
            totals[key] = totals.get(key, 0) + item["value"]
        return [item for item in rows if is_plausible_stock(item["category_code"], totals[(item["snapshot_date"], item["category_code"])])]

    regions = by_grain("region", "region_code, MAX(region_source) AS region_source")
    ages = by_grain("age", "age_band")
    # Which snapshot dates come from the open register files, and which of
    # those were queried retroactively (the 2020-2023 zip, see its README).
    sources = [
        {"snapshot_date": r["snapshot_date"], "source": "register", "retroactive": bool(r["retroactive"])}
        for r in conn.execute(
            """
            SELECT snapshot_date, MAX(IFNULL(json_extract(extra_json, '$.retroactive'), 0)) AS retroactive
            FROM fleet_facts
            WHERE publication_status='published' AND json_extract(extra_json, '$.source')='register'
            GROUP BY 1 ORDER BY 1
            """
        ).fetchall()
        if any(row["snapshot_date"] == r["snapshot_date"] for row in snapshot_rows)
    ]
    return {
        "snapshots": snapshot_rows,
        "brands": brands,
        "regions": regions,
        "ages": ages,
        "sources": sources,
    }


def _inspections(conn) -> dict:
    national = conn.execute(
        """
        SELECT reporting_period, population, metric_code, SUM(value) AS value
        FROM insp_facts
        WHERE publication_status='published' AND station_code IS NULL
        GROUP BY 1,2,3
        ORDER BY 1
        """
    ).fetchall()
    stations = conn.execute(
        """
        SELECT reporting_period, population, station_code, station_name, metric_code, value
        FROM insp_facts
        WHERE publication_status='published' AND station_code IS NOT NULL
        ORDER BY 1, 2, 3
        """
    ).fetchall()
    return {
        "national": [dict(r) for r in national],
        "stations": [dict(r) for r in stations],
    }
