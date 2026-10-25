from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import requests

from ingestion.config import DOWNLOAD_DIR, MAX_FILE_BYTES, REQUEST_GAP_SECONDS, REQUEST_TIMEOUT, TRUSTED_HOSTS, USER_AGENT, ensure_dirs
from ingestion.discovery.transpordiamet import DiscoveredResource


@dataclass
class ArchivedFile:
    local_path: Path
    sha256: str
    byte_size: int
    content_type: str | None


def archive_resource(resource: DiscoveredResource, dest_dir: Path | None = None) -> ArchivedFile:
    ensure_dirs()
    host = (urlparse(resource.source_url).hostname or "").lower()
    if host not in TRUSTED_HOSTS:
        raise ValueError(f"Refusing untrusted host: {host}")
    target_dir = dest_dir or DOWNLOAD_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    name = Path(urlparse(resource.source_url).path).name or "source.bin"
    local_path = target_dir / name
    time.sleep(REQUEST_GAP_SECONDS)
    response = requests.get(
        resource.source_url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
        stream=True,
    )
    response.raise_for_status()
    digest = hashlib.sha256()
    size = 0
    tmp_path = local_path.with_suffix(local_path.suffix + ".part")
    with tmp_path.open("wb") as handle:
        for chunk in response.iter_content(chunk_size=65536):
            if not chunk:
                continue
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                handle.close()
                tmp_path.unlink(missing_ok=True)
                raise ValueError(f"File exceeds size limit: {resource.source_url}")
            digest.update(chunk)
            handle.write(chunk)
    tmp_path.replace(local_path)
    return ArchivedFile(
        local_path=local_path,
        sha256=digest.hexdigest(),
        byte_size=size,
        content_type=response.headers.get("Content-Type"),
    )
