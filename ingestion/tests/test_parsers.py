from pathlib import Path

from ingestion.discovery.transpordiamet import DiscoveredResource
from ingestion.parsers.inspections import parse_inspections
from ingestion.parsers.registrations import parse_registrations

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "data" / "source-samples"


def test_modern_infoleht_totals() -> None:
    path = SAMPLES / "INFOLEHT-092026.xlsx"
    if not path.exists():
        return
    facts = parse_registrations(path, "2026-09")
    cars = next(
        f
        for f in facts
        if f.metric_code == "first_registrations"
        and f.category_code == "passenger_car"
        and f.brand_slug is None
        and f.fuel_code is None
    )
    assert cars.value == 3639
    new_cars = next(
        f
        for f in facts
        if f.metric_code == "new_vehicles"
        and f.category_code == "passenger_car"
        and f.brand_slug is None
        and f.fuel_code is None
    )
    assert new_cars.value == 1670
    used = next(
        f
        for f in facts
        if f.metric_code == "used_first_registrations" and f.category_code == "passenger_car"
    )
    assert used.value == 1969


def test_legacy_2006_totals() -> None:
    path = SAMPLES / "infoleht01-06.xls"
    if not path.exists():
        return
    facts = parse_registrations(path, "2006-01")
    cars = next(
        f
        for f in facts
        if f.metric_code == "first_registrations"
        and f.category_code == "passenger_car"
        and f.brand_slug is None
    )
    assert cars.value == 4345


def test_inspection_2019_national() -> None:
    path = SAMPLES / "kuuaruanne_2019_04.xls"
    if not path.exists():
        return
    facts = parse_inspections(path, "2019-04")
    national = next(
        f
        for f in facts
        if f.metric_code == "inspections" and f.population == "vehicles" and not f.station_code
    )
    assert national.value > 1000


def test_year_columns_are_not_months() -> None:
    path = SAMPLES / "INFOLEHT-092026.xlsx"
    if not path.exists():
        return
    facts = parse_registrations(path, "2026-09")
    skoda_years = [
        f
        for f in facts
        if f.brand_slug == "skoda"
        and f.metric_code == "first_registrations"
        and f.vehicle_first_reg_year is not None
    ]
    assert skoda_years
    assert all(f.reporting_period == "2026-09" for f in skoda_years)


def test_inspection_2010_splits_tractors() -> None:
    path = SAMPLES / "kuuaruanne_2010_01.xls"
    if not path.exists():
        return
    facts = parse_inspections(path, "2010-01")
    national = {
        (f.population, f.metric_code): f.value
        for f in facts
        if f.extra.get("rollup") == "national"
    }
    # The 2010 sheet holds a vehicles table and a tractors table. Each has its own Kokku.
    assert national[("vehicles", "inspections")] == 15090
    assert national[("vehicles", "inspections_repeat")] == 1030
    assert national[("tractors", "inspections")] == 432


def test_inspection_station_rows_reconcile() -> None:
    for name, period in (("kuuaruanne_2010_01.xls", "2010-01"), ("kuuaruanne_2019_04.xls", "2019-04")):
        path = SAMPLES / name
        if not path.exists():
            continue
        facts = parse_inspections(path, period)
        for population in ("vehicles", "tractors"):
            stations = [f for f in facts if f.station_code and f.population == population and f.metric_code == "inspections"]
            national = next(f for f in facts if f.extra.get("rollup") and f.population == population and f.metric_code == "inspections")
            assert len({f.station_code for f in stations}) == len(stations), "station codes must be unique"
            assert sum(f.value for f in stations) == national.value


def test_legacy_stock_tables_reconcile() -> None:
    """Age bands, counties and the stated total describe the same stock."""
    from collections import defaultdict

    from ingestion.parsers.fleet import parse_infoleht_stock

    path = SAMPLES / "infoleht01-10.xls"
    if not path.exists():
        return
    facts = parse_infoleht_stock(path, "2010-02-01")
    sums: dict[tuple, float] = defaultdict(float)
    for fact in facts:
        sums[(fact.category_code, fact.extra.get("grain"))] += fact.value
    assert sums[("passenger_car", "stock_total")] == 545672
    assert sums[("passenger_car", "age")] == 545672
    assert sums[("passenger_car", "region")] == 545672
    # The "all motor vehicles" aggregate row must not be attributed to buses.
    assert sums[("bus", "stock_total")] == 4098


def test_flow_sheets_are_never_stock() -> None:
    from ingestion.parsers.fleet import parse_infoleht_stock

    path = SAMPLES / "infoleht01-10.xls"
    if not path.exists():
        return
    facts = parse_infoleht_stock(path, "2010-02-01")
    tops = [f for f in facts if f.extra.get("grain") == "brand_top" and f.category_code == "passenger_car"]
    # "Enim arvel olevad sõiduautod" lists 20 brands; uus-sõidu (a flow) adds nothing.
    assert len(tops) == 20
    assert tops[0].brand_slug == "volkswagen" and tops[0].value == 69023
    assert not any(f.extra.get("grain") == "brand" for f in facts)


def test_brand_total_uses_source_kokku_and_merges_aliases() -> None:
    path = SAMPLES / "INFOLEHT-092026.xlsx"
    if not path.exists():
        return
    facts = parse_registrations(path, "2026-09")
    totals = {
        f.brand_slug: f.value
        for f in facts
        if f.extra.get("rollup") == "brand_month_total" and f.category_code == "passenger_car"
    }
    assert totals["bmw"] == 565  # includes the "Vanemad" column
    assert totals["volkswagen"] == 179 + 144  # "VOLKSWAGEN" + "VOLKSWAGEN, VW"


def test_duplicate_keys_are_summed() -> None:
    from ingestion.parsers.records import ParsedFact
    from ingestion.pipeline import merge_duplicate_facts

    a = ParsedFact("registration_facts", "first_registrations", 4, "vehicles", "2025-11", category_code="truck", eu_category="N3", fuel_code="gas", fuel_source="CNG")
    b = ParsedFact("registration_facts", "first_registrations", 2, "vehicles", "2025-11", category_code="truck", eu_category="N3", fuel_code="gas", fuel_source="LPG")
    merged = merge_duplicate_facts([a, b])
    assert len(merged) == 1 and merged[0].value == 6


def test_inspection_period_comes_from_report() -> None:
    path = SAMPLES / "kuuaruanne_2019_04.xls"
    if not path.exists():
        return
    facts = parse_inspections(path, "2021-01")  # a wrong hint from link text
    assert {f.reporting_period for f in facts} == {"2019-04"}


def test_discovery_prefers_explicit_report_name() -> None:
    from ingestion.discovery.transpordiamet import _period_from_text

    text = "jaanuari kuuaruanne /sites/default/files/documents/2021-02/kuuaruanne_2019_01.xls"
    assert _period_from_text(text) == "2019-01"


def test_later_county_layout_and_status_scope() -> None:
    """2011+ county sheets ("maakondade lõikes", "Harjumaa") reconcile with the
    stated stock; the 12/2014 leaflet states that suspended records are
    included and gives the registered-only count separately."""
    from collections import defaultdict

    from ingestion.parsers.fleet import parse_infoleht_stock

    path = ROOT / "data" / "downloads" / "registration_infoleht" / "infoleht-1214.xls"
    if not path.exists():
        return
    facts = parse_infoleht_stock(path, None)
    sums: dict[tuple, float] = defaultdict(float)
    for fact in facts:
        sums[(fact.category_code, fact.extra.get("grain"))] += fact.value
    assert sums[("passenger_car", "region")] == sums[("passenger_car", "stock_total")] == 652950
    assert sums[("passenger_car", "stock_registered")] == 552022
    total = next(f for f in facts if f.extra.get("grain") == "stock_total" and f.category_code == "passenger_car")
    assert total.extra["status_scope"] == "includes_suspended"
    assert {f.snapshot_date for f in facts} == {"2015-01-01"}


# --- Layout variants that once leaked totals or rank numbers into brand data ---

def _workbook(tmp_path: Path, sheets: dict[str, list[list[object]]]) -> Path:
    from openpyxl import Workbook

    book = Workbook()
    book.remove(book.active)
    for name, rows in sheets.items():
        sheet = book.create_sheet(name)
        for row in rows:
            sheet.append(row)
    path = tmp_path / "infoleht.xlsx"
    book.save(path)
    return path


TOP_TITLE = ["Liiklusregistris esmaselt registreeritud sõiduautod"]


def _top_brands(path: Path) -> dict[str, float]:
    from ingestion.parsers.excel import open_workbook
    from ingestion.parsers.registrations import _parse_brand_year_mix

    facts = _parse_brand_year_mix(path, open_workbook(path), "2024-08", "Esm_sõidu-TOP10", category="passenger_car")
    return {f.brand_slug: f.value for f in facts if f.extra.get("rollup") == "brand_month_total"}


def test_top_list_with_rank_column_reads_the_brand_column(tmp_path: Path) -> None:
    # 08/2024: a "jrkNr" rank column before "Mark".
    path = _workbook(
        tmp_path,
        {
            "Esm_sõidu-TOP10": [
                TOP_TITLE,
                [],
                ["jrkNr", "Mark", 2024, 2023, 2022, "Vanemad", "Kokku"],
                [1, "BMW", 53, 51, 26, 10, 140],
                [2, "SKODA", 288, 1, 6, 0, 295],
                ["kokku", None, 341, 52, 32, 10, 435],
            ]
        },
    )
    assert _top_brands(path) == {"bmw": 140, "skoda": 295}


def test_top_list_grand_total_row_is_not_a_brand(tmp_path: Path) -> None:
    # 07/2024: the total row says "Grand Total".
    path = _workbook(
        tmp_path,
        {
            "Esm_sõidu-TOP10": [
                TOP_TITLE,
                [],
                ["Mark", 2024, 2023, 2022, "Kokku"],
                ["SKODA", 339, 2, 4, 345],
                ["BMW", 40, 43, 20, 103],
                ["Grand Total", 379, 45, 24, 448],
            ]
        },
    )
    assert _top_brands(path) == {"skoda": 345, "bmw": 103}


def _models(path: Path) -> list[tuple[str, str | None, float]]:
    from ingestion.parsers.excel import open_workbook
    from ingestion.parsers.registrations import _parse_new_car_models

    return [(f.brand_slug, f.model_source, f.value) for f in _parse_new_car_models(path, open_workbook(path), "2024-06")]


MODEL_HEADER = ["KAT", "MARK", "MUDEL", "KERE NIMETUS", "KERETÜÜP", "MOOTORI_VOIMSUS", "KOKKU"]


def test_model_list_stops_at_its_total_beside_a_second_table(tmp_path: Path) -> None:
    # 06/2024: a pivot of the same cars sits in columns H+, and the left list's
    # KOKKU row shares a row with leftover cells of another listing.
    path = _workbook(
        tmp_path,
        {
            "Sõidu-uus": [
                ["Liiklusregistris esmaselt registreeritud uued sõiduautod"],
                [],
                [*MODEL_HEADER, "Kategooria", "Mark", "Mudel", "Kokku"],
                ["M1", "SUBARU", "OUTBACK", "UNIVERSAAL", "AC", 110, 313, "M1", "KIA", "EV6", 2],
                ["M1", "TOYOTA", "RAV4", "UNIVERSAAL", "AC", 81, 112, "M1", "LEXUS", "LBX", 2],
                ["M1G", "BMW", "X7 XDRIVE40D", "LUUKPÄRA", "AB", "KOKKU", 425, "M1", "MAZDA", "6", 2],
                ["M1G", "VOLVO", "XC60", "UNIVERSAAL", "AC", None, None, "Grand Total", "Total", "Total", 425],
            ]
        },
    )
    assert _models(path) == [("subaru", "OUTBACK", 313), ("toyota", "RAV4", 112)]


def test_model_list_grand_total_row_is_not_a_car(tmp_path: Path) -> None:
    # 07-08/2024: the list ends with "Grand Total | Total | ... | 1722".
    path = _workbook(
        tmp_path,
        {
            "Sõidu-uus": [
                ["Liiklusregistris esmaselt registreeritud uued sõiduautod"],
                [],
                MODEL_HEADER,
                ["M1", "AUDI", "A4 LIMOUSINE", "SEDAAN", "AA", 110, 1],
                ["M1G", "VOLVO", "XC90", "MITMEOTSTARBELINE", "AF", 228, 2],
                ["Grand Total", "Total", "Total", "Total", "Total", "Total", 3],
            ]
        },
    )
    assert _models(path) == [("audi", "A4 LIMOUSINE", 1), ("volvo", "XC90", 2)]


def test_pivot_model_list_fills_brand_and_model_down(tmp_path: Path) -> None:
    # 05-12/2010: an Excel pivot prints brand and model once per group and adds
    # "AUDI kokku" subtotals.
    path = _workbook(
        tmp_path,
        {
            "uus-sõidu": [
                ["Liiklusregistris esmaselt registreeritud uued sõiduautod"],
                [],
                ["Count of Arv"],
                ["Kat", "Mark", "Mudel", "Keretüüp", "Väljalaske aasta", "Mootori tüüp", "Total"],
                ["M1", "AUDI", "A3", "LUUKPÄRA", 2010, "Diisel", 1],
                [None, None, "A6", "SEDAAN", 2010, "Diisel", 3],
                [None, None, None, "UNIVERSAAL", 2010, "Diisel", 2],
                [None, "AUDI kokku", None, None, None, None, 6],
                [None, "BMW", "X1", "UNIVERSAAL", 2010, "Diisel", 1],
                [None, "BMW kokku", None, None, None, None, 1],
                ["M1 kokku", None, None, None, None, None, 7],
                ["KOKKU", None, None, None, None, None, 7],
            ]
        },
    )
    assert _models(path) == [("audi", "A3", 1), ("audi", "A6", 3), ("audi", "A6", 2), ("bmw", "X1", 1)]


def test_model_lists_reconcile_with_stated_new_cars() -> None:
    """Every downloaded leaflet whose model list once failed to add up."""
    folder = ROOT / "data" / "downloads" / "registration_infoleht"
    # file: (period, the list's own printed total)
    cases = {
        "infoleht05-10.xls": ("2010-05", 912),
        "infoleht09-2010.xls": ("2010-09", 969),
        "infoleht_12-2010.xls": ("2010-12", 764),
        "INFOLEHT-062024_statistika_esmased_ja_uued_0.xlsx": ("2024-06", 1820),
        "INFOLEHT-072024_statistika_esmased_ja_uued.xlsx": ("2024-07", 1882),
        "INFOLEHT-082024_statistika_esmased_ja_uued.xlsx": ("2024-08", 1722),
    }
    for name, (period, printed) in cases.items():
        path = folder / name
        if not path.exists():
            continue
        facts = parse_registrations(path, period)
        stated = next(
            f.value
            for f in facts
            if f.metric_code == "new_vehicles" and f.category_code == "passenger_car" and f.brand_slug is None and f.fuel_code is None
        )
        listed = sum(f.value for f in facts if f.model_source is not None and f.metric_code == "new_vehicles")
        assert listed == printed, f"{name}: models {listed} != list total {printed}"
        # 07/2024 lists one car fewer than its general table: within the site's 1 % rule.
        assert abs(listed - stated) <= stated * 0.01, f"{name}: models {listed} vs stated {stated}"
        assert not any(f.brand_slug and not any(c.isalpha() for c in f.brand_slug) for f in facts), name
        assert not any(f.brand_slug and ("total" in f.brand_slug or f.brand_slug.endswith("kokku")) for f in facts), name


def test_model_list_unlabelled_total_row_is_not_a_car(tmp_path: Path) -> None:
    # 2007-2017: the list ends with its total alone in the count column.
    path = _workbook(
        tmp_path,
        {
            "Sõidu-uus": [
                ["Liiklusregistris esmaselt registreeritud uued sõiduautod"],
                [],
                ["KAT", "MARK", "MUDEL", "KERETÜÜP", "MOOTORI VÕIMSUS", "Kokku"],
                ["M1", "PEUGEOT", "308", "UNIVERSAAL", 68, 72],
                ["M1G", "VOLVO", "XC60", "UNIVERSAAL", 224, 1],
                [None, None, None, None, None, 73],
            ]
        },
    )
    assert _models(path) == [("peugeot", "308", 72), ("volvo", "XC60", 1)]
