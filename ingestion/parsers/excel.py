from __future__ import annotations

from pathlib import Path

import re

import pandas as pd


_WORKBOOKS: dict[tuple[str, float], pd.ExcelFile] = {}
_SHEETS: dict[tuple[str, float, str], pd.DataFrame] = {}


def _key(path: Path) -> tuple[str, float]:
    return (str(Path(path).resolve()), Path(path).stat().st_mtime)


def open_workbook(path: Path) -> pd.ExcelFile:
    """Open a workbook once per file version; parsers read many sheets of the
    same file, and reopening a 2-3 MB legacy .xls per sheet dominates runtime."""
    key = _key(path)
    workbook = _WORKBOOKS.get(key)
    if workbook is None:
        if len(_WORKBOOKS) > 4:
            _WORKBOOKS.clear()
            _SHEETS.clear()
        suffix = Path(path).suffix.lower()
        engine = "openpyxl" if suffix in {".xlsx", ".xlsm"} else "xlrd"
        workbook = pd.ExcelFile(path, engine=engine)
        _WORKBOOKS[key] = workbook
    return workbook


def sheet_map(xl: pd.ExcelFile) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for name in xl.sheet_names:
        mapping[_norm(name)] = name
    return mapping


def _norm(name: str) -> str:
    return (
        name.lower()
        .replace("õ", "o")
        .replace("ä", "a")
        .replace("ö", "o")
        .replace("ü", "u")
        .replace("š", "s")
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
    )


def find_sheet(xl: pd.ExcelFile, *needles: str) -> str | None:
    mapping = sheet_map(xl)
    for needle in needles:
        key = _norm(needle)
        if key in mapping:
            return mapping[key]
        for existing, original in mapping.items():
            if key in existing:
                return original
    return None


def read_sheet(path: Path, sheet: str) -> pd.DataFrame:
    key = (*_key(path), sheet)
    frame = _SHEETS.get(key)
    if frame is None:
        frame = open_workbook(path).parse(sheet, header=None)
        _SHEETS[key] = frame
    return frame.copy()


def to_number(value: object) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    # Thousands are written with spaces, NBSP (2 012) or narrow NBSP.
    text = re.sub(r"[\s   ]", "", str(value)).replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def is_total_label(value: object) -> bool:
    text = str(value or "").strip().lower()
    return text in {"kokku", "total", "summa"} or text.startswith("kokku")
