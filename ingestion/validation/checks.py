from __future__ import annotations

from dataclasses import dataclass

from ingestion.parsers.records import ParsedFact
from ingestion.validation.plausibility import is_plausible_stock


@dataclass
class CheckResult:
    code: str
    severity: str
    passed: bool
    details: str


def validate_facts(facts: list[ParsedFact], kind: str) -> list[CheckResult]:
    results: list[CheckResult] = []
    negatives = [f for f in facts if f.value < 0]
    results.append(
        CheckResult(
            "nonnegative",
            "error",
            not negatives,
            f"{len(negatives)} negative values" if negatives else "ok",
        )
    )
    missing_period = [
        f
        for f in facts
        if (f.table != "vehicle_fleet_facts" and not f.reporting_period)
        or (f.table == "vehicle_fleet_facts" and not f.snapshot_date)
    ]
    results.append(
        CheckResult(
            "period_present",
            "error",
            not missing_period,
            f"{len(missing_period)} facts without a period" if missing_period else "ok",
        )
    )
    if kind == "registrations":
        totals = [f for f in facts if f.metric_code == "first_registrations" and f.brand_slug is None and f.fuel_code is None]
        results.append(
            CheckResult(
                "category_totals_present",
                "warning" if not totals else "error",
                bool(totals),
                "üldtabel totals parsed" if totals else "no category totals",
            )
        )
    if kind in {"vehicle_fleet", "fleet_snapshot", "registrations"}:
        stock = [f for f in facts if f.table == "vehicle_fleet_facts" and not f.region_code and not f.age_band]
        by_cat: dict[tuple, float] = {}
        for fact in stock:
            key = (fact.snapshot_date, fact.category_code)
            by_cat[key] = by_cat.get(key, 0) + fact.value
        implausible = [f"{cat} {date}={value}" for (date, cat), value in by_cat.items() if not is_plausible_stock(cat, value)]
        results.append(
            CheckResult(
                "fleet_stock_plausibility",
                "error" if implausible and kind in {"vehicle_fleet", "fleet_snapshot"} else "warning",
                not implausible,
                "implausible national stock: " + "; ".join(implausible[:6]) if implausible else "ok",
            )
        )
    if kind == "inspections":
        national = [f for f in facts if f.metric_code == "inspections" and not f.station_code]
        results.append(
            CheckResult(
                "national_inspection_total",
                "error",
                bool(national),
                "national totals present" if national else "missing national rollup",
            )
        )
        # Station rows must add up to the source's own Kokku row. A gap means
        # rows were dropped or merged; more than 1 % blocks the import.
        gaps = []
        for fact in facts:
            if fact.station_code or fact.extra.get("source") != "kokku_row":
                continue
            official = fact.value
            station_sum = float(fact.extra.get("station_sum", 0.0))
            if official and abs(official - station_sum) / official > 0.01:
                gaps.append(f"{fact.population}/{fact.metric_code}: kokku {official:.0f} vs stations {station_sum:.0f}")
        results.append(
            CheckResult(
                "station_rows_reconcile",
                "error",
                not gaps,
                "; ".join(gaps[:4]) if gaps else "station rows match Kokku",
            )
        )
    return results
