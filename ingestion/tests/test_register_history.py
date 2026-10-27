"""Monthly register history: the catalogue replaces its monthly file, so a file
it no longer lists must stay in the manifest (scripts/fetch_backfill.py)."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_fetch_backfill():
    spec = importlib.util.spec_from_file_location("fetch_backfill", ROOT / "scripts" / "fetch_backfill.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_unlisted_monthly_file_stays_in_the_manifest(tmp_path: Path, monkeypatch) -> None:
    fetch = load_fetch_backfill()
    monkeypatch.setattr(fetch, "DOWNLOAD_DIR", tmp_path)
    folder = tmp_path / "register_snapshot"
    folder.mkdir()
    for name in ("ar_2026-10-01_M1+M1G.csv", "ar_2026-11-01_M1+M1G.csv"):
        (folder / name).write_text("MARK\n", encoding="utf-8")
    october_url = "https://pilv.transpordiamet.ee/s/x/download?path=%2F&files=ar_2026-10-01_M1%2BM1G.csv"
    (tmp_path / "manifest.json").write_text(
        json.dumps([{"resource_kind": "register_snapshot", "source_url": october_url, "local_path": str(folder / "ar_2026-10-01_M1+M1G.csv")}]),
        encoding="utf-8",
    )
    # November is what the catalogue lists now; October is gone from it.
    listed = [{"resource_kind": "register_snapshot", "source_url": "https://example/nov", "local_path": str(folder / "ar_2026-11-01_M1+M1G.csv")}]
    kept = fetch.kept_register_files(listed)
    assert [entry["title"] for entry in kept] == ["ar_2026-10-01_M1+M1G.csv"]
    assert kept[0]["source_url"] == october_url
    assert kept[0]["snapshot_date"] == "2026-10-01"
    assert kept[0]["layout_hint"] == "register_csv"


def test_a_lost_manifest_still_keeps_the_file(tmp_path: Path, monkeypatch) -> None:
    """After a cache miss the archive restores the files but not the manifest."""
    fetch = load_fetch_backfill()
    monkeypatch.setattr(fetch, "DOWNLOAD_DIR", tmp_path)
    folder = tmp_path / "register_snapshot"
    folder.mkdir()
    (folder / "ar_2026-10-01_muu.csv").write_text("MARK\n", encoding="utf-8")
    kept = fetch.kept_register_files([])
    assert kept[0]["source_url"].endswith("#ar_2026-10-01_muu.csv")
