from __future__ import annotations

from ingestion.normalization.text import clean_text

FUEL_MAP = {
    "BENSIIN": "petrol",
    "BENSIN": "petrol",
    "BENSIIN_KATALYSAATOR": "petrol_catalyst",
    "BENSIIN KAT.": "petrol_catalyst",
    "BENSIIN_HYBRIID": "petrol_hybrid",
    "DIISEL": "diesel",
    "DIISEL_HYBRIID": "diesel_hybrid",
    "ELEKTER": "electric",
    "CNG": "gas",
    "LPG": "gas",
    "GAAS": "gas",
}


def canonical_fuel(value: object) -> tuple[str | None, str | None, str]:
    source = clean_text(value)
    if source is None:
        return None, None, "missing"
    key = source.upper().replace("-", "_").replace(" ", "_")
    key = key.replace("__", "_")
    if key in FUEL_MAP:
        return FUEL_MAP[key], source, "mapped"
    compact = source.upper().replace(" ", "")
    for raw, code in FUEL_MAP.items():
        if raw.replace("_", "") == compact:
            return code, source, "mapped"
    return "other", source, "unmapped"
