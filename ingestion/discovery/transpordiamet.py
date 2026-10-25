from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from ingestion.config import (
    INSPECTIONS_PAGE,
    REGISTRATIONS_PAGE,
    REQUEST_TIMEOUT,
    TRUSTED_HOSTS,
    USER_AGENT,
)

MONTHS_ET = {
    "jaanuar": 1,
    "veebruar": 2,
    "märts": 3,
    "marts": 3,
    "aprill": 4,
    "mai": 5,
    "juuni": 6,
    "juuli": 7,
    "august": 8,
    "september": 9,
    "oktoober": 10,
    "november": 11,
    "detsember": 12,
}


@dataclass(frozen=True)
class DiscoveredResource:
    source_id: str
    source_url: str
    title: str
    resource_kind: str
    reporting_period: str | None
    snapshot_date: str | None
    layout_hint: str | None


def _trusted(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host.lower() in TRUSTED_HOSTS


def _fetch_html(url: str) -> str:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return response.text


def _period_from_text(text: str) -> str | None:
    compact = text.lower().replace(" ", "")
    # Explicit file-name patterns first; loose patterns can hit the upload
    # folder (/documents/2021-02/) instead of the reporting month.
    match = re.search(r"kuuaruanne[_-]?(\d{4})[_-](\d{2})", compact)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.search(r"infoleht[-_ ]?(\d{1,2})[-_ ]?(\d{2,4})", compact)
    if match:
        month = int(match.group(1))
        year = int(match.group(2))
        if year < 100:
            year += 2000
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    match = re.search(r"(20\d{2}).{0,8}(\d{1,2})", compact)
    month_name = next((name for name in MONTHS_ET if name in compact), None)
    if month_name and (year_match := re.search(r"(20\d{2}|19\d{2})", text)):
        return f"{int(year_match.group(1)):04d}-{MONTHS_ET[month_name]:02d}"
    match = re.search(r"kuuaruanne[_-]?(\d{4})[_-](\d{2})", compact)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return None


def _snapshot_from_text(text: str) -> str | None:
    match = re.search(r"seisuga\s+(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})", text.lower())
    if match:
        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"
    match = re.search(r"(\d{2})(\d{2})(\d{2})(?!\d)", text)
    if match and "arvel" in text.lower():
        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        year += 2000
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
    return None


def _classify(href: str, title: str) -> tuple[str, str, str | None] | None:
    name = f"{href} {title}".lower()
    if "kuuaruanne" in name:
        return "ta-inspections-xls", "inspection_monthly", "inspection_xls"
    if any(token in name for token in ("arvel", "bussid-", "soiduautod", "veoautod", "traktorid", "liikur")) and (
        "seisuga" in name or re.search(r"\d{6}", name)
    ):
        if "infoleht" in name:
            return None
        return "ta-fleet-archive", "fleet_snapshot", "fleet_workbook"
    if "infoleht" in name:
        return "ta-infoleht", "registration_infoleht", None
    return None


def discover_page(url: str) -> list[DiscoveredResource]:
    html = _fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    found: dict[str, DiscoveredResource] = {}
    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "")
        if not re.search(r"\.(xls|xlsx)$", href, re.I):
            continue
        absolute = urljoin(url, href)
        if not _trusted(absolute):
            continue
        title = " ".join(anchor.stripped_strings)
        classified = _classify(href, title)
        if not classified:
            continue
        source_id, kind, hint = classified
        period = _period_from_text(f"{title} {href}")
        snapshot = _snapshot_from_text(f"{title} {href}") if kind == "fleet_snapshot" else None
        found[absolute] = DiscoveredResource(
            source_id=source_id,
            source_url=absolute,
            title=title or href,
            resource_kind=kind,
            reporting_period=period,
            snapshot_date=snapshot,
            layout_hint=hint,
        )
    return sorted(found.values(), key=lambda item: item.source_url)


def discover_transpordiamet() -> list[DiscoveredResource]:
    resources: list[DiscoveredResource] = []
    resources.extend(discover_page(REGISTRATIONS_PAGE))
    resources.extend(discover_page(INSPECTIONS_PAGE))
    # Fleet page is Tableau-only; historical fleet files live on the Infoleht archive.
    seen: set[str] = set()
    unique: list[DiscoveredResource] = []
    for item in resources:
        if item.source_url in seen:
            continue
        seen.add(item.source_url)
        unique.append(item)
    return unique
