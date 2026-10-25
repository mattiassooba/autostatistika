from __future__ import annotations

from pathlib import Path

from ingestion.discovery.transpordiamet import DiscoveredResource
from ingestion.parsers.fleet import parse_fleet, parse_infoleht_stock
from ingestion.parsers.inspections import parse_inspections
from ingestion.parsers.records import ParsedFact
from ingestion.parsers.registrations import parse_registrations


def parse_workbook(path: Path, resource: DiscoveredResource) -> list[ParsedFact]:
    kind = resource.resource_kind
    if kind == "inspection_monthly":
        return parse_inspections(path, resource.reporting_period)
    if kind == "fleet_snapshot":
        return parse_fleet(path, resource.snapshot_date)
    if kind == "registration_infoleht":
        facts = parse_registrations(path, resource.reporting_period)
        # Legacy leaflets (2006-2013) also carry register stock tables.
        facts.extend(parse_infoleht_stock(path, resource.snapshot_date))
        return facts
    raise ValueError(f"Unsupported resource kind: {kind}")
