"""Import every file listed in data/downloads/manifest.json (written by
fetch_backfill.py), then publish the bundle.

    python scripts/run_backfill.py [--kinds registration_infoleht inspection_monthly] [--no-publish]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR  # noqa: E402
from ingestion.discovery.transpordiamet import DiscoveredResource  # noqa: E402
from ingestion.pipeline import import_resource  # noqa: E402
from ingestion.publishing.publish import publish_bundle  # noqa: E402

FIELDS = ("source_id", "source_url", "title", "resource_kind", "reporting_period", "snapshot_date", "layout_hint")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kinds", nargs="+", default=["registration_infoleht", "inspection_monthly"])
    parser.add_argument("--no-publish", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((DOWNLOAD_DIR / "manifest.json").read_text(encoding="utf-8"))
    entries = [e for e in manifest if e["resource_kind"] in args.kinds and Path(e["local_path"]).exists()]
    entries.sort(key=lambda e: (e["resource_kind"], e.get("reporting_period") or "", e["source_url"]))
    results = []
    started = time.time()
    for index, entry in enumerate(entries, 1):
        resource = DiscoveredResource(**{key: entry.get(key) for key in FIELDS})
        result = import_resource(resource, Path(entry["local_path"]))
        result["file"] = Path(entry["local_path"]).name
        results.append(result)
        detail = result.get("records") or result.get("reason") or result.get("error") or result.get("errors")
        print(f"[{index}/{len(entries)}] {result['status']:<11} {entry.get('reporting_period')} {result['file'][:50]} {str(detail)[:90]}", flush=True)
    counts = Counter(r["status"] for r in results)
    print(f"done in {time.time() - started:.0f}s: {dict(counts)}", flush=True)
    (DOWNLOAD_DIR / "backfill-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    if not args.no_publish:
        print("published", publish_bundle(), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
