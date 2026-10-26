"""Search files for /otsing, built from the latest register snapshot.

    python scripts/register_index.py build     # data/register-index/<date>/ + index.json
    python scripts/register_index.py upload    # tar it into the "register-index" release (skips if present)
    python scripts/register_index.py install   # copy it into apps/web/public/register/<date>/ for a local build

The bundle records the asset name and checksum (ingestion/publishing/publish.py),
and the deploy workflow downloads exactly that asset. The files are not committed.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR, REGISTER_INDEX_DIR, ROOT  # noqa: E402
from ingestion.parsers.register import register_members  # noqa: E402
from ingestion.publishing.register_index import build_index  # noqa: E402

TAG = "register-index"
WEB_DIR = ROOT / "apps" / "web" / "public" / "register"
NOTES = (
    "Search files for autostatistika.ee/otsing, built from Transpordiamet's open register snapshot "
    "(andmed.eesti.ee/datasets/soidukite-staatused-eestis). Licence: CC BY-SA 4.0, Transpordiamet."
)


def latest_files() -> list[Path]:
    """The register CSVs of the latest snapshot date on disk."""
    dated = [(snapshot, path) for path in (DOWNLOAD_DIR / "register_snapshot").glob("ar_*.csv") for snapshot, _ in register_members(path)]
    if not dated:
        return []
    latest = max(snapshot for snapshot, _ in dated)
    return sorted(path for snapshot, path in dated if snapshot == latest)


def build() -> int:
    files = latest_files()
    if not files:
        print("no register snapshot on disk; search index not built", flush=True)
        return 0
    result = build_index(files, REGISTER_INDEX_DIR)
    (REGISTER_INDEX_DIR / "index.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    # Older snapshots' files are not needed any more.
    for old in REGISTER_INDEX_DIR.iterdir():
        if old.is_dir() and old.name != result["snapshot"]:
            shutil.rmtree(old)
    print(f"search index {result['snapshot']}: {result['files']} files, {result['bytes'] / 1e6:.1f} MB", flush=True)
    return 0


def current() -> dict | None:
    path = REGISTER_INDEX_DIR / "index.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def gh(*args: str, capture: bool = False) -> str:
    result = subprocess.run(["gh", *args], check=True, text=True, capture_output=capture)
    return result.stdout if capture else ""


def upload() -> int:
    index = current()
    if not index:
        print("no search index to upload", flush=True)
        return 0
    try:
        assets = [asset["name"] for asset in json.loads(gh("release", "view", TAG, "--json", "assets", capture=True))["assets"]]
    except subprocess.CalledProcessError:
        gh("release", "create", TAG, "--title", "Search index", "--notes", NOTES, "--latest=false")
        assets = []
    if index["asset"] in assets:
        print(f"{index['asset']} already in the release", flush=True)
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        tar_path = Path(tmp) / index["asset"]
        with tarfile.open(tar_path, "w") as tar:
            tar.add(REGISTER_INDEX_DIR / index["snapshot"], arcname=index["snapshot"])
        gh("release", "upload", TAG, str(tar_path))
    print(f"uploaded {index['asset']}", flush=True)
    return 0


def install() -> int:
    index = current()
    if not index:
        print("no search index built; run `build` first", flush=True)
        return 1
    target = WEB_DIR / index["snapshot"]
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(REGISTER_INDEX_DIR / index["snapshot"], target)
    print(f"installed {target}", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "upload", "install"])
    return {"build": build, "upload": upload, "install": install}[parser.parse_args().command]()


if __name__ == "__main__":
    raise SystemExit(main())
