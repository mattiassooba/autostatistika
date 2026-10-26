from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ParsedFact:
    table: str
    metric_code: str
    value: float
    unit: str
    reporting_period: str | None = None
    snapshot_date: str | None = None
    category_code: str | None = None
    eu_category: str | None = None
    brand_slug: str | None = None
    brand_source: str | None = None
    model_source: str | None = None
    fuel_code: str | None = None
    fuel_source: str | None = None
    vehicle_first_reg_year: int | None = None
    dimension: str | None = None
    dimension_value: str | None = None
    region_code: str | None = None
    region_source: str | None = None
    status_code: str | None = None
    age_band: str | None = None
    manufacture_year: int | None = None
    population: str | None = None
    station_code: str | None = None
    station_name: str | None = None
    bureau_code: str | None = None
    extra: dict = field(default_factory=dict)
