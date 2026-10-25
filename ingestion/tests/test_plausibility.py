from ingestion.validation.plausibility import is_plausible_stock


def test_buses_cannot_be_a_million() -> None:
    assert is_plausible_stock("bus", 3643)
    assert is_plausible_stock("bus", 4150)
    assert not is_plausible_stock("bus", 1_203_356)


def test_missing_is_not_plausible() -> None:
    assert not is_plausible_stock("passenger_car", None)
    assert not is_plausible_stock("truck", -1)
