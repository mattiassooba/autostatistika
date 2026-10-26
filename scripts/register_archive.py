"""Keep every register snapshot file in a GitHub release of this repository.

The open-data catalogue replaces its monthly register file every month, so a
snapshot that is no longer listed can only be rebuilt from our own copy.

    python scripts/register_archive.py restore   # download archived files missing locally
    python scripts/register_archive.py upload    # upload local files missing from the release

Needs the GitHub CLI (``gh``) with a token that can write releases (the
weekly job's GITHUB_TOKEN). Files are stored gzip-compressed; zips as they are.
"""
from __future__ import annotations

import argparse
import gzip
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR  # noqa: E402

TAG = "register-archive"
FOLDER = DOWNLOAD_DIR / "register_snapshot"
NOTES = (
    "Copies of the Transpordiamet open register snapshots used by autostatistika.ee "
    "(andmed.eesti.ee/datasets/soidukite-staatused-eestis). Licence: CC BY-SA 4.0, Transpordiamet. "
    "Kept because the catalogue replaces its monthly file."
)


def asset_name(file_name: str) -> str:
    # Release asset names cannot keep "+".
    name = file_name.replace("+", "_plus_")
    return name if name.endswith(".zip") else f"{name}.gz"


def file_name(asset: str) -> str:
    name = asset.replace("_plus_", "+")
    return name[:-3] if name.endswith(".gz") else name


def gh(*args: str, capture: bool = False) -> str:
    result = subprocess.run(["gh", *args], check=True, text=True, capture_output=capture)
    return result.stdout if capture else ""


def release_assets() -> list[str]:
    try:
        out = gh("release", "view", TAG, "--json", "assets", capture=True)
    except subprocess.CalledProcessError:
        return []
    return [asset["name"] for asset in json.loads(out)["assets"]]


def restore() -> int:
    FOLDER.mkdir(parents=True, exist_ok=True)
    missing = [asset for asset in release_assets() if not (FOLDER / file_name(asset)).exists()]
    for asset in missing:
        with tempfile.TemporaryDirectory() as tmp:
            gh("release", "download", TAG, "--pattern", asset, "--dir", tmp)
            source = Path(tmp) / asset
            target = FOLDER / file_name(asset)
            if asset.endswith(".gz"):
                with gzip.open(source, "rb") as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
            else:
                shutil.move(source, target)
        print(f"restored {target.name}", flush=True)
    print(f"{len(missing)} restored from the release", flush=True)
    return 0


def upload() -> int:
    present = set(release_assets())
    if not present:
        try:
            gh("release", "view", TAG)
        except subprocess.CalledProcessError:
            gh("release", "create", TAG, "--title", "Register snapshot archive", "--notes", NOTES, "--latest=false")
    uploaded = 0
    for path in sorted(FOLDER.glob("ar_*")):
        if path.suffix not in {".csv", ".zip"} or asset_name(path.name) in present:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            asset = Path(tmp) / asset_name(path.name)
            if path.suffix == ".zip":
                shutil.copy(path, asset)
            else:
                with path.open("rb") as src, gzip.open(asset, "wb", compresslevel=6) as dst:
                    shutil.copyfileobj(src, dst)
            gh("release", "upload", TAG, str(asset))
        uploaded += 1
        print(f"uploaded {path.name}", flush=True)
    print(f"{uploaded} uploaded to the release", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["restore", "upload"])
    return restore() if parser.parse_args().command == "restore" else upload()


if __name__ == "__main__":
    raise SystemExit(main())
