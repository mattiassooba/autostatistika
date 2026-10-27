import zipfile
from pathlib import Path

from ingestion.discovery.opendata import local_name, register_resources
from ingestion.normalization.categories import canonical_category
from ingestion.normalization.regions import canonical_region
from ingestion.parsers.register import parse_register, register_members

HEADER = (
    "MARK;MUDEL;YLDINE_STAATUS;STAATUS;ESMANE_REG;EESTIS_ESMAREG;KATEGOORIA;ALAMKATEGOORIA;KERE_NIMETUS;KERETYYP;VARV;"
    "PIKKUS;LAIUS;KORGUS;TAISMASS;REG_MASS;TYHIMASS;HAAGIS_PIDURITEGA;HAAGIS_PIDURITETA;AUTORONGI_MASS;"
    "HAAKESEADME_KOORMUS;SUURIM_KIIRUS;HEITMENORM;SOIDUMYRA;MOOTORI_MAHT;MOOTORI_VOIMSUS;MOOTORI_TYYP;"
    "KAIGUKASTI_TYYP;HYBRIIDI_TYYP;KYTUSEKOMBINATSIOON;KYTUSE_TYYP;LISAKYTUS;CO2_NEDC;CO2_WLTP;"
    "KYTUSEKULU_KESK_NEDC;KYTUSEKULU_KESK_WLTP;ELEKTRILINE_SOIDUULATUS;UKSI;ISTEKOHTI;TYYP;TELGI_KOKKU;RATTAID;"
    "JUHTTELGI;VEOTELGI;VKOM_MAAKOND;VKOM_TYYP"
)
COLUMNS = HEADER.split(";")


def row(**values: str) -> str:
    return ";".join(values.get(column, "") for column in COLUMNS)


CARS = [
    row(MARK="TOYOTA", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="2024-10-02", KATEGOORIA="M1", VKOM_MAAKOND="Harju"),
    row(MARK="TOYOTA", YLDINE_STAATUS="PEATATUD", ESMANE_REG="2010-01-15", KATEGOORIA="M1G", VKOM_MAAKOND="Lääne-Viru"),
    row(MARK="ŠKODA", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="2023-10-01", KATEGOORIA="M1", VKOM_MAAKOND=""),
    row(MARK="SKODA", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="", KATEGOORIA="M1", VKOM_MAAKOND="Võru"),
]
OTHER = [
    row(MARK="CAN-AM", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="2020-05-05", KATEGOORIA="MS2", VKOM_MAAKOND="Tartu"),
    row(MARK="RESPO", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="2019-05-05", KATEGOORIA="O1", VKOM_MAAKOND="Tartu"),
    row(MARK="JOSKIN", YLDINE_STAATUS="REGISTREERITUD", ESMANE_REG="2015-05-05", KATEGOORIA="R3A", VKOM_MAAKOND="Hiiu"),
    row(MARK="OMAVALMISTATUD", YLDINE_STAATUS="PEATATUD", ESMANE_REG="1990-05-05", KATEGOORIA="TH", VKOM_MAAKOND="Hiiu"),
]


def write_csv(path: Path, rows: list[str]) -> Path:
    path.write_text("﻿" + "\n".join([HEADER, *rows]) + "\n", encoding="utf-8")
    return path


def by_grain(facts, grain):
    return [f for f in facts if f.extra["grain"] == grain]


def test_register_counts_reconcile(tmp_path: Path) -> None:
    facts = parse_register(write_csv(tmp_path / "ar_2026-10-01_M1+M1G.csv", CARS))
    brands = by_grain(facts, "brand")
    assert {f.snapshot_date for f in facts} == {"2026-10-01"}
    # Every row counts once towards the stock; status is the general status.
    assert sum(f.value for f in brands) == 4
    assert sum(f.value for f in brands if f.status_code == "suspended") == 1
    # ŠKODA and SKODA are one brand.
    assert sum(f.value for f in brands if f.brand_slug == "skoda") == 2
    regions = {f.region_code: f.value for f in by_grain(facts, "region")}
    assert regions == {"harju": 1, "laane-viru": 1, "unassigned": 1, "voru": 1}


def test_register_age_bands(tmp_path: Path) -> None:
    facts = parse_register(write_csv(tmp_path / "ar_2026-10-01_M1+M1G.csv", CARS))
    ages = {f.age_band: f.value for f in by_grain(facts, "age")}
    # 2024-10-02 is one day short of two full years; 2023-10-01 is exactly three.
    # A missing first-registration date gets no band.
    assert ages == {"0-2": 1, "3-5": 1, "over-10": 1}
    assert all(f.extra["age_basis"] == "first_registration" for f in by_grain(facts, "age"))


def test_register_categories(tmp_path: Path) -> None:
    facts = parse_register(write_csv(tmp_path / "ar_2026-10-01_muu.csv", OTHER))
    families = {f.category_code for f in by_grain(facts, "brand")}
    assert families == {"offroad", "trailer", "tractor_trailer", "unclassified"}


def test_register_zip_is_retroactive(tmp_path: Path) -> None:
    archive = tmp_path / "ar_2020-2023.zip"
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("ar_2020-01-01_M1+M1G.csv", "﻿" + "\n".join([HEADER, *CARS]))
        handle.writestr("ar_2021-01-01_muu.csv", "﻿" + "\n".join([HEADER, *OTHER]))
        handle.writestr("README.txt", "Hoiatus")
    assert [s for s, _ in register_members(archive)] == ["2020-01-01", "2021-01-01"]
    facts = parse_register(archive, retroactive=True)
    assert {f.snapshot_date for f in facts} == {"2020-01-01", "2021-01-01"}
    assert all(f.extra["retroactive"] for f in facts)


def test_catalogue_resources() -> None:
    dataset = {
        "distributions": [
            {"titleEt": "2026-10-01 M1+M1G", "accessUrls": ["https://pilv.transpordiamet.ee/s/x/download?path=%2F&files=ar_2026-10-01_M1%2BM1G.csv"]},
            {"titleEt": " 2026-01-01 muu", "accessUrls": ["https://andmed.eesti.ee/api/datasets/d/files/f/download-s3"]},
            {"titleEt": "Vanad aastad zip (2020-2023)", "accessUrls": ["https://pilv.transpordiamet.ee/s/x/download?path=%2F&files=ar_2020-2023.zip"]},
            # Same moment as 2023-01-01 in another layout: not used.
            {"titleEt": "kat M1 ja M1G 31.12.2022", "accessUrls": ["https://andmed.eesti.ee/api/datasets/d/files/g/download-s3"]},
            {"titleEt": "README", "accessUrls": ["https://andmed.eesti.ee/api/datasets/d/files/h/download-s3"]},
        ]
    }
    resources = register_resources(dataset)
    assert [r.title for r in resources] == ["ar_2020-2023.zip", "ar_2026-01-01_muu.csv", "ar_2026-10-01_M1+M1G.csv"]
    assert [local_name(r) for r in resources] == ["ar_2020-2023.zip", "ar_2026-01-01_muu.csv", "ar_2026-10-01_M1+M1G.csv"]
    assert resources[0].layout_hint == "register_zip_retroactive"
    assert resources[2].snapshot_date == "2026-10-01"


def test_register_codes_normalise() -> None:
    assert canonical_category("MS1")[0] == "offroad"
    assert canonical_category("C4.2")[0] == "tractor"
    assert canonical_category("R4B")[0] == "tractor_trailer"
    # Quadricycles: light (L6e) with mopeds, heavy (L7e) with motorcycles, as the source groups them.
    assert canonical_category("L6e")[0] == "moped"
    assert canonical_category("L7e")[0] == "motorcycle"
    assert canonical_category("TH")[0] is None
    # Speed-class suffixes (a: up to 40 km/h, b: over 40 km/h) keep the category.
    assert canonical_category("T1b") == ("tractor", "T1B")
    assert canonical_category("T4.3a")[0] == "tractor"
    assert canonical_region("Lääne-Viru")[0] == "laane-viru"
    assert canonical_region("Jõgeva")[0] == "jogevamaa"


def test_county_spellings() -> None:
    assert canonical_region("IDA-VIRUMAAKOND")[0] == "ida-viru"
    assert canonical_region("Põlva  Maakond")[0] == "polva"
