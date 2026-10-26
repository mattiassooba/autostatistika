"""Register snapshots listed in the Estonian open-data catalogue.

The dataset "Sõidukite staatused Eestis" lists one CSV per date and part
(``2026-10-01 M1+M1G``, ``2024-01-01 muu``), a zip of the 1 January files for
2020-2023, and older extracts in another format (``kat M1 ja M1G 31.12.2022``).
The older extracts describe the same moments as the 1 January files and are
not used, so every snapshot comes from one file layout.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import requests

from ingestion.config import OPEN_DATA_API, REGISTER_DATASET_SLUG, REQUEST_TIMEOUT, USER_AGENT
from ingestion.discovery.transpordiamet import DiscoveredResource

SOURCE_ID = "ta-register-opendata"
KIND = "register_snapshot"
DATASET_PAGE = f"https://andmed.eesti.ee/datasets/{REGISTER_DATASET_SLUG}"
PART = re.compile(r"^\s*(\d{4}-\d{2}-\d{2})\s+(M1\+M1G|muu)\s*$", re.I)


def fetch_dataset() -> dict:
    response = requests.get(
        f"{OPEN_DATA_API}/slug/{REGISTER_DATASET_SLUG}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def register_resources(dataset: dict) -> list[DiscoveredResource]:
    found: dict[str, DiscoveredResource] = {}
    for item in dataset.get("distributions", []):
        title = (item.get("titleEt") or "").strip()
        urls = item.get("accessUrls") or []
        if not urls:
            continue
        url = urls[0]
        match = PART.match(title)
        if match:
            snapshot, part = match.group(1), "M1+M1G" if match.group(2).upper() == "M1+M1G" else "muu"
            name = f"ar_{snapshot}_{part}.csv"
            found[name] = DiscoveredResource(SOURCE_ID, url, name, KIND, None, snapshot, "register_csv")
        elif "zip" in title.lower() and "2020-2023" in title:
            found["ar_2020-2023.zip"] = DiscoveredResource(SOURCE_ID, url, "ar_2020-2023.zip", KIND, None, None, "register_zip_retroactive")
    return sorted(found.values(), key=lambda r: r.title)


def local_name(resource: DiscoveredResource) -> str:
    """Catalogue links end in /download or /download-s3; the title holds the file name."""
    files = parse_qs(urlparse(resource.source_url).query).get("files")
    return files[0] if files else resource.title


def discover_register() -> list[DiscoveredResource]:
    return register_resources(fetch_dataset())
