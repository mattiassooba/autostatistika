from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ingestion.config import SAMPLE_DIR
from ingestion.db import session
from ingestion.discovery.transpordiamet import DiscoveredResource
from ingestion.pipeline import discover, import_local_samples, import_resource
from ingestion.publishing.publish import publish_bundle
from ingestion.seeds import seed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingestion")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("discover")
    backfill = sub.add_parser("backfill")
    backfill.add_argument("--source", choices=["registrations", "vehicle_fleet", "inspections", "samples"], default="samples")
    backfill.add_argument("--limit", type=int, default=24)
    update = sub.add_parser("update")
    update.add_argument("--all", action="store_true")
    sub.add_parser("validate").add_argument("--all", action="store_true")
    sub.add_parser("status")
    sub.add_parser("publish")
    sub.add_parser("insights")

    args = parser.parse_args(argv)
    if args.command == "discover":
        resources = discover()
        print(json.dumps([resource.__dict__ for resource in resources], ensure_ascii=False, indent=2))
        print(f"discovered {len(resources)} resources", file=sys.stderr)
        return 0
    if args.command == "backfill":
        if args.source == "samples":
            results = import_local_samples()
        else:
            results = _backfill(args.source, args.limit)
        print(json.dumps(results, ensure_ascii=False, indent=2))
        publish_bundle()
        return 0 if all(r.get("status") in {"published", "skipped"} for r in results) else 1
    if args.command == "update":
        results = _update_recent()
        print(json.dumps(results, ensure_ascii=False, indent=2))
        publish_bundle()
        return 0
    if args.command == "validate":
        with session() as conn:
            seed(conn)
            runs = [dict(r) for r in conn.execute("SELECT status, COUNT(*) c FROM import_runs GROUP BY status")]
            print(json.dumps(runs, indent=2))
        return 0
    if args.command == "status":
        with session() as conn:
            seed(conn)
            rows = [dict(r) for r in conn.execute("SELECT * FROM ingestion_heartbeat")]
            print(json.dumps(rows, indent=2))
        return 0
    if args.command in {"publish", "insights"}:
        path = publish_bundle()
        print(path)
        return 0
    return 1


def _backfill(source: str, limit: int) -> list[dict]:
    resources = discover()
    wanted = {
        "registrations": "registration_infoleht",
        "vehicle_fleet": "fleet_snapshot",
        "inspections": "inspection_monthly",
    }[source]
    selected = [r for r in resources if r.resource_kind == wanted][:limit]
    return [import_resource(resource) for resource in selected]


def _update_recent() -> list[dict]:
    resources = discover()
    latest: dict[str, DiscoveredResource] = {}
    for resource in resources:
        key = resource.source_id
        current = latest.get(key)
        marker = resource.reporting_period or resource.snapshot_date or ""
        if current is None or marker > (current.reporting_period or current.snapshot_date or ""):
            latest[key] = resource
    return [import_resource(resource) for resource in latest.values()]


if __name__ == "__main__":
    raise SystemExit(main())
