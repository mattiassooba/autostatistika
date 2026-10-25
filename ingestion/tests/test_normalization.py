from ingestion.normalization.brands import canonical_brand
from ingestion.normalization.categories import canonical_category
from ingestion.normalization.fuels import canonical_fuel


def test_volkswagen_alias() -> None:
    slug, name, status = canonical_brand("VOLKSWAGEN, VW")
    assert slug == "volkswagen"
    assert name == "VOLKSWAGEN"
    assert status == "mapped"


def test_skoda_chars() -> None:
    slug, name, status = canonical_brand("ŠKODA")
    assert slug == "skoda"
    assert name == "SKODA"
    assert status == "mapped"


def test_category_from_label() -> None:
    family, eu = canonical_category("Sõiduautod")
    assert family == "passenger_car"
    assert eu is None


def test_category_from_eu() -> None:
    family, eu = canonical_category("M1G")
    assert family == "passenger_car"
    assert eu == "M1G"


def test_fuel_hybrid() -> None:
    code, source, status = canonical_fuel("BENSIIN_HYBRIID")
    assert code == "petrol_hybrid"
    assert status == "mapped"
    assert source == "BENSIIN_HYBRIID"
