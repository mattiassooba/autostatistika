from __future__ import annotations

from ingestion.normalization.text import clean_text, slugify

ALIASES = {
    "VOLKSWAGEN, VW": "VOLKSWAGEN",
    "VW": "VOLKSWAGEN",
    "ŠKODA": "SKODA",
    "SKODA": "SKODA",
    "MERCEDES BENZ": "MERCEDES-BENZ",
    "MERCEDES-BENZ": "MERCEDES-BENZ",
    "VAZ(LADA)": "LADA",
    "VAZ": "LADA",
    "LAND ROVER": "LAND-ROVER",
    "CITROËN": "CITROEN",
    "KIA MOTORS": "KIA",
    "SSANG YONG": "SSANGYONG",
    "ALFA-ROMEO": "ALFA ROMEO",
}


def canonical_brand(value: object) -> tuple[str | None, str | None, str]:
    source = clean_text(value)
    if source is None:
        return None, None, "missing"
    key = source.upper()
    if key in ALIASES:
        canonical = ALIASES[key]
        return slugify(canonical), canonical, "mapped"
    if key.replace(" ", "-") in {item.replace(" ", "-") for item in ALIASES.values()}:
        canonical = key
        return slugify(canonical), canonical, "canonical"
    return slugify(key), key, "canonical"
