from __future__ import annotations

# Estonia-scale ceilings. A legitimate national total above these is treated
# as a mixed-grain or misclassified parse, not published as a stock figure.
PLAUSIBLE_MAX = {
    "bus": 15_000,
    "passenger_car": 1_500_000,
    "truck": 400_000,
    "trailer": 400_000,
    "motorcycle": 150_000,
    "moped": 50_000,
    "offroad": 80_000,
    "tractor": 150_000,
    "self_propelled": 80_000,
    "l_other": 50_000,
}


def is_plausible_stock(category: str | None, value: float | None) -> bool:
    if value is None or value < 0:
        return False
    if not category:
        return value <= 2_000_000
    ceiling = PLAUSIBLE_MAX.get(category, 2_000_000)
    return value <= ceiling
