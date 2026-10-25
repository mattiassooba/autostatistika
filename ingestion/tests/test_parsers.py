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
