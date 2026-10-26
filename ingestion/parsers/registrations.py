from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ingestion.normalization.brands import canonical_brand
from ingestion.normalization.categories import canonical_category
from ingestion.normalization.fuels import canonical_fuel
from ingestion.normalization.regions import canonical_region
from ingestion.normalization.text import clean_text
from ingestion.parsers.excel import find_sheet, is_total_label, open_workbook, read_sheet, to_number
from ingestion.parsers.records import ParsedFact

FAMILY_COLUMNS = {
    "sõiduautod": "passenger_car",
    "soiduautod": "passenger_car",
    "veoautod": "truck",
    "bussid": "bus",
    "haagised": "trailer",
    "mootorrattad": "motorcycle",
    "mopeedid": "moped",
    "maastikusõidukid": "offroad",
    "maastikusoidukid": "offroad",
    "traktorid": "tractor",
}


def parse_registrations(path: Path, reporting_period: str | None) -> list[ParsedFact]:
    xl = open_workbook(path)
    period = reporting_period or _period_from_workbook(path, xl)
    if not period:
        raise ValueError(f"Could not determine reporting period for {path.name}")
    content_period = _content_period(path, xl)
    if content_period and content_period != period:
        # File names are not reliable (infoleht-1114_detsember_2014...). The
        # leaflet's own title states its month.
        period = content_period
    facts: list[ParsedFact] = []
    facts.extend(_parse_general_table(path, xl, period))
    if find_sheet(xl, "Kytus_esm"):
        facts.extend(_parse_fuel(path, xl, period))
    if find_sheet(xl, "Esm_sõidu-TOP10", "TOP 10"):
        facts.extend(_parse_brand_year_mix(path, xl, period, "Esm_sõidu-TOP10", "TOP 10", category="passenger_car"))
    if find_sheet(xl, "Esm_veo-TOP15"):
        facts.extend(_parse_brand_year_mix(path, xl, period, "Esm_veo-TOP15", category="truck"))
    if find_sheet(xl, "Sõidu-uus", "uus-sõidu"):
        facts.extend(_parse_new_car_models(path, xl, period))
    if find_sheet(xl, "Järelturg"):
        facts.extend(_parse_aftermarket(path, xl, period))
    if find_sheet(xl, "Uued sõidukid"):
        facts.extend(_parse_new_vehicle_breakdowns(path, xl, period))
    return _drop_unreconciled_breakdowns(_drop_unreconciled_models(_drop_implausible_brands(facts)))


def _drop_unreconciled_models(facts: list[ParsedFact]) -> list[ParsedFact]:
    """The new-car model list can never add up to more than the stated new
    passenger cars. If it does, it read a total or a second table as cars, and
    the model facts are dropped rather than published doubled."""
    stated = next(
        (
            f.value
            for f in facts
            if f.metric_code == "new_vehicles" and f.category_code == "passenger_car" and not f.brand_slug and not f.fuel_code
        ),
        None,
    )
    listed = sum(f.value for f in facts if f.model_source is not None and f.metric_code == "new_vehicles" and f.category_code == "passenger_car")
    if stated is None or listed <= stated * 1.01:
        return facts
    return [f for f in facts if not (f.model_source is not None and f.metric_code == "new_vehicles")]


def _drop_unreconciled_breakdowns(facts: list[ParsedFact]) -> list[ParsedFact]:
    """A family's breakdowns are kept only when its rows add up to the new
    vehicles stated in the same leaflet's general table (within 1 %). Families
    the general table does not state cannot be checked and are dropped."""
    stated = {
        f.category_code: f.value
        for f in facts
        if f.metric_code == "new_vehicles" and f.dimension is None and not f.brand_slug and not f.fuel_code and not f.model_source
    }
    listed: dict[str, float] = {}
    for f in facts:
        if f.dimension == "county":
            listed[f.category_code] = listed.get(f.category_code, 0) + f.value
    keep = {family for family, value in listed.items() if stated.get(family) and abs(value - stated[family]) <= stated[family] * 0.01}
    return [f for f in facts if f.dimension is None or f.category_code in keep]


def _drop_implausible_brands(facts: list[ParsedFact]) -> list[ParsedFact]:
    """A brand's month total can never exceed its category's first
    registrations for that month. If it does, the sheet held something else
    (a year-to-date table) and every brand fact of that category is dropped."""
    totals = {
        f.category_code: f.value
        for f in facts
        if f.metric_code == "first_registrations" and not f.brand_slug and not f.fuel_code and not f.model_source
    }
    bad = set()
    for fact in facts:
        if fact.extra.get("rollup") == "brand_month_total":
            limit = totals.get(fact.category_code)
            if limit is not None and fact.value > limit:
                bad.add(fact.category_code)
    if not bad:
        return facts
    return [f for f in facts if not (f.brand_slug and f.metric_code == "first_registrations" and f.category_code in bad and not f.model_source)]


def _is_flow_sheet(df) -> bool:
    title = " ".join(" ".join(str(v) for v in row) for row in df.head(5).fillna("").values.tolist()).lower()
    if "arvel" in title:
        return False
    return any(token in title for token in ("esmase", "esmasel", "esmakord", "esmaregistr", "esm."))


def _period_from_workbook(path: Path, xl) -> str | None:
    match = re.search(r"(\d{2})[-_]?(\d{2,4})", path.name)
    if match and "infoleht" in path.name.lower():
        month = int(match.group(1))
        year = int(match.group(2))
        if year < 100:
            year += 2000
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    sheet = find_sheet(xl, "Esm(üldtabel)", "Sõidu-uus")
    if sheet:
        df = read_sheet(path, sheet)
        blob = " ".join(str(v) for v in df.iloc[:6, 0].tolist())
        month = None
        for name, number in {
            "jaanuar": 1,
            "veebruar": 2,
            "märts": 3,
            "aprill": 4,
            "mai": 5,
            "juuni": 6,
            "juuli": 7,
            "august": 8,
            "september": 9,
            "sepember": 9,
            "oktoober": 10,
            "november": 11,
            "detsember": 12,
        }.items():
            if name in blob.lower():
                month = number
        year_match = re.search(r"(20\d{2})", blob)
        if month and year_match:
            return f"{year_match.group(1)}-{month:02d}"
    return None


MONTH_NAMES = {
    "jaanuar": 1, "veebruar": 2, "märts": 3, "marts": 3, "aprill": 4, "mai": 5, "juuni": 6, "juuli": 7,
    "august": 8, "september": 9, "sepember": 9, "oktoober": 10, "november": 11, "detsember": 12,
}


def _general_table_sheets(xl) -> list[str]:
    """Monthly general table candidates, most specific first. Annual summary
    sheets (esm2006a) are excluded: they carry year totals, not a month."""
    names = []
    for sheet in xl.sheet_names:
        key = sheet.lower().replace(" ", "")
        if "üldtabel" in key or "uldtabel" in key or "ldtabel" in key:
            names.insert(0, sheet)
        elif re.fullmatch(r"esm[-_]?[\d\-_]{2,9}", key):
            names.append(sheet)
    return names


def _sheet_month(df) -> int | None:
    blob = " ".join(str(v) for v in df.iloc[:4].fillna("").to_numpy().ravel()).lower()
    for name, number in MONTH_NAMES.items():
        if re.search(rf"\b{name}", blob):
            return number
    return None


class PartialPeriodError(ValueError):
    """The leaflet covers part of a month (e.g. 01.09-27.09.2014). A complete
    leaflet for the month supersedes it, so it is never imported."""


def _content_period(path: Path, xl) -> str | None:
    for sheet in _general_table_sheets(xl):
        df = read_sheet(path, sheet)
        blob = " ".join(str(v) for v in df.iloc[:4].fillna("").to_numpy().ravel()).lower()
        if re.search(r"\d{1,2}\.\d{1,2}\.?\s*-\s*\d{1,2}\.\d{1,2}\.\d{4}", blob):
            raise PartialPeriodError(f"{path.name} covers a partial month: {blob.split('registreerimised')[-1].strip()[:30]}")
        month = _sheet_month(df)
        year = re.search(r"(20\d{2})", blob)
        if month and year:
            return f"{year.group(1)}-{month:02d}"
    return None


def _parse_general_table(path: Path, xl, period: str) -> list[ParsedFact]:
    for sheet in _general_table_sheets(xl):
        df = read_sheet(path, sheet)
        facts = _parse_general_frame(df, period)
        if len({f.category_code for f in facts if f.metric_code == "first_registrations"}) >= 3:
            return facts
    return []


def _parse_general_frame(df, period: str) -> list[ParsedFact]:
    header_idx = None
    families: dict[int, str] = {}
    for idx, row in df.iterrows():
        values = [clean_text(v) for v in row.tolist()]
        mapped = {}
        for col, value in enumerate(values):
            if not value:
                continue
            key = value.lower().replace(" ", "")
            key = key.replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("õ", "o")
            if key in FAMILY_COLUMNS:
                mapped[col] = FAMILY_COLUMNS[key]
        if len(mapped) >= 3:
            header_idx = idx
            families = mapped
            break
    if header_idx is None:
        return []
    facts: list[ParsedFact] = []
    metric_map = {
        "kokku": "first_registrations",
        "sh uued": "new_vehicles",
        "sh.uued": "new_vehicles",
        "neist uued omanik era": "new_private_owner",
        "neist era": "new_private_owner",
    }
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        label = clean_text(row.iloc[0])
        if not label:
            continue
        metric = metric_map.get(label.lower())
        if not metric:
            continue
        for col, category in families.items():
            value = to_number(row.iloc[col] if col < len(row) else None)
            if value is None:
                continue
            facts.append(
                ParsedFact(
                    table="registration_facts",
                    metric_code=metric,
                    value=value,
                    unit="vehicles",
                    reporting_period=period,
                    category_code=category,
                )
            )
    first = {(f.category_code): f.value for f in facts if f.metric_code == "first_registrations"}
    new = {(f.category_code): f.value for f in facts if f.metric_code == "new_vehicles"}
    for category, total in first.items():
        if category in new:
            facts.append(
                ParsedFact(
                    table="registration_facts",
                    metric_code="used_first_registrations",
                    value=total - new[category],
                    unit="vehicles",
                    reporting_period=period,
                    category_code=category,
                )
            )
    return facts


def _parse_fuel(path: Path, xl, period: str) -> list[ParsedFact]:
    sheet = find_sheet(xl, "Kytus_esm")
    df = read_sheet(path, sheet)
    header_idx = None
    for idx, row in df.iterrows():
        values = [str(v).lower() if v is not None else "" for v in row.tolist()]
        if any("kategooria" in v for v in values) and any("mootori" in v for v in values):
            header_idx = idx
            break
    if header_idx is None:
        return []
    facts: list[ParsedFact] = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        eu = clean_text(row.iloc[0])
        if not eu or is_total_label(eu):
            continue
        family, eu_code = canonical_category(eu)
        if not family:
            continue
        fuel_code, fuel_source, _status = canonical_fuel(row.iloc[1])
        first = to_number(row.iloc[2])
        new = to_number(row.iloc[3]) if row.shape[0] > 3 else None
        if first is not None:
            facts.append(
                ParsedFact(
                    table="registration_facts",
                    metric_code="first_registrations",
                    value=first,
                    unit="vehicles",
                    reporting_period=period,
                    category_code=family,
                    eu_category=eu_code or eu,
                    fuel_code=fuel_code,
                    fuel_source=fuel_source,
                )
            )
        if new is not None:
            facts.append(
                ParsedFact(
                    table="registration_facts",
                    metric_code="new_vehicles",
                    value=new,
                    unit="vehicles",
                    reporting_period=period,
                    category_code=family,
                    eu_category=eu_code or eu,
                    fuel_code=fuel_code,
                    fuel_source=fuel_source,
                )
            )
    return facts


def _parse_brand_year_mix(path: Path, xl, period: str, *needles: str, category: str) -> list[ParsedFact]:
    """TOP sheets: one row per brand, columns are the vehicle's own first
    registration year (2026, 2025, ...), an "older" bucket (Vanemad / vanem) and
    the source's own Kokku for the month.

    * The brand's month total is the source Kokku cell. Summing year columns
      alone drops the older bucket (BMW 09/2026: 489 by years, 565 in Kokku).
    * Year cells are kept per vehicle_first_reg_year; they are vehicle age, not
      a time series.
    * Several source rows can name one brand ("VOLKSWAGEN" and
      "VOLKSWAGEN, VW"). They are summed under the canonical brand instead of
      overwriting each other.
    * Legacy sheets add a previous-year Kokku and a % change after the first
      Kokku; only the first Kokku after the year columns is read."""
    sheet = find_sheet(xl, *needles)
    if not sheet:
        return []
    df = read_sheet(path, sheet)
    if not _is_flow_sheet(df):
        # Legacy leaflets keep register stock tops ("enim arvel olevad") next to
        # the flow tops. Only first-registration sheets are flows.
        return []
    header_idx = None
    year_cols: dict[int, int] = {}
    for idx, row in df.iterrows():
        years = {}
        for col, value in enumerate(row.tolist()):
            number = to_number(value)
            if number and 1950 <= number <= 2035 and float(number).is_integer():
                years[col] = int(number)
        if len(years) >= 3:
            header_idx = idx
            year_cols = years
            break
    if header_idx is None:
        return []
    header = [str(v).strip().lower() for v in df.iloc[header_idx].tolist()]
    # Brands sit under "Mark"; 08/2024 put a rank column ("jrkNr") before it.
    brand_col = next((i for i, value in enumerate(header) if value == "mark"), 0)
    last_year_col = max(year_cols)
    older_col = next(
        (i for i in range(last_year_col + 1, len(header)) if header[i].startswith("van")),
        None,
    )
    total_col = next(
        (i for i in range(last_year_col + 1, len(header)) if header[i].startswith("kokku")),
        None,
    )

    merged: dict[str, dict] = {}
    seen_labels: set[str] = set()
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        brand_source = clean_text(row.iloc[brand_col])
        if not brand_source or is_total_label(brand_source):
            continue
        lowered = brand_source.lower()
        # A second block (year-to-date TOP 10 under the monthly one) starts
        # with its own header or repeats a brand label: stop at the month.
        if lowered == "mark" or brand_source in seen_labels:
            break
        seen_labels.add(brand_source)
        if lowered.startswith(("jaanuar", "veebruar", "september")) or "esmaselt" in lowered or "registreeritud" in lowered:
            break
        slug, canonical, _status = canonical_brand(brand_source)
        years = {}
        for col, year in year_cols.items():
            value = to_number(row.iloc[col] if col < len(row) else None)
            if value is not None:
                years[year] = value
        older = to_number(row.iloc[older_col]) if older_col is not None and older_col < len(row) else None
        official = to_number(row.iloc[total_col]) if total_col is not None and total_col < len(row) else None
        if not years and official is None:
            continue
        entry = merged.setdefault(
            slug,
            {"canonical": canonical, "sources": [], "years": {}, "older": 0.0, "official": None, "by_columns": 0.0},
        )
        entry["sources"].append(brand_source)
        for year, value in years.items():
            entry["years"][year] = entry["years"].get(year, 0.0) + value
        entry["older"] += older or 0.0
        entry["by_columns"] += sum(years.values()) + (older or 0.0)
        if official is not None:
            entry["official"] = (entry["official"] or 0.0) + official

    facts: list[ParsedFact] = []
    for slug, entry in merged.items():
        for year, value in entry["years"].items():
            facts.append(
                ParsedFact(
                    table="registration_facts",
                    metric_code="first_registrations",
                    value=value,
                    unit="vehicles",
                    reporting_period=period,
                    category_code=category,
                    brand_slug=slug,
                    brand_source=entry["canonical"],
                    vehicle_first_reg_year=year,
                )
            )
        total = entry["official"] if entry["official"] is not None else entry["by_columns"]
        facts.append(
            ParsedFact(
                table="registration_facts",
                metric_code="first_registrations",
                value=total,
                unit="vehicles",
                reporting_period=period,
                category_code=category,
                brand_slug=slug,
                brand_source=entry["canonical"],
                extra={
                    "rollup": "brand_month_total",
                    "total_source": "kokku_column" if entry["official"] is not None else "column_sum",
                    "column_sum": entry["by_columns"],
                    "older": entry["older"],
                    "source_rows": entry["sources"],
                },
            )
        )
    return facts


CATEGORY_HEADERS = {"KAT", "KATEG", "KATEGOORIA"}


def _parse_new_car_models(path: Path, xl, period: str) -> list[ParsedFact]:
    sheet = find_sheet(xl, "Sõidu-uus", "uus-sõidu")
    df = read_sheet(path, sheet)
    header_idx = None
    for idx, row in df.iterrows():
        values = [str(v).upper() if v is not None else "" for v in row.tolist()]
        if any(v in CATEGORY_HEADERS for v in values) and any("MARK" in v for v in values):
            header_idx = idx
            break
    if header_idx is None:
        return []
    header = [clean_text(v) or "" for v in df.iloc[header_idx].tolist()]
    # The first match: the list's own column, not the one of a table beside it
    # (09/2010 heads its list "Kategooria" and the pivot beside it "KAT").
    kat_col = next((i for i, v in enumerate(header) if v.upper() in CATEGORY_HEADERS), 0)
    mark_col = next((i for i, v in enumerate(header) if v.upper() == "MARK"), 1)
    model_col = next((i for i, v in enumerate(header) if "MUDEL" in v.upper()), 2)
    count_col = next((i for i, v in enumerate(header) if v.upper() in {"KOKKU", "ARV", "TOTAL"}), 6)
    # Only this list's own columns: 2024 leaflets put a pivot of the same cars
    # beside it, and its "Grand Total" must not end or feed this list.
    span = range(min(kat_col, mark_col, model_col), count_col + 1)
    facts: list[ParsedFact] = []
    eu = brand_source = model = None
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        labels = [cell.lower() for cell in (clean_text(row.iloc[i]) for i in span if i < len(row)) if cell]
        # The list ends at its total (KOKKU, Grand Total). The total can share a
        # row with stray cells of another listing (06/2024), so stop, don't skip.
        if any(is_total_label(label) for label in labels):
            break
        # Pivot layouts (05-12/2010) add per-brand and per-category subtotals.
        if any(label.endswith(" kokku") for label in labels):
            continue
        row_eu = clean_text(row.iloc[kat_col] if kat_col < len(row) else None)
        row_brand = clean_text(row.iloc[mark_col] if mark_col < len(row) else None)
        row_model = clean_text(row.iloc[model_col] if model_col < len(row) else None)
        # Pivot layouts print category, brand and model once per group.
        if row_eu:
            eu = row_eu
        if row_brand:
            brand_source, model = row_brand, row_model
        elif row_model:
            model = row_model
        value = to_number(row.iloc[count_col] if count_col < len(row) else None)
        # A count with no description at all is the list's unlabelled total
        # (2007-2017); a pivot continuation row always describes something.
        described = any(clean_text(row.iloc[i]) for i in span if i != count_col and i < len(row))
        if value is not None and not described:
            break
        if not brand_source or value is None:
            continue
        family, eu_code = canonical_category(eu or "M1")
        slug, canonical, _status = canonical_brand(brand_source)
        facts.append(
            ParsedFact(
                table="registration_facts",
                metric_code="new_vehicles",
                value=value,
                unit="vehicles",
                reporting_period=period,
                category_code=family or "passenger_car",
                eu_category=eu_code or eu,
                brand_slug=slug,
                brand_source=canonical,
                model_source=model,
            )
        )
    return facts


def _parse_aftermarket(path: Path, xl, period: str) -> list[ParsedFact]:
    sheet = find_sheet(xl, "Järelturg")
    df = read_sheet(path, sheet)
    header_idx = None
    for idx, row in df.iterrows():
        values = [str(v).upper() if v is not None else "" for v in row.tolist()]
        if any(v == "KAT" for v in values) and any(v == "MARK" or "MARK" in v for v in values):
            header_idx = idx
            break
    if header_idx is None:
        return []
    facts: list[ParsedFact] = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        eu = clean_text(row.iloc[1] if len(row) > 1 else None)
        brand_source = clean_text(row.iloc[2] if len(row) > 2 else None)
        model = clean_text(row.iloc[3] if len(row) > 3 else None)
        value = to_number(row.iloc[-1])
        if not brand_source or value is None:
            continue
        family, eu_code = canonical_category(eu)
        slug, canonical, _status = canonical_brand(brand_source)
        facts.append(
            ParsedFact(
                table="registration_facts",
                metric_code="ownership_transfers",
                value=value,
                unit="vehicles",
                reporting_period=period,
                category_code=family,
                eu_category=eu_code or eu,
                brand_slug=slug,
                brand_source=canonical,
                model_source=model,
            )
        )
    return facts


# Columns of the "Uued sõidukid" list (one row per vehicle, or per identical
# vehicles with a count). Header names changed over the years.
NEW_VEHICLE_COLUMNS = {
    "category": ("kategooria", "kat"),
    "county": ("maakond", "v.kas/om maako"),
    "gearbox": ("käigukasti tüüp", "kaigukasti_tyy", "käigukasti tüü"),
    "power": ("mootori võimsus", "mootori võimsu", "mootori_voimsu", "võimsus"),
    "colour": ("värv", "varv"),
    "count": ("arv", "kokku", "tk", "total", "summa kogusummast arv"),
}
# Engine power bands in kW; vehicles without a stated power are "unknown".
POWER_BANDS = [(0, 70, "0-70"), (70, 100, "71-100"), (100, 150, "101-150"), (150, 200, "151-200"), (200, 300, "201-300"), (300, 1e9, "over-300")]


def _new_vehicle_header(df) -> tuple[int, dict[str, int]] | None:
    """The last header row in the first lines: pivot layouts (2019) repeat it
    below a "Sum of Arv" line."""
    found = None
    for idx, row in df.head(12).iterrows():
        values = [(clean_text(v) or "").lower() for v in row.tolist()]
        if any(v in ("kategooria", "kat") for v in values) and "mark" in values:
            found = (idx, values)
    if found is None:
        return None
    idx, values = found
    columns: dict[str, int] = {}
    for name, labels in NEW_VEHICLE_COLUMNS.items():
        for i, value in enumerate(values):
            if any(value == label or value.startswith(label) for label in labels):
                columns.setdefault(name, i)
    return idx, columns


def _power_band(value: object) -> str:
    number = to_number(value)
    if number is None or number <= 0:
        return "unknown"
    return next(label for low, high, label in POWER_BANDS if low < number <= high or (low == 0 and number <= high))


def _parse_new_vehicle_breakdowns(path: Path, xl, period: str) -> list[ParsedFact]:
    """New vehicles by county, gearbox, power band and colour, one dimension at
    a time. Pivot layouts (10/2017, 01/2018, 03-04/2019) print a value once per
    group: leading blank cells inherit from the row above."""
    df = read_sheet(path, find_sheet(xl, "Uued sõidukid"))
    found = _new_vehicle_header(df)
    if not found:
        return []
    header_idx, columns = found
    if "category" not in columns:
        return []
    counts: dict[tuple[str, str, str], float] = {}
    previous: list = []
    for _, row in df.iloc[header_idx + 1 :].iterrows():
        cells = row.tolist()
        texts = [clean_text(v) for v in cells]
        if any(is_total_label(v) or (v or "").lower().endswith(" kokku") for v in texts if v):
            continue
        first = next((i for i, v in enumerate(texts) if v), None)
        if first is None:
            continue
        if previous and first > 0:
            cells = previous[:first] + cells[first:]
        previous = cells
        family = canonical_category(cells[columns["category"]])[0]
        if not family:
            continue
        number = 1.0 if "count" not in columns else to_number(cells[columns["count"]])
        if number is None:
            continue
        values = {
            "county": canonical_region(cells[columns["county"]])[0] or "unassigned" if "county" in columns else None,
            "gearbox": _code(cells[columns["gearbox"]]) if "gearbox" in columns else None,
            "power_band": _power_band(cells[columns["power"]]) if "power" in columns else None,
            "colour": _code(cells[columns["colour"]]) if "colour" in columns else None,
        }
        for dimension, value in values.items():
            if value is None:
                continue
            key = (family, dimension, value)
            counts[key] = counts.get(key, 0) + number
    return [
        ParsedFact(
            table="registration_facts",
            metric_code="new_vehicles",
            value=value,
            unit="vehicles",
            reporting_period=period,
            category_code=family,
            dimension=dimension,
            dimension_value=code,
            extra={"source_sheet": "uued_soidukid"},
        )
        for (family, dimension, code), value in counts.items()
    ]


def _code(value: object) -> str:
    """Source codes as stable lowercase ASCII keys, spelled the way the register
    writes Estonian without diacritics (KONSTANTNE_YLEKANNE, BEEZ, HOBEDANE).
    Empty and "(tühi)" are unknown."""
    text = clean_text(value)
    if not text:
        return "unknown"
    text = text.lower().replace("ü", "y").replace("õ", "o").replace("ä", "a").replace("ö", "o").replace("š", "s").replace("ž", "z")
    code = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return "unknown" if code in {"tyhi", "blank", "maaramata", ""} else code

