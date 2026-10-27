from __future__ import annotations

import re

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
    # The Infoleht general table counts light quadricycles (L6e) as mopeds and
    # heavy quadricycles (L7e) as motorcycles: per-code fuel rows grouped this
    # way match its Mopeedid / Mootorrattad columns in 169 of 177 months.
    "L6E": "moped",
    "L7E": "motorcycle",
    "T1": "tractor",
    "T2": "tractor",
    "T3": "tractor",
    "T4": "tractor",
    "T5": "tractor",
    "LM": "self_propelled",
    # Register codes (transpordiamet.ee/soidukite-ja-masinate-kategooriad):
    # G is the off-road variant of the same category, C1-C5 are tracked
    # tractors, MS1/MS2 snowmobiles and ATV-type off-road vehicles, R1-R4
    # trailers for tractors (a separate population from road trailers O1-O4).
    "M3G": "bus",
    "T4.1": "tractor",
    "T4.2": "tractor",
    "T4.3": "tractor",
    "C1": "tractor",
    "C2": "tractor",
    "C3": "tractor",
    "C4": "tractor",
    "C4.1": "tractor",
    "C4.2": "tractor",
    "C4.3": "tractor",
    "C5": "tractor",
    "MS1": "offroad",
    "MS2": "offroad",
    "R1A": "tractor_trailer",
    "R1B": "tractor_trailer",
    "R2A": "tractor_trailer",
    "R2B": "tractor_trailer",
    "R3A": "tractor_trailer",
    "R3B": "tractor_trailer",
    "R4A": "tractor_trailer",
    "R4B": "tractor_trailer",
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
    # Register general tables (2016-2018): "Auto haagis", "Traktori haagis(ed)".
    "autohaagis": "trailer",
    "traktorihaagis": "tractor_trailer",
    "traktorihaagised": "tractor_trailer",
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
    # Tractor speed classes: T1a / T1b (up to / over 40 km/h) are still T1.
    if re.fullmatch(r"[TC]\d(\.\d)?[AB]", eu) and eu[:-1] in EU_TO_FAMILY:
        return EU_TO_FAMILY[eu[:-1]], eu
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
