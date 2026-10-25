from __future__ import annotations

from collections import defaultdict


CATEGORY_ET = {
    "passenger_car": "sõiduautod",
    "truck": "veoautod",
    "bus": "bussid",
    "trailer": "haagised",
    "motorcycle": "mootorrattad",
    "moped": "mopeedid",
    "offroad": "maastikusõidukid",
    "tractor": "traktorid",
}
CATEGORY_EN = {
    "passenger_car": "passenger cars",
    "truck": "trucks",
    "bus": "buses",
    "trailer": "trailers",
    "motorcycle": "motorcycles",
    "moped": "mopeds",
    "offroad": "off-road vehicles",
    "tractor": "tractors",
}


def build_insights(bundle: dict) -> list[dict]:
    insights: list[dict] = []
    insights.extend(_registration_insights(bundle["registrations"]))
    insights.extend(_inspection_insights(bundle["inspections"]))
    insights.extend(_fleet_insights(bundle["fleet"]))
    return insights


def _registration_insights(data: dict) -> list[dict]:
    by_period: dict[str, dict[str, float]] = defaultdict(dict)
    for row in data["totals"]:
        if row["metric_code"] == "first_registrations" and row["category_code"]:
            by_period[row["reporting_period"]][row["category_code"]] = row["value"]
    if not by_period:
        return []
    latest = max(by_period)
    cars = by_period[latest].get("passenger_car")
    items = []
    if cars is not None:
        new_row = next(
            (
                r
                for r in data["totals"]
                if r["reporting_period"] == latest
                and r["category_code"] == "passenger_car"
                and r["metric_code"] == "new_vehicles"
            ),
            None,
        )
        share = (new_row["value"] / cars * 100) if new_row and cars else None
        evidence = [
            {"metric": "first_registrations", "period": latest, "entity": "passenger_car", "value": cars, "unit": "vehicles"}
        ]
        if new_row:
            evidence.append(
                {
                    "metric": "new_vehicles",
                    "period": latest,
                    "entity": "passenger_car",
                    "value": new_row["value"],
                    "unit": "vehicles",
                }
            )
        items.append(
            _insight(
                "registreerimised",
                latest,
                "Esmaregistreerimised",
                f"{_fmt(cars)} sõiduauto esmast registreerimist {latest}. Uute osakaal {share:.1f}%."
                if share is not None
                else f"{_fmt(cars)} sõiduauto esmast registreerimist {latest}.",
                f"{_fmt(cars)} first passenger-car registrations in {latest}. New-vehicle share {share:.1f}%."
                if share is not None
                else f"{_fmt(cars)} first passenger-car registrations in {latest}.",
                evidence,
                title_en="First registrations",
            )
        )
    brands = [
        r
        for r in data["brands"]
        if r["reporting_period"] == latest and r["category_code"] == "passenger_car"
    ]
    brands.sort(key=lambda r: r["value"], reverse=True)
    if brands:
        top = brands[0]
        items.append(
            _insight(
                "registreerimised",
                latest,
                "Juhtiv mark",
                f"{top['brand_source']} oli {latest} kõige sagedasem esmaselt registreeritud sõiduautomark ({_fmt(top['value'])} sõidukit).",
                f"{top['brand_source']} led first passenger-car registrations in {latest} with {_fmt(top['value'])} vehicles.",
                [
                    {
                        "metric": "first_registrations",
                        "period": latest,
                        "entity": top["brand_source"],
                        "value": top["value"],
                        "unit": "vehicles",
                    }
                ],
                title_en="Leading brand",
            )
        )
    return items


def _inspection_insights(data: dict) -> list[dict]:
    by_period = defaultdict(dict)
    for row in data["national"]:
        if row["population"] == "vehicles":
            by_period[row["reporting_period"]][row["metric_code"]] = row["value"]
    if not by_period:
        return []
    latest = max(by_period)
    total = by_period[latest].get("inspections")
    repeat = by_period[latest].get("inspections_repeat")
    if total is None:
        return []
    share = (repeat / total * 100) if repeat is not None and total else None
    return [
        _insight(
            "ulevaatused",
            latest,
            "Ülevaatuste tulemused",
            f"{_fmt(total)} sõidukiülevaatust {latest}. Kordusülevaatusele suunati {share:.1f}%."
            if share is not None
            else f"{_fmt(total)} sõidukiülevaatust {latest}.",
            f"{_fmt(total)} vehicle inspections in {latest}. {share:.1f}% were directed to a repeat inspection."
            if share is not None
            else f"{_fmt(total)} vehicle inspections in {latest}.",
            [
                {"metric": "inspections", "period": latest, "entity": "vehicles", "value": total, "unit": "events"},
                *(
                    [
                        {
                            "metric": "inspections_repeat",
                            "period": latest,
                            "entity": "vehicles",
                            "value": repeat,
                            "unit": "events",
                        }
                    ]
                    if repeat is not None
                    else []
                ),
            ],
            title_en="Inspection outcomes",
        )
    ]


def _fleet_insights(data: dict) -> list[dict]:
    if not data["snapshots"]:
        return []
    latest = max(r["snapshot_date"] for r in data["snapshots"])
    buses = sum(
        r["value"]
        for r in data["snapshots"]
        if r["snapshot_date"] == latest and r["category_code"] == "bus"
    )
    if not buses:
        return []
    return [
        _insight(
            "soidukipark",
            latest,
            "Bussipark",
            f"Arvel olevate busside arv seisuga {latest}: {_fmt(buses)}. Allikas säilitab ka peatatud kanded, kui fail seda ütleb.",
            f"Buses in the register on {latest}: {_fmt(buses)}. Suspended records are kept when the source includes them.",
            [{"metric": "fleet_count", "period": latest, "entity": "bus", "value": buses, "unit": "vehicles"}],
            title_en="Bus fleet",
        )
    ]


def _insight(tab: str, period: str, title_et: str, body_et: str, body_en: str, evidence: list[dict], title_en: str | None = None) -> dict:
    return {
        "tab": tab,
        "period": period,
        "generationMode": "deterministic",
        "model": None,
        "title": {"et": title_et, "en": title_en or title_et},
        "body": {"et": body_et, "en": body_en},
        "evidence": evidence,
    }


def _fmt(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", " ")
