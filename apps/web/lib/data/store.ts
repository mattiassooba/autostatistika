// Server-side data store: loads the published bundle once per generation,
// indexes it, and serves the core payload and slices (see slices.ts).

import { loadBundle } from "./load";
import { encodeTable } from "./table";
import {
  MODEL_WINDOW_MONTHS,
  buildExplorerData,
  isSliceKey,
  type Catalog,
  type CorePayload,
  type SlicePayload,
} from "./slices";
import type { PublishedBundle } from "./types";
import { fleetDatesOf, registrationPeriodsOf } from "./views";

type Indexed = {
  generatedAt: string;
  core: CorePayload;
  brandsByCategory: Map<string, PublishedBundle["registrations"]["brands"]>;
  fuelsByPeriod: Map<string, PublishedBundle["registrations"]["fuels"]>;
  modelsByPeriod: Map<string, PublishedBundle["registrations"]["models"]>;
  fleetBrandsByDate: Map<string, PublishedBundle["fleet"]["brands"]>;
  regionsByDate: Map<string, PublishedBundle["fleet"]["regions"]>;
  stationsByPeriod: Map<string, PublishedBundle["inspections"]["stations"]>;
};

let indexed: Indexed | null = null;

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function periodsBy<T>(rows: T[], category: (row: T) => string | null, period: (row: T) => string): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const row of rows) {
    const c = category(row);
    if (!c) continue;
    (out[c] ??= new Set()).add(period(row));
  }
  return Object.fromEntries(Object.entries(out).map(([c, set]) => [c, [...set].sort()]));
}

function buildIndex(bundle: PublishedBundle): Indexed {
  const reg = bundle.registrations;
  const fleetBrandDates: Catalog["fleetBrandDates"] = {};
  const seen = new Set<string>();
  for (const row of bundle.fleet.brands) {
    if (!row.category_code) continue;
    const key = `${row.category_code}|${row.snapshot_date}|${row.complete !== false}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (fleetBrandDates[row.category_code] ??= []).push({ date: row.snapshot_date, complete: row.complete !== false });
  }
  for (const list of Object.values(fleetBrandDates)) list.sort((a, b) => a.date.localeCompare(b.date));

  const catalog: Catalog = {
    brandPeriods: periodsBy(reg.brands, (r) => r.category_code, (r) => r.reporting_period),
    fuelPeriods: periodsBy(reg.fuels, (r) => r.category_code, (r) => r.reporting_period),
    modelPeriods: periodsBy(reg.models, (r) => r.category_code, (r) => r.reporting_period),
    regionDates: periodsBy(bundle.fleet.regions, (r) => r.category_code, (r) => r.snapshot_date),
    fleetBrandDates,
    stationPeriods: [...new Set(bundle.inspections.stations.map((r) => r.reporting_period))].sort(),
  };

  const core: CorePayload = {
    generatedAt: bundle.generatedAt,
    disclaimer: bundle.disclaimer,
    insights: bundle.insights,
    catalog,
    fleetSources: bundle.fleet.sources ?? [],
    tables: {
      totals: encodeTable(reg.totals, ["reporting_period", "category_code", "metric_code", "value"]),
      snapshots: encodeTable(bundle.fleet.snapshots, ["snapshot_date", "category_code", "status_code", "value"]),
      ages: encodeTable(bundle.fleet.ages, ["snapshot_date", "category_code", "age_band", "value"]),
      national: encodeTable(bundle.inspections.national, ["reporting_period", "population", "metric_code", "value"]),
    },
  };

  return {
    generatedAt: bundle.generatedAt,
    core,
    brandsByCategory: group(reg.brands, (r) => r.category_code ?? ""),
    fuelsByPeriod: group(reg.fuels, (r) => r.reporting_period),
    modelsByPeriod: group(reg.models, (r) => r.reporting_period),
    fleetBrandsByDate: group(bundle.fleet.brands, (r) => r.snapshot_date),
    regionsByDate: group(bundle.fleet.regions, (r) => r.snapshot_date),
    stationsByPeriod: group(bundle.inspections.stations, (r) => r.reporting_period),
  };
}

async function store(): Promise<Indexed> {
  const bundle = await loadBundle();
  if (!indexed || indexed.generatedAt !== bundle.generatedAt) indexed = buildIndex(bundle);
  return indexed;
}

export async function getCore(): Promise<CorePayload> {
  return (await store()).core;
}

export async function getGeneration(): Promise<string> {
  return (await store()).generatedAt;
}

/** Every slice a view can ask for; the build writes one file per key. */
export async function allSliceKeys(): Promise<string[]> {
  const { core } = await store();
  const catalog = core.catalog;
  const data = buildExplorerData(core, []);
  const months = new Set([
    ...registrationPeriodsOf(data),
    ...Object.values(catalog.fuelPeriods).flat(),
    ...Object.values(catalog.modelPeriods).flat(),
  ]);
  const dates = new Set([
    ...fleetDatesOf(data),
    ...Object.values(catalog.regionDates).flat(),
    ...Object.values(catalog.fleetBrandDates).flatMap((list) => list.map((entry) => entry.date)),
  ]);
  return [
    ...Object.keys(catalog.brandPeriods).map((category) => `brands:${category}`),
    ...[...months].sort().map((period) => `month:${period}`),
    ...[...dates].sort().map((date) => `fleet:${date}`),
    ...catalog.stationPeriods.map((period) => `stations:${period}`),
  ].filter(isSliceKey);
}

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Build one slice. Unknown keys return null; valid keys with no rows return empty tables. */
export async function getSlice(key: string): Promise<SlicePayload | null> {
  const s = await store();
  const [kind, arg] = key.split(":");
  if (kind === "brands") {
    const rows = s.brandsByCategory.get(arg) ?? [];
    return {
      key,
      tables: { brands: encodeTable(rows, ["reporting_period", "category_code", "brand_slug", "brand_source", "value"]) },
    };
  }
  if (kind === "month") {
    const window = Array.from({ length: MODEL_WINDOW_MONTHS }, (_, i) => shiftMonth(arg, -i));
    const models = window.flatMap((period) => s.modelsByPeriod.get(period) ?? []);
    return {
      key,
      tables: {
        fuels: encodeTable(s.fuelsByPeriod.get(arg) ?? [], [
          "reporting_period",
          "category_code",
          "fuel_code",
          "fuel_source",
          "metric_code",
          "value",
        ]),
        models: encodeTable(models, ["reporting_period", "category_code", "brand_slug", "brand_source", "model_source", "value"]),
      },
    };
  }
  if (kind === "fleet") {
    return {
      key,
      tables: {
        fleetBrands: encodeTable(s.fleetBrandsByDate.get(arg) ?? [], [
          "snapshot_date",
          "category_code",
          "brand_slug",
          "brand_source",
          "value",
          "complete",
        ]),
        regions: encodeTable(s.regionsByDate.get(arg) ?? [], ["snapshot_date", "category_code", "region_code", "region_source", "value"]),
      },
    };
  }
  if (kind === "stations") {
    return {
      key,
      tables: {
        stations: encodeTable(s.stationsByPeriod.get(arg) ?? [], [
          "reporting_period",
          "population",
          "station_code",
          "station_name",
          "metric_code",
          "value",
        ]),
      },
    };
  }
  return null;
}
