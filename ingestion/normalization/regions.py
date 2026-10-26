from __future__ import annotations

from ingestion.normalization.text import clean_text, slugify

COUNTY_ALIASES = {
    "HARJU MAAKOND": "harju",
    "HIIU MAAKOND": "hiiu",
    "IDA-VIRU MAAKOND": "ida-viru",
    "JÕGEVA MAAKOND": "jogevamaa",
    "JÄRVA MAAKOND": "jarva",
    "LÄÄNE MAAKOND": "laane",
    "LÄÄNE-VIRU MAAKOND": "laane-viru",
    "PÕLVA MAAKOND": "polva",
    "PÄRNU MAAKOND": "parnu",
    "RAPLA MAAKOND": "rapla",
    "SAARE MAAKOND": "saare",
    "TARTU MAAKOND": "tartu",
    "VALGA MAAKOND": "valga",
    "VILJANDI MAAKOND": "viljandi",
    "VÕRU MAAKOND": "voru",
    # 2011+ leaflets use the short "-maa" forms.
    "HARJUMAA": "harju",
    "HIIUMAA": "hiiu",
    "IDA-VIRUMAA": "ida-viru",
    "JÕGEVAMAA": "jogevamaa",
    "JÄRVAMAA": "jarva",
    "LÄÄNEMAA": "laane",
    "LÄÄNE-VIRUMAA": "laane-viru",
    "PÕLVAMAA": "polva",
    "PÄRNUMAA": "parnu",
    "RAPLAMAA": "rapla",
    "SAAREMAA": "saare",
    "TARTUMAA": "tartu",
    "VALGAMAA": "valga",
    "VILJANDIMAA": "viljandi",
    "VÕRUMAA": "voru",
    # Register snapshots (VKOM_MAAKOND) use the bare county name.
    "HARJU": "harju",
    "HIIU": "hiiu",
    "IDA-VIRU": "ida-viru",
    "JÕGEVA": "jogevamaa",
    "JÄRVA": "jarva",
    "LÄÄNE": "laane",
    "LÄÄNE-VIRU": "laane-viru",
    "PÕLVA": "polva",
    "PÄRNU": "parnu",
    "RAPLA": "rapla",
    "SAARE": "saare",
    "TARTU": "tartu",
    "VALGA": "valga",
    "VILJANDI": "viljandi",
    "VÕRU": "voru",
    # Vehicles without a county in the register.
    "MÄÄRAMATA": "unassigned",
}


def canonical_region(value: object) -> tuple[str | None, str | None, str]:
    source = clean_text(value)
    if source is None:
        return None, None, "missing"
    key = source.upper()
    if key.startswith("S.H.") or key.startswith("SH."):
        return None, source, "subtotal"
    if key in COUNTY_ALIASES:
        return COUNTY_ALIASES[key], source, "mapped"
    if "MAAKOND" in key:
        return slugify(source), source, "canonical"
    return None, source, "unmapped"
