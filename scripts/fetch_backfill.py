"""Download every Infoleht and inspection monthly linked from the official
Transpordiamet pages, and the register snapshots listed in the open-data
catalogue, into data/downloads/<kind>/, skipping files already on disk.
Polite: one request per REQUEST_GAP_SECONDS, trusted hosts only.

    python scripts/fetch_backfill.py [--kinds registration_infoleht inspection_monthly register_snapshot]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR  # noqa: E402
from ingestion.discovery.opendata import DATASET_PAGE, discover_register, local_name  # noqa: E402
from ingestion.discovery.transpordiamet import discover_transpordiamet  # noqa: E402
from ingestion.download.fetch import archive_resource  # noqa: E402
from ingestion.parsers.register import register_members  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kinds", nargs="+", default=["registration_infoleht", "inspection_monthly", "register_snapshot"])
    args = parser.parse_args()
    discovered = discover_transpordiamet()
    if "register_snapshot" in args.kinds:
        discovered += discover_register()
    resources = [r for r in discovered if r.resource_kind in args.kinds]
    manifest = []
    print(f"{len(resources)} resources", flush=True)
    for index, resource in enumerate(resources, 1):
        target = DOWNLOAD_DIR / resource.resource_kind
        name = local_name(resource) if resource.resource_kind == "register_snapshot" else unquote(Path(urlparse(resource.source_url).path).name)
        local = target / name
        status = "cached"
        if not local.exists():
            try:
                archived = archive_resource(resource, target)
                if archived.local_path != local:
                    archived.local_path.replace(local)
                status = "downloaded"
            except Exception as exc:  # noqa: BLE001
                status = f"error: {exc}"
        manifest.append({**resource.__dict__, "local_path": str(local), "status": status})
        print(f"[{index}/{len(resources)}] {status} {resource.reporting_period or resource.snapshot_date} {name}", flush=True)
    if "register_snapshot" in args.kinds:
        manifest += kept_register_files(manifest)
    (DOWNLOAD_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


def kept_register_files(manifest: list[dict]) -> list[dict]:
    """The catalogue replaces the monthly register file every month. Files on
    disk that it no longer lists stay in the manifest, so a rebuild never loses
    a snapshot (scripts/register_archive.py restores them on a cache miss)."""
    listed = {Path(entry["local_path"]).name for entry in manifest}
    previous_path = DOWNLOAD_DIR / "manifest.json"
    previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path.exists() else []
    urls = {Path(entry["local_path"]).name: entry["source_url"] for entry in previous if entry["resource_kind"] == "register_snapshot"}
    kept = []
    for path in sorted((DOWNLOAD_DIR / "register_snapshot").glob("ar_*")):
        members = register_members(path) if path.suffix in {".csv", ".zip"} else []
        if path.name in listed or not members:
            continue
        snapshots = sorted({snapshot for snapshot, _ in members})
        kept.append({
            "source_id": "ta-register-opendata",
            "source_url": urls.get(path.name, f"{DATASET_PAGE}#{path.name}"),
            "title": path.name,
            "resource_kind": "register_snapshot",
            "reporting_period": None,
            "snapshot_date": snapshots[0] if len(snapshots) == 1 else None,
            "layout_hint": "register_zip_retroactive" if path.suffix == ".zip" else "register_csv",
            "local_path": str(path),
            "status": "kept (no longer listed)",
        })
        print(f"kept {path.name} (no longer listed in the catalogue)", flush=True)
    return kept


if __name__ == "__main__":
    raise SystemExit(main())
