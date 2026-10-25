"""Inspection monthly reports (kuuaruanne_YYYY_MM.xls), 2010-2019.

Two layouts are known:

* 2010-style: one sheet. A vehicles table, a ``Kokku`` row, then a second header
  whose count column reads ``Traktoreid`` and a tractors table with its own
  ``Kokku``. Columns: Büroo, Punkt, Punkti nimi, TÜ arv, sh. Korras, sh.Kordus,
  Korraline TÜ, ...
* 2019-style: one sheet per population (``Sõidukid``, ``Traktorid``), a
  two-row header (``Ülevaatuseid`` over ``Kokku / Korras / Kordus``) and
  separate bureau and point code columns.

Columns are located by header text, never by position. Each table is read up
to its ``Kokku`` row. The ``Kokku`` row is the national figure; the station
rows are checked against it and the difference is reported on the rollup fact.
Station identity is bureau + point code (point codes repeat across bureaus in
the 2010 layout).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from ingestion.normalization.text import clean_text
from ingestion.parsers.excel import open_workbook, read_sheet, to_number
from ingestion.parsers.records import ParsedFact

MONTHS = {
    "jaanuar": "01",
    "veebruar": "02",
    "marts": "03",
    "aprill": "04",
    "mai": "05",
    "juuni": "06",
    "juuli": "07",
    "august": "08",
    "september": "09",
    "oktoober": "10",
    "november": "11",
    "detsember": "12",
}


def _fold(value: object) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    # xlrd sometimes yields replacement characters for legacy code pages.
    return text.replace("�", "").replace("�", "")


@dataclass
class Layout:
    header_row: int
    bureau: int | None
    point: int | None
    name: int
    total: int
    passed: int
    repeat: int
    periodic: int | None
    population: str


def parse_inspections(path: Path, reporting_period: str | None) -> list[ParsedFact]:
    xl = open_workbook(path)
    # The report's own "Periood:" line wins over file names and link text
    # (kuuaruanne_2019_01.xls was linked without a year).
    period = _period_from_content(path, xl) or reporting_period or _period_from_file(path, xl)
    if not period:
        raise ValueError(f"Could not determine inspection period for {path.name}")
    facts: list[ParsedFact] = []
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        sheet_population = "tractors" if "traktor" in _fold(sheet) else "vehicles"
        for layout in _find_layouts(df, sheet_population):
            facts.extend(_read_table(df, layout, period))
    return facts


def _period_from_content(path: Path, xl) -> str | None:
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        blob = _fold(" ".join(str(v) for v in df.iloc[:4].fillna("").to_numpy().ravel()))
        blob = re.sub(r"(\d)[\s ]+(\d{3})\b", r"\1\2", blob)  # "2 019" -> "2019"
        dates = re.search(r"\d{1,2}\.(\d{1,2})\.(20\d{2})", blob)
        if dates:
            return f"{dates.group(2)}-{int(dates.group(1)):02d}"
        month = next((number for name, number in MONTHS.items() if re.search(rf"\b{name}", blob)), None)
        year = re.search(r"(20\d{2})", blob)
        if month and year:
            return f"{year.group(1)}-{month}"
    return None


def _period_from_file(path: Path, xl) -> str | None:
    match = re.search(r"(20\d{2})[_-](\d{2})", path.name)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    for sheet in xl.sheet_names:
        df = read_sheet(path, sheet)
        blob = _fold(" ".join(str(v) for v in df.iloc[:4].to_numpy().ravel()))
        month = next((number for name, number in MONTHS.items() if name in blob), None)
        if month is None:
            dates = re.search(r"\d{2}\.(\d{2})\.(20\d{2})", blob)
            if dates:
                return f"{dates.group(2)}-{dates.group(1)}"
        year = re.search(r"(20\d{2})", blob)
        if month and year:
            return f"{year.group(1)}-{month}"
    return None


def _find_layouts(df, sheet_population: str) -> list[Layout]:
    layouts: list[Layout] = []
    rows = df.fillna("").astype(str).values.tolist()
    for idx, row in enumerate(rows):
        folded = [_fold(v) for v in row]
        has_name = any(("punkt" in v and "nimi" in v) or v.endswith("ulevaatuspunkt") for v in folded)
        if not has_name:
            continue
        nxt = [_fold(v) for v in rows[idx + 1]] if idx + 1 < len(rows) else []
        layout = _layout_from_header(folded, nxt, idx, sheet_population)
        if layout:
            layouts.append(layout)
    return layouts


def _layout_from_header(header: list[str], below: list[str], idx: int, sheet_population: str) -> Layout | None:
    def col(predicate) -> int | None:
        return next((i for i, v in enumerate(header) if v and predicate(v)), None)

    bureau = col(lambda v: v.startswith("buroo"))
    name = col(lambda v: ("punkt" in v and "nimi" in v) or (v.endswith("ulevaatuspunkt")))
    point = col(lambda v: v == "punkt" or ("punkt" in v and "kood" in v))
    population = "tractors" if any("traktor" in v for v in header) else sheet_population

    # 2010 style: single header row with explicit sub-columns.
    total = col(lambda v: v in {"tu arv", "tu  arv"} or v.startswith("tu arv"))
    if total is not None:
        passed = col(lambda v: "korras" in v)
        repeat = col(lambda v: "kordus" in v)
        periodic = col(lambda v: v.startswith("korraline"))
        if passed is None or repeat is None or name is None:
            return None
        return Layout(idx, bureau, point, name, total, passed, repeat, periodic, population)

    # Mid-2010 style: one header row, Kokku / Korras / Kordus / Korraline.
    total = col(lambda v: v == "kokku")
    if total is not None and name is not None:
        passed = col(lambda v: v == "korras")
        repeat = col(lambda v: v == "kordus")
        periodic = col(lambda v: v == "korraline")
        if passed is not None and repeat is not None:
            return Layout(idx, bureau, point, name, total, passed, repeat, periodic, population)

    # 2019 style: group header over Kokku / Korras / Kordus.
    group = col(lambda v: v.startswith("ulevaatuseid"))
    periodic_group = col(lambda v: v.startswith("korralisi"))
    if group is None or name is None or not below:
        return None

    def sub(start: int, label: str) -> int | None:
        for i in range(start, min(start + 4, len(below))):
            if below[i] == label:
                return i
        return None

    total = sub(group, "kokku")
    passed = sub(group, "korras")
    repeat = sub(group, "kordus")
    periodic = sub(periodic_group, "kokku") if periodic_group is not None else None
    if total is None or passed is None or repeat is None:
        return None
    return Layout(idx + 1, bureau, point, name, total, passed, repeat, periodic, population)


def _cell(row, index: int | None):
    if index is None or index >= len(row):
        return None
    return row.iloc[index]


def _read_table(df, layout: Layout, period: str) -> list[ParsedFact]:
    facts: list[ParsedFact] = []
    sums = {"inspections": 0.0, "inspections_pass": 0.0, "inspections_repeat": 0.0, "periodic_inspections": 0.0}
    has_periodic = layout.periodic is not None
    official: dict[str, float] | None = None
    current_bureau: str | None = None
    for _, row in df.iloc[layout.header_row + 1 :].iterrows():
        labels = " ".join(_fold(v) for v in row.tolist() if isinstance(v, str))
        if "kokku" in labels.split() or labels.startswith("kokku") or "kokku:" in labels:
            official = {
                "inspections": to_number(_cell(row, layout.total)) or 0.0,
                "inspections_pass": to_number(_cell(row, layout.passed)) or 0.0,
                "inspections_repeat": to_number(_cell(row, layout.repeat)) or 0.0,
            }
            if has_periodic:
                official["periodic_inspections"] = to_number(_cell(row, layout.periodic)) or 0.0
            break
        name = clean_text(_cell(row, layout.name))
        total = to_number(_cell(row, layout.total))
        if not name or total is None:
            continue
        bureau = clean_text(_cell(row, layout.bureau)) or current_bureau
        current_bureau = bureau
        point = clean_text(_cell(row, layout.point))
        code = f"{bureau or ''}-{point or ''}".strip("-") or name
        passed = to_number(_cell(row, layout.passed)) or 0.0
        repeat = to_number(_cell(row, layout.repeat)) or 0.0
        periodic = to_number(_cell(row, layout.periodic)) if has_periodic else None
        common = dict(
            table="inspection_facts",
            unit="events",
            reporting_period=period,
            population=layout.population,
            station_code=code,
            station_name=name,
            bureau_code=bureau,
        )
        facts.append(ParsedFact(metric_code="inspections", value=total, **common))
        facts.append(ParsedFact(metric_code="inspections_pass", value=passed, **common))
        facts.append(ParsedFact(metric_code="inspections_repeat", value=repeat, **common))
        sums["inspections"] += total
        sums["inspections_pass"] += passed
        sums["inspections_repeat"] += repeat
        if periodic is not None:
            facts.append(ParsedFact(metric_code="periodic_inspections", value=periodic, **common))
            sums["periodic_inspections"] += periodic

    national = official if official is not None else {k: v for k, v in sums.items() if v > 0}
    for metric, value in national.items():
        if metric == "periodic_inspections" and not has_periodic:
            continue
        facts.append(
            ParsedFact(
                table="inspection_facts",
                metric_code=metric,
                value=value,
                unit="events",
                reporting_period=period,
                population=layout.population,
                extra={
                    "rollup": "national",
                    "source": "kokku_row" if official is not None else "station_sum",
                    "station_sum": sums.get(metric, 0.0),
                },
            )
        )
    return facts
