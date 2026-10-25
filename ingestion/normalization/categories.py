from __future__ import annotations

from ingestion.normalization.text import clean_text

EU_TO_FAMILY = {
    "M1": "passenger_car",
    "M1G": "passenger_car",
    "M2": "bus",
    "M3": "bus",
    "N1": "truck",
    "N1G": "truck",
    "N2": "truck",
    "N2G": "truck",
    "N3": "truck",
    "N3G": "truck",
    "O1": "trailer",
    "O2": "trailer",
    "O3": "trailer",
    "O4": "trailer",
    "L1E": "moped",
    "L2E": "moped",
    "L3E": "motorcycle",
    "L4E": "motorcycle",
    "L5E": "motorcycle",
    "L6E": "l_other",
    "L7E": "l_other",
    "T1": "tractor",
    "T2": "tractor",
    "T3": "tractor",
    "T4": "tractor",
    "T5": "tractor",
    "LM": "self_propelled",
}

LABEL_TO_FAMILY = {
    "sõiduautod": "passenger_car",
    "soiduautod": "passenger_car",
    "sõiduauto": "passenger_car",
    "veoautod": "truck",
    "veoauto": "truck",
    "bussid": "bus",
    "autobussid": "bus",
    "haagised": "trailer",
    "mootorrattad": "motorcycle",
    "mootorratas": "motorcycle",
    "mopeedid": "moped",
    "maastikusõidukid": "offroad",
    "maastikusoidukid": "offroad",
    "maastikuauto": "offroad",
    "traktorid": "tractor",
    "traktor": "tractor",
    "liikurmasinad": "self_propelled",
    "veesõidukid": "watercraft",
    "soiduauto": "passenger_car",
    "roomiktraktorid": "tractor",
    "buss": "bus",
    "haagis": "trailer",
    "mopeed": "moped",
    "maastikusõiduk": "offroad",
    "maastikusoiduk": "offroad",
    "liikurmasin": "self_propelled",
    "veesoidukid": "watercraft",
}


def family_from_eu(value: object) -> str | None:
    code = clean_text(value)
    if not code:
        return None
    return EU_TO_FAMILY.get(code.upper().replace(" ", ""))


def canonical_category(value: object) -> tuple[str | None, str | None]:
    text = clean_text(value)
    if not text:
        return None, None
    # "Traktor (sh roomik)" → "Traktor"; qualifiers never change the family.
    text = text.split("(")[0].strip() or text
    eu = text.upper().replace(" ", "")
    if eu in EU_TO_FAMILY:
        return EU_TO_FAMILY[eu], eu
    key = (
        text.lower()
        .replace("ä", "a")
        .replace("ö", "o")
        .replace("ü", "u")
        .replace("õ", "o")
        .replace("š", "s")
    )
    compact = key.replace(" ", "")
    if compact in LABEL_TO_FAMILY:
        return LABEL_TO_FAMILY[compact], None
    if key in LABEL_TO_FAMILY:
        return LABEL_TO_FAMILY[key], None
    return None, None
