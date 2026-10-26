"""Register snapshots from the open dataset "Sõidukite staatused Eestis"
(andmed.eesti.ee/datasets/soidukite-staatused-eestis).

Each ``ar_<date>_<part>.csv`` has one row per vehicle in the register on that
date: ``M1+M1G`` holds passenger cars, ``muu`` every other category. Older
years come as one zip of such files. The rows are counted into fleet facts
here; individual vehicles are never stored.

* Status is the source's general status (``YLDINE_STAATUS``): registered or
  suspended. Both are in the register; the split is kept on every count.
* County is the responsible user's (or owner's) county, ``VKOM_MAAKOND``.
* Age is full years from ``ESMANE_REG`` (first registration in any country)
  to the snapshot date.
"""
from __future__ import annotations

import re
import zipfile
from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pandas as pd

from ingestion.normalization.brands import canonical_brand
from ingestion.normalization.categories import canonical_category
from ingestion.normalization.regions import canonical_region
from ingestion.parsers.records import ParsedFact
from ingestion.seeds import REGIONS

MEMBER = re.compile(r"ar_(\d{4}-\d{2}-\d{2})_(M1\+M1G|muu)\.csv$", re.I)
STATUS = {"REGISTREERITUD": "registered", "PEATATUD": "suspended"}
FACT_COLUMNS = ["MARK", "YLDINE_STAATUS", "ESMANE_REG", "KATEGOORIA", "VKOM_MAAKOND"]
AGE_BANDS = [(0, 2, "0-2"), (3, 5, "3-5"), (6, 10, "6-10"), (11, 10_000, "over-10")]


def register_members(path: Path) -> list[tuple[str, str]]:
    """(snapshot date, member name) for every register CSV in a file or zip."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
    else:
        names = [path.name]
    found = []
    for name in names:
        match = MEMBER.search(Path(name).name)
        if match:
            found.append((match.group(1), name))
    return sorted(found)


def read_register(path: Path, columns: list[str] | None = None) -> Iterator[tuple[str, str, pd.DataFrame]]:
    """Yield (snapshot date, member name, frame of text columns) per CSV."""
    members = register_members(path)
    if not members:
        raise ValueError(f"No ar_<date>_<part>.csv in {path.name}")
    for snapshot, name in members:
        options = dict(sep=";", dtype=str, encoding="utf-8-sig", usecols=columns, keep_default_na=False, na_values=[""])
        if zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as archive, archive.open(name) as handle:
                frame = pd.read_csv(handle, **options)
        else:
            frame = pd.read_csv(path, **options)
        yield snapshot, name, frame


def parse_register(path: Path, retroactive: bool = False) -> list[ParsedFact]:
    facts: list[ParsedFact] = []
    for snapshot, name, frame in read_register(path, FACT_COLUMNS):
        facts.extend(register_facts(frame, snapshot, retroactive=retroactive, member=Path(name).name))
    return facts


def register_facts(frame: pd.DataFrame, snapshot: str, retroactive: bool = False, member: str = "") -> list[ParsedFact]:
    """Brand counts by status (their sum is the stock), county and age counts."""
    extra = {"source": "register", "member": member}
    if retroactive:
        # The 2020-2023 files were queried from the register in 2025 (README in the zip).
        extra["retroactive"] = True
    family = _mapped(frame["KATEGOORIA"], lambda value: canonical_category(value)[0] or "unclassified")
    status = frame["YLDINE_STAATUS"].map(lambda value: STATUS.get(str(value).strip().upper(), "unknown"))
    brands = {value: canonical_brand(value) for value in frame["MARK"].dropna().unique()}
    brand_slug = frame["MARK"].map(lambda value: brands[value][0] if value in brands else None)
    region = _mapped(frame["VKOM_MAAKOND"], lambda value: canonical_region(value)[0] or "unassigned")
    age_band = _age_bands(frame["ESMANE_REG"], snapshot)

    out: list[ParsedFact] = []
    keyed = pd.DataFrame({"family": family, "status": status, "brand": brand_slug, "mark": frame["MARK"]})
    names = {slug: canonical for slug, canonical, _ in brands.values() if slug}
    for (fam, stat, slug), count in keyed.dropna(subset=["brand"]).groupby(["family", "status", "brand"]).size().items():
        out.append(_fact(snapshot, fam, int(count), {**extra, "grain": "brand"}, status_code=stat, brand_slug=slug, brand_source=names[slug]))
    missing_brand = keyed[keyed["brand"].isna()].groupby(["family", "status"]).size()
    for (fam, stat), count in missing_brand.items():
        # Rows without a make still count towards the stock.
        out.append(_fact(snapshot, fam, int(count), {**extra, "grain": "brand"}, status_code=stat, brand_slug="unknown", brand_source="—"))
    for (fam, code), count in pd.DataFrame({"family": family, "region": region}).groupby(["family", "region"]).size().items():
        out.append(_fact(snapshot, fam, int(count), {**extra, "grain": "region"}, region_code=code, region_source=_region_name(code)))
    for (fam, band), count in pd.DataFrame({"family": family, "band": age_band}).dropna().groupby(["family", "band"]).size().items():
        out.append(_fact(snapshot, fam, int(count), {**extra, "grain": "age", "age_basis": "first_registration"}, age_band=band))
    return out


def _fact(snapshot: str, family: str, value: int, extra: dict, **dims) -> ParsedFact:
    return ParsedFact(
        table="vehicle_fleet_facts",
        metric_code="fleet_count",
        value=value,
        unit="vehicles",
        snapshot_date=snapshot,
        category_code=family,
        extra=extra,
        **dims,
    )


def _mapped(series: pd.Series, fn) -> pd.Series:
    lookup = {value: fn(value) for value in series.dropna().unique()}
    return series.map(lambda value: lookup.get(value, fn(None)))


def _age_bands(first_registration: pd.Series, snapshot: str) -> pd.Series:
    """Full years from first registration to the snapshot date. Missing or
    later-than-snapshot dates get no band (they are not counted as new)."""
    when = pd.to_datetime(first_registration, format="%Y-%m-%d", errors="coerce")
    snap = date.fromisoformat(snapshot)
    before_birthday = (when.dt.month > snap.month) | ((when.dt.month == snap.month) & (when.dt.day > snap.day))
    years = snap.year - when.dt.year - before_birthday.astype("Int64")
    bands = pd.Series(pd.NA, index=first_registration.index, dtype="object")
    for low, high, label in AGE_BANDS:
        bands[(years >= low) & (years <= high)] = label
    return bands


REGION_NAMES = {code: label for code, label, _en in REGIONS} | {"unassigned": "Määramata"}


def _region_name(code: str) -> str:
    return REGION_NAMES.get(code, code)
