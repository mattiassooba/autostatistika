// Data delivery contract between the build (lib/data/store.ts, app/data/) and
// the client explorer.
//
// * The core payload is always sent: totals, stock totals, national
//   inspection figures, age bands, insights and an availability catalogue.
// * Everything that grows with history and is only read for one selection is
//   a slice, fetched on demand and cached:
//     brands:<category>   brand top lists for every month of one category
//     month:<YYYY-MM>     fuel split for the month, new-car models for the
//                         12 months up to it (the models table trend)
//     fleet:<YYYY-MM-DD>  county split and brand lists for one stock date
//     stations:<YYYY-MM>  inspection stations for one month
//     ages:all            fleet age bands for every stock date (fleet tab only)
// Slices are merged into one ExplorerData; rows are deduplicated by their
// natural key, so overlapping slices never double count.

import type { ExplorerData, FleetSource, PublishedBundle, TabId } from "./types";
import { decodeTable, type EncodedTable } from "./table";

export type Catalog = {
  /** categories with brand top lists → months that have one */
  brandPeriods: Record<string, string[]>;
  fuelPeriods: Record<string, string[]>;
  modelPeriods: Record<string, string[]>;
  /** category → stock dates with a county split */
  regionDates: Record<string, string[]>;
  /** category → stock dates with brand rows, and whether the list is complete */
  fleetBrandDates: Record<string, Array<{ date: string; complete: boolean }>>;
  stationPeriods: string[];
};

export type CorePayload = {
  generatedAt: string;
  disclaimer: { et: string; en: string };
  insights: PublishedBundle["insights"];
  catalog: Catalog;
  fleetSources: FleetSource[];
  tables: {
    totals: EncodedTable;
    snapshots: EncodedTable;
    national: EncodedTable;
  };
};

export type SliceTable = "brands" | "fuels" | "models" | "fleetBrands" | "regions" | "stations" | "ages";

export type SlicePayload = {
  key: string;
  tables: Partial<Record<SliceTable, EncodedTable>>;
};

export type ExplorerDataWithCatalog = ExplorerData & { catalog: Catalog };

const SLICE_PATTERNS = [
  /^brands:[a-z_]{2,30}$/,
  /^month:\d{4}-\d{2}$/,
  /^fleet:\d{4}-\d{2}-\d{2}$/,
  /^stations:\d{4}-\d{2}$/,
  /^ages:all$/,
];

export function isSliceKey(key: string): boolean {
  return SLICE_PATTERNS.some((pattern) => pattern.test(key));
}

/** Digits of the bundle timestamp, e.g. 20261025150245. Versions the slice URLs. */
export function generationId(generatedAt: string): string {
  return generatedAt.replace(/\D/g, "").slice(0, 14);
}

/** Pre-built slice file: brands:passenger_car → /data/<generation>/brands/passenger_car.json */
export function sliceUrl(generatedAt: string, key: string): string {
  const [kind, arg] = key.split(":");
  return `/data/${generationId(generatedAt)}/${kind}/${arg}.json`;
}

export const MODEL_WINDOW_MONTHS = 12;

/** Slices the explorer needs to render one resolved view. */
export function requiredSlices(
  view: {
    tab: TabId;
    registrations: { category: string; period: string };
    fleet: { date: string };
    inspections: { period: string };
  },
  catalog: Catalog,
): string[] {
  const keys = new Set<string>(["brands:passenger_car"]);
  if (view.tab === "registreerimised") {
    if (catalog.brandPeriods[view.registrations.category]) keys.add(`brands:${view.registrations.category}`);
    if (view.registrations.period) keys.add(`month:${view.registrations.period}`);
  }
  if (view.tab === "soidukipark") keys.add("ages:all");
  if (view.tab === "soidukipark" && view.fleet.date) keys.add(`fleet:${view.fleet.date}`);
  if (view.tab === "ulevaatused" && view.inspections.period && catalog.stationPeriods.includes(view.inspections.period)) {
    keys.add(`stations:${view.inspections.period}`);
  }
  return [...keys].filter((key) => key !== "brands:passenger_car" || catalog.brandPeriods.passenger_car);
}

type Rows<K extends keyof ExplorerData["registrations"]> = ExplorerData["registrations"][K];

function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) seen.set(key(row), row);
  return [...seen.values()];
}

/** Decode the core and every loaded slice into one ExplorerData. */
export function buildExplorerData(core: CorePayload, slices: SlicePayload[]): ExplorerDataWithCatalog {
  const pick = <T,>(table: SliceTable) => slices.flatMap((slice) => decodeTable<T>(slice.tables[table]));
  const brands = dedupe(pick<Rows<"brands">[number]>("brands"), (r) => `${r.reporting_period}|${r.category_code}|${r.brand_slug}`);
  const fuels = dedupe(
    pick<Rows<"fuels">[number]>("fuels"),
    (r) => `${r.reporting_period}|${r.category_code}|${r.fuel_code}|${r.metric_code}`,
  );
  const models = dedupe(
    pick<Rows<"models">[number]>("models"),
    (r) => `${r.reporting_period}|${r.category_code}|${r.brand_slug}|${r.model_source}`,
  );
  const fleetBrands = dedupe(
    pick<ExplorerData["fleet"]["brands"][number]>("fleetBrands"),
    (r) => `${r.snapshot_date}|${r.category_code}|${r.brand_slug}|${r.complete}`,
  );
  const regions = dedupe(
    pick<ExplorerData["fleet"]["regions"][number]>("regions"),
    (r) => `${r.snapshot_date}|${r.category_code}|${r.region_code}`,
  );
  const stations = dedupe(
    pick<ExplorerData["inspections"]["stations"][number]>("stations"),
    (r) => `${r.reporting_period}|${r.population}|${r.station_code ?? r.station_name}|${r.metric_code}`,
  );
  return {
    generatedAt: core.generatedAt,
    disclaimer: core.disclaimer,
    insights: core.insights,
    catalog: core.catalog,
    registrations: {
      totals: decodeTable(core.tables.totals),
      brands,
      fuels,
      models,
    },
    fleet: {
      snapshots: decodeTable(core.tables.snapshots),
      brands: fleetBrands,
      regions,
      ages: dedupe(pick<ExplorerData["fleet"]["ages"][number]>("ages"), (r) => `${r.snapshot_date}|${r.category_code}|${r.age_band}`),
      sources: core.fleetSources,
    },
    inspections: {
      national: decodeTable(core.tables.national),
      stations,
    },
  };
}
