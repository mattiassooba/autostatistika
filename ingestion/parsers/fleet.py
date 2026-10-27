from __future__ import annotations

from pathlib import Path

from ingestion.normalization.brands import canonical_brand
from ingestion.normalization.categories import canonical_category
from ingestion.normalization.fuels import canonical_fuel
from ingestion.normalization.regions import canonical_region
from ingestion.normalization.text import clean_text
from ingestion.parsers.excel import find_sheet, is_total_label, open_workbook, read_sheet, to_number
from ingestion.parsers.records import ParsedFact

STATUS_MAP = {
    "registreeritud": "registered",
    "peatatud registrikandega": "suspended",
    "ajutiselt kustutatud": "temporarily_deleted",
}


def parse_fleet(path: Path, snapshot_date: str | None) -> list[ParsedFact]:
    xl = open_workbook(path)
    facts: list[ParsedFact] = []
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        title = str(df.iloc[0, 0]) if not df.empty else ""
        snap = snapshot_date or _snapshot_from_title(title)
        if not snap:
            continue
        if "haldusterritoorium" in " ".join(str(v) for v in df.head(8).to_numpy().ravel()).lower():
            facts.extend(_parse_county_stock(df, snap))
        elif any("üldstaatus" in str(v).lower() for v in df.head(6).to_numpy().ravel()):
            facts.extend(_parse_vehicle_level(df, snap))
        elif any(str(v).lower() == "arv" for v in df.head(3).to_numpy().ravel()):
            facts.extend(_parse_aggregated_stock(df, snap))
        elif "vanusevahemike" in " ".join(str(v) for v in df.head(6).to_numpy().ravel()).lower():
            facts.extend(_parse_age_bands(df, snap))
    return facts


def _snapshot_from_title(title: str) -> str | None:
    import re

    match = re.search(r"(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})", title)
    if match:
        return f"{int(match.group(3)):04d}-{int(match.group(2)):02d}-{int(match.group(1)):02d}"
    match = re.search(r"(\d{2})(\d{2})(\d{2})", title)
    if match:
        return f"{2000 + int(match.group(3)):04d}-{int(match.group(2)):02d}-{int(match.group(1)):02d}"
    return None


def _parse_vehicle_level(df, snapshot: str) -> list[ParsedFact]:
    header_idx = None
    for idx, row in df.iterrows():
        values = [str(v).lower() if v is not None else "" for v in row.tolist()]
        if any("üldstaatus" in v or "uldstaatus" in v for v in values) and any("mark" in v for v in values):
            header_idx = idx
            break
    if header_idx is None:
        return []
    header = [clean_text(v) or "" for v in df.iloc[header_idx].tolist()]
    counts: dict[tuple, int] = {}
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        status_raw = clean_text(row.iloc[0])
        eu = clean_text(row.iloc[1] if len(row) > 1 else None)
        brand_source = clean_text(row.iloc[2] if len(row) > 2 else None)
        model = clean_text(row.iloc[3] if len(row) > 3 else None)
        year = to_number(row.iloc[5] if len(row) > 5 else None)
        if not brand_source:
            continue
        status = STATUS_MAP.get((status_raw or "").lower(), "unknown")
        family, eu_code = canonical_category(eu)
        slug, canonical, _status = canonical_brand(brand_source)
        key = (status, family, eu_code or eu, slug, canonical, model, int(year) if year else None)
        counts[key] = counts.get(key, 0) + 1
    facts = []
    for key, value in counts.items():
        status, family, eu, slug, canonical, model, year = key
        facts.append(
            ParsedFact(
                table="vehicle_fleet_facts",
                metric_code="fleet_count",
                value=value,
                unit="vehicles",
                snapshot_date=snapshot,
                category_code=family,
                eu_category=eu,
                brand_slug=slug,
                brand_source=canonical,
                model_source=model,
                status_code=status,
                manufacture_year=year,
                extra={"grain": "vehicle"},
            )
        )
    return facts


def _parse_aggregated_stock(df, snapshot: str) -> list[ParsedFact]:
    header_idx = None
    for idx, row in df.iterrows():
        values = [str(v).lower() if v is not None else "" for v in row.tolist()]
        if any(v in {"kat", "kategooria"} for v in values) and any("mark" in v for v in values):
            header_idx = idx
            break
    if header_idx is None:
        return []
    facts = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        eu = clean_text(row.iloc[0])
        brand_source = clean_text(row.iloc[1] if len(row) > 1 else None)
        model = clean_text(row.iloc[2] if len(row) > 2 else None)
        year = to_number(row.iloc[3] if len(row) > 3 else None)
        fuel_code, fuel_source, _status = canonical_fuel(row.iloc[4] if len(row) > 4 else None)
        value = to_number(row.iloc[-1])
        if not brand_source or value is None:
            continue
        family, eu_code = canonical_category(eu)
        slug, canonical, _map = canonical_brand(brand_source)
        facts.append(
            ParsedFact(
                table="vehicle_fleet_facts",
                metric_code="fleet_count",
                value=value,
                unit="vehicles",
                snapshot_date=snapshot,
                category_code=family,
                eu_category=eu_code or eu,
                brand_slug=slug,
                brand_source=canonical,
                model_source=model,
                fuel_code=fuel_code,
                fuel_source=fuel_source,
                manufacture_year=int(year) if year else None,
                extra={"grain": "brand"},
            )
        )
    return facts


def _parse_county_stock(df, snapshot: str) -> list[ParsedFact]:
    header_idx = None
    families: dict[int, str] = {}
    for idx, row in df.iterrows():
        values = [clean_text(v) for v in row.tolist()]
        mapped = {}
        for col, value in enumerate(values):
            if not value:
                continue
            family, _eu = canonical_category(value)
            if family:
                mapped[col] = family
        if len(mapped) >= 2:
            header_idx = idx
            families = mapped
    if header_idx is None:
        return []
    facts = []
    start = header_idx + 1
    if start < len(df) and clean_text(df.iloc[start, 0]) and "haldus" in str(df.iloc[start, 0]).lower():
        start += 1
    for _, row in df.iloc[start:].iterrows():
        region_code, region_source, status = canonical_region(row.iloc[0])
        if status == "subtotal" or not region_code:
            continue
        for col, category in families.items():
            value = to_number(row.iloc[col] if col < len(row) else None)
            if value is None:
                continue
            facts.append(
                ParsedFact(
                    table="vehicle_fleet_facts",
                    metric_code="fleet_count",
                    value=value,
                    unit="vehicles",
                    snapshot_date=snapshot,
                    category_code=category,
                    region_code=region_code,
                    region_source=region_source,
                    extra={"grain": "region"},
                )
            )
    return facts


def _parse_age_bands(df, snapshot: str, includes_suspended: bool = False) -> list[ParsedFact]:
    """Age sheet: one row per vehicle family (KOKKU + four bands), each followed
    by a "SELLEST ERA" (of which private) row. Rows whose label is not a family
    (KOKKU AUTOD, MOOTORSÕIDUKID, ...) are aggregates and reset the context, so
    they can never be attributed to the family above them.

    The KOKKU column is the snapshot stock for the family and is emitted as an
    explicit ``stock_total`` fact."""
    facts = []
    bands = ["total", "0-2", "3-5", "6-10", "over-10"]
    header_col = None
    for _, row in df.iterrows():
        values = [str(v).strip().lower() for v in row.tolist()]
        if "kokku" in values[1:3]:
            header_col = 1 if values[1] == "kokku" else 2
            break
    start = header_col or 1
    for _, row in df.iterrows():
        label = clean_text(row.iloc[0])
        if not label:
            continue
        family, _eu = canonical_category(label)
        if not family:
            continue
        values = [to_number(v) for v in row.tolist()[start : start + 5]]
        if not values or values[0] is None:
            continue
        facts.append(
            ParsedFact(
                table="vehicle_fleet_facts",
                metric_code="fleet_count",
                value=values[0],
                unit="vehicles",
                snapshot_date=snapshot,
                category_code=family,
                extra={
                    "grain": "stock_total",
                    "source_sheet": "vanus",
                    # The sheet note "Sisaldab registrikanne peatatud sõidukeid".
                    "status_scope": "includes_suspended" if includes_suspended else "unspecified",
                },
            )
        )
        for band, value in zip(bands[1:], values[1:], strict=False):
            if value is None:
                continue
            facts.append(
                ParsedFact(
                    table="vehicle_fleet_facts",
                    metric_code="fleet_count",
                    value=value,
                    unit="vehicles",
                    snapshot_date=snapshot,
                    category_code=family,
                    age_band=band,
                    extra={"grain": "age"},
                )
            )
    return facts


def _parse_brand_top_stock(df, snapshot: str, category: str) -> list[ParsedFact]:
    """"Enim arvel olevad" sheets: the brands with the largest stock, by build
    year, with a Kokku column. This is a top list, not a complete split: it is
    published with grain ``brand_top`` so shares are taken against the
    snapshot stock and the list is never summed into a stock figure."""
    header_idx = None
    total_col = None
    for idx, row in df.iterrows():
        values = [str(v).strip().lower() for v in row.tolist()]
        if values and values[0] == "mark" and "kokku" in values:
            header_idx = idx
            total_col = values.index("kokku")
            break
    if header_idx is None or total_col is None:
        return []
    facts = []
    rank = 0
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        brand_source = clean_text(row.iloc[0])
        value = to_number(row.iloc[total_col] if total_col < len(row) else None)
        if not brand_source or value is None or is_total_label(brand_source):
            continue
        rank += 1
        slug, canonical, _status = canonical_brand(brand_source)
        facts.append(
            ParsedFact(
                table="vehicle_fleet_facts",
                metric_code="fleet_count",
                value=value,
                unit="vehicles",
                snapshot_date=snapshot,
                category_code=category,
                brand_slug=slug,
                brand_source=canonical,
                extra={"grain": "brand_top", "rank": rank},
            )
        )
    return facts


def _sheet_title(df) -> str:
    rows = df.head(5).fillna("").astype(str).values.tolist()
    return " ".join(" ".join(row) for row in rows).lower()


def _fold(text: str) -> str:
    return (
        text.replace("õ", "o").replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("š", "s").replace("ž", "z")
    )


def _parse_registered_only(df, snapshot: str) -> list[ParsedFact]:
    """"Arvel (va peatatud)": the register without suspended records, one count
    per family. Aggregate rows (KOKKU AUTOD, MOTO incl. mopeds) are skipped."""
    facts = []
    for _, row in df.iterrows():
        label = clean_text(row.iloc[0])
        if not label or label.lower().startswith(("moto", "kokku", "(", "kõik")):
            continue
        family, _eu = canonical_category(label)
        value = next((to_number(v) for v in row.tolist()[1:] if to_number(v) is not None), None)
        if not family or value is None:
            continue
        facts.append(
            ParsedFact(
                table="vehicle_fleet_facts",
                metric_code="fleet_count",
                value=value,
                unit="vehicles",
                snapshot_date=snapshot,
                category_code=family,
                status_code="registered",
                extra={"grain": "stock_registered"},
            )
        )
    return facts


def _date_in_title(title: str) -> str | None:
    """Strict dd.mm.yyyy only; sheet titles contain other six-digit numbers."""
    import re

    match = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", title)
    if not match:
        return None
    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if not (1 <= month <= 12 and 1 <= day <= 31 and 1990 <= year <= 2100):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def _align_stock_date(value: str | None) -> str | None:
    """Leaflets state the same register moment as "31.01.2012" on one sheet and
    "01.02.2012" on another. A month-end stock is moved to the first day of the
    next month so every table of one leaflet lands on one snapshot date."""
    if not value:
        return value
    import calendar

    year, month, day = (int(part) for part in value.split("-"))
    if day == calendar.monthrange(year, month)[1]:
        month += 1
        if month == 13:
            year, month = year + 1, 1
        return f"{year:04d}-{month:02d}-01"
    return value


def parse_infoleht_stock(path: Path, snapshot_date: str | None) -> list[ParsedFact]:
    """Stock tables inside legacy monthly Infoleht workbooks (2006-2013).

    Only sheets whose title says they describe the register ("arvel",
    "haldusterritoorium", "vanusevahemike") are read. Flow sheets in the same
    workbook (uus-sõidu, uued, TOP 10, esm-*) are never parsed as stock."""
    xl = open_workbook(path)
    facts: list[ParsedFact] = []
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        if df.empty:
            continue
        title = _fold(_sheet_title(df))
        snap = _align_stock_date(_date_in_title(title) or snapshot_date)
        if not snap:
            continue
        if "esmase registreerimise aasta" in title or "esmaselt" in title or "esmakordselt" in title:
            continue
        if "haldusterritoor" in title or "maakondade" in title:
            facts.extend(_parse_county_stock(df, snap))
        elif "vanusevahemik" in title:
            facts.extend(_parse_age_bands(df, snap, includes_suspended="sisaldab" in title and "peatatud" in title))
        elif "va peatatud" in title and "arvel" in title:
            facts.extend(_parse_registered_only(df, snap))
        elif "arvel" in title and ("enim" in title or "top" in title):
            category = "truck" if "veoauto" in title else "passenger_car" if "soiduauto" in title else None
            if category:
                facts.extend(_parse_brand_top_stock(df, snap, category))
    return facts


def _low(text: str) -> str:
    return _fold(str(text).lower())


AGE_HEADERS = [("ule 10", "over-10"), ("6 kuni 10", "6-10"), ("3 kuni 5", "3-5"), ("kuni 2", "0-2")]


def parse_register_tables(path: Path, snapshot_date: str | None) -> list[ParsedFact]:
    """Register general tables ("Arvel olevad sõidukid … (üldtabelid)", 2016-2018).

    * The age sheet gives the stock of every vehicle type with its age bands; its
      note says suspended records are included. Two layouts: KOKKU first
      (12/2016, 05/2018) or last (2017-2018 year ends).
    * Make sheets (Sõiduautod, Veoautod, Bussid, Haagised) list every make with a
      KOKKU column: a complete split by make.
    * The county sheet (07/2017) has a Kokku / sh. era column pair per type.
    Motorcycles and mopeds appear only as one combined "Moto" row (with mopeds as
    a subset in some years); they are not split here and stay unpublished."""
    xl = open_workbook(path)
    facts: list[ParsedFact] = []
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        if df.empty:
            continue
        head = _low(" ".join(str(v) for v in df.iloc[:5, 0].fillna("")))
        snap = _align_stock_date(_date_in_title(head) or snapshot_date)
        if not snap:
            continue
        blob = _low(" ".join(str(v) for v in df.head(8).fillna("").to_numpy().ravel()))
        if "kuni 2" in blob:
            facts.extend(_parse_age_table(df, snap, includes_suspended="peatatud" in head))
        elif "maakond" in blob and "sh. era" in blob:
            facts.extend(_parse_county_pairs(df, snap))
        else:
            family, _eu = canonical_category(sheet)
            if family and "mark" in blob and "kokku" in blob:
                facts.extend(_parse_make_totals(df, snap, family, sheet))
    return facts


def _parse_age_table(df, snapshot: str, includes_suspended: bool) -> list[ParsedFact]:
    header_idx, columns = None, {}
    for idx, row in df.head(12).iterrows():
        cells = [_low(str(v)) if v is not None else "" for v in row.tolist()]
        if any("kuni 2" in c for c in cells) and "kokku" in cells:
            header_idx = idx
            columns["total"] = cells.index("kokku")
            for col, cell in enumerate(cells):
                band = next((code for text, code in AGE_HEADERS if text in cell), None)
                if band and band not in columns:
                    columns[band] = col
            break
    if header_idx is None:
        return []
    facts = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        family, _eu = canonical_category(row.iloc[0])
        total = to_number(row.iloc[columns["total"]])
        if not family or total is None:
            continue
        scope = "includes_suspended" if includes_suspended else "unspecified"
        facts.append(_stock_fact(snapshot, family, total, {"grain": "stock_total", "source_sheet": "register_tables", "status_scope": scope}))
        for band in ("0-2", "3-5", "6-10", "over-10"):
            value = to_number(row.iloc[columns[band]]) if band in columns else None
            if value is not None:
                facts.append(_stock_fact(snapshot, family, value, {"grain": "age"}, age_band=band))
    return facts


def _parse_make_totals(df, snapshot: str, family: str, sheet: str) -> list[ParsedFact]:
    header_idx, total_col = None, None
    for idx, row in df.head(10).iterrows():
        cells = [_low(str(v)) if v is not None else "" for v in row.tolist()]
        if "mark" in cells and "kokku" in cells:
            header_idx, total_col = idx, cells.index("kokku")
            break
    if header_idx is None:
        return []
    facts = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        source = clean_text(row.iloc[0])
        value = to_number(row.iloc[total_col])
        if not source:
            continue
        if is_total_label(source):
            break
        if value is None:
            continue
        slug, canonical, _status = canonical_brand(source)
        facts.append(_stock_fact(snapshot, family, value, {"grain": "brand", "source_sheet": sheet}, brand_slug=slug, brand_source=canonical))
    return facts


def _parse_county_pairs(df, snapshot: str) -> list[ParsedFact]:
    """Two header rows: the vehicle type over a "Kokku" / "sh. era" pair."""
    types_idx = None
    for idx in range(min(10, len(df) - 1)):
        below = [_low(str(v)) for v in df.iloc[idx + 1].tolist()]
        if "kokku" in below and "sh. era" in below:
            types_idx = idx
            break
    if types_idx is None:
        return []
    columns = {}
    for col, (label, kind) in enumerate(zip(df.iloc[types_idx].tolist(), df.iloc[types_idx + 1].tolist())):
        family, _eu = canonical_category(label)
        # The motorcycle column counts motorcycles and mopeds together (its total
        # is the age sheet's combined "Moto" row), so it is not published.
        if family and family not in {"motorcycle", "moped"} and _low(str(kind)) == "kokku":
            columns[col] = family
    facts = []
    for _, row in df.iloc[types_idx + 2 :].iterrows():
        if is_total_label(clean_text(row.iloc[0])):
            break
        region_code, region_source, status = canonical_region(row.iloc[0])
        if status == "subtotal" or not region_code:
            continue
        for col, family in columns.items():
            value = to_number(row.iloc[col])
            if value is not None:
                facts.append(_stock_fact(snapshot, family, value, {"grain": "region"}, region_code=region_code, region_source=region_source))
    return facts


def _stock_fact(snapshot: str, family: str, value: float, extra: dict, **dims) -> ParsedFact:
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

