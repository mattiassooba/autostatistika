"""Download every Infoleht and inspection monthly linked from the official
Transpordiamet pages into data/downloads/<kind>/, skipping files already on
disk. Polite: one request per REQUEST_GAP_SECONDS, trusted hosts only.

    python scripts/fetch_backfill.py [--kinds registration_infoleht inspection_monthly]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR  # noqa: E402
from ingestion.discovery.transpordiamet import discover_transpordiamet  # noqa: E402
from ingestion.download.fetch import archive_resource  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kinds", nargs="+", default=["registration_infoleht", "inspection_monthly"])
    args = parser.parse_args()
    resources = [r for r in discover_transpordiamet() if r.resource_kind in args.kinds]
    manifest = []
    print(f"{len(resources)} resources", flush=True)
    for index, resource in enumerate(resources, 1):
        target = DOWNLOAD_DIR / resource.resource_kind
        name = unquote(Path(urlparse(resource.source_url).path).name)
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
    (DOWNLOAD_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
