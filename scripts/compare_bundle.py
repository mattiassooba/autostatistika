"""Compare a freshly published bundle with the previous one.

    python scripts/compare_bundle.py <previous bundle.json> <new bundle.json>

Prints "changed" or "unchanged" (generatedAt is ignored). Exits 1 when any
table lost rows: a rebuild from scratch must never publish less history than
before, e.g. after a failed download.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def tables(bundle: dict) -> dict[str, int]:
    counts: dict[str, int] = {}
    for key, value in bundle.items():
        if isinstance(value, list):
            counts[key] = len(value)
        elif isinstance(value, dict):
            counts.update({f"{key}.{sub}": len(rows) for sub, rows in value.items() if isinstance(rows, list)})
    return counts


def main() -> int:
    previous, current = (json.loads(Path(arg).read_text(encoding="utf-8")) for arg in sys.argv[1:3])
    before, after = tables(previous), tables(current)
    shrunk = {name: (count, after.get(name, 0)) for name, count in before.items() if after.get(name, 0) < count}
    for name, (old, new) in shrunk.items():
        print(f"{name}: {old} -> {new} rows", file=sys.stderr)
    previous.pop("generatedAt", None)
    current.pop("generatedAt", None)
    print("changed" if previous != current else "unchanged")
    return 1 if shrunk else 0


if __name__ == "__main__":
    raise SystemExit(main())
