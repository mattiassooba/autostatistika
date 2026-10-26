// Filtering and aggregation for /otsing. Pure functions over decoded tables
// (lib/search/format.ts); no fetching here. Counts are vehicles: every row
// carries a "count" of identical vehicles, and a "variant" id that is the same
// in every file of a snapshot (same make, model, year, fuel, kW, gearbox, body).

import { numberAt, textAt, type Column, type Table } from "./format";

export type Range = [number | null, number | null];

/** Text dimensions a search can filter on; the light index has only some. */
export const TEXT_FILTERS = [
  "engine",
  "gearbox",
  "body",
  "status",
  "county",
  "colour",
  "owner",
  "euro",
  "hybrid",
  "fuel_combination",
  "status_detail",
  "category",
] as const;
export type TextFilter = (typeof TEXT_FILTERS)[number];

/** Number dimensions, in display units (kW, mm, kg, g/km, l/100 km …). */
export const NUMBER_FILTERS = [
  "year",
  "year_ee",
  "power",
  "engine_cc",
  "length",
  "width",
  "height",
  "mass_max",
  "mass_empty",
  "tow_braked",
  "top_speed",
  "co2_wltp",
  "co2_nedc",
  "cons_wltp",
  "cons_nedc",
  "ev_range",
  "seats",
  "doors",
  "axles",
] as const;
export type NumberFilter = (typeof NUMBER_FILTERS)[number];

export type SearchFilters = {
  family: string;
  makes: string[];
  models: string[];
  text: Partial<Record<TextFilter, string[]>>;
  ranges: Partial<Record<NumberFilter, Range>>;
};

export type Variant = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  engine: string;
  power: number | null;
  gearbox: string;
  body: string;
  vehicles: number;
};

export type Facet = Array<{ value: string; vehicles: number }>;

export type SearchResult = {
  vehicles: number;
  /** Vehicles that match every other filter but have no value for an active range. */
  missingForRange: number;
  facets: Partial<Record<"make" | "model" | TextFilter, Facet>>;
  years: Array<{ year: number; vehicles: number }>;
  powerBands: Array<{ band: string; vehicles: number }>;
  variants: Variant[];
};

export const POWER_BANDS: Array<[string, number, number]> = [
  ["0-70", 0, 70],
  ["71-100", 70, 100],
  ["101-150", 100, 150],
  ["151-200", 150, 200],
  ["201-300", 200, 300],
  ["over-300", 300, Infinity],
];

/** Power is stored in tenths of kW in the full files and as whole kW in the light index. */
function column(table: Table, name: string): Column | undefined {
  if (name === "power") return table.columns.power ?? table.columns.power_kw;
  return table.columns[name];
}

function active(range: Range | undefined): range is Range {
  return Boolean(range && (range[0] != null || range[1] != null));
}

/** True when a filter needs the makes' own files: the light index lacks that column. */
export function needsFullFiles(filters: SearchFilters, lite: Table): boolean {
  if (filters.models.length && !lite.columns.model) return true;
  for (const [key, values] of Object.entries(filters.text)) if (values?.length && !lite.columns[key]) return true;
  for (const [key, range] of Object.entries(filters.ranges)) if (active(range) && !column(lite, key)) return true;
  return false;
}

type Prepared = {
  checks: Array<{ data: Column["data"]; mask: Uint8Array }>;
  ranges: Array<{ col: Column; low: number; high: number }>;
};

function prepare(table: Table, filters: SearchFilters): Prepared {
  const checks: Prepared["checks"] = [];
  const add = (name: string, values: string[] | undefined) => {
    if (!values?.length) return;
    const col = table.columns[name];
    if (!col?.dict) {
      // A filter on a column this table lacks: nothing matches.
      checks.push({ data: new Uint8Array(table.rows), mask: new Uint8Array(1) });
      return;
    }
    const wanted = new Set(values);
    checks.push({ data: col.data, mask: Uint8Array.from(col.dict, (value) => (wanted.has(value) ? 1 : 0)) });
  };
  if (table.columns.family) add("family", [filters.family]);
  add("make", filters.makes);
  add("model", filters.models);
  for (const key of TEXT_FILTERS) add(key, filters.text[key]);
  const ranges: Prepared["ranges"] = [];
  for (const key of NUMBER_FILTERS) {
    const range = filters.ranges[key];
    const col = column(table, key);
    if (!active(range) || !col) continue;
    const scale = col.scale ?? 1;
    ranges.push({
      col,
      low: range[0] == null ? -Infinity : range[0] * scale - 1e-9,
      high: range[1] == null ? Infinity : range[1] * scale + 1e-9,
    });
  }
  return { checks, ranges };
}

/** Yields the rows that pass every filter, with their vehicle count; counts rows dropped for a missing range value. */
function scan(table: Table, filters: SearchFilters, visit: (row: number, n: number) => void): number {
  const { checks, ranges } = prepare(table, filters);
  const count = table.columns.count;
  let missing = 0;
  rows: for (let row = 0; row < table.rows; row += 1) {
    for (const check of checks) if (!check.mask[check.data[row]]) continue rows;
    const n = count ? count.data[row] : 1;
    for (const range of ranges) {
      const raw = range.col.data[row];
      if (raw === range.col.missing) {
        missing += n;
        continue rows;
      }
      if (raw < range.low || raw > range.high) continue rows;
    }
    visit(row, n);
  }
  return missing;
}

function addTo(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function facet(map: Map<string, number>): Facet {
  return [...map.entries()].map(([value, vehicles]) => ({ value, vehicles })).sort((a, b) => b.vehicles - a.vehicles || a.value.localeCompare(b.value));
}

// First row of each variant per table, built once per table.
const firstRows = new WeakMap<Table, Map<number, number>>();
function variantRow(table: Table, id: number): number {
  let map = firstRows.get(table);
  if (!map) {
    map = new Map();
    const ids = table.columns.variant.data;
    for (let row = 0; row < table.rows; row += 1) if (!map.has(ids[row])) map.set(ids[row], row);
    firstRows.set(table, map);
  }
  return map.get(id)!;
}

export function runSearch(tables: Table[], filters: SearchFilters): SearchResult {
  let vehicles = 0;
  let missingForRange = 0;
  const facetMaps = new Map<string, Map<string, number>>();
  const years = new Map<number, number>();
  const bandCounts = new Float64Array(POWER_BANDS.length + 1); // last slot: unknown
  const variantCounts = new Map<number, number>();
  const variantTable = new Map<number, number>();
  const facetKeys = ["make", "model", ...TEXT_FILTERS];

  tables.forEach((table, tableIndex) => {
    // Aggregate on dictionary codes and variant ids; text only per distinct value.
    const present = facetKeys.map((key) => table.columns[key]).filter((col): col is Column => Boolean(col?.dict));
    const facetCounts = present.map((col) => new Float64Array(col.dict!.length));
    const yearCol = table.columns.year;
    const yearCounts = new Map<number, number>();
    const powerCol = column(table, "power");
    const powerScale = powerCol?.scale ?? 1;
    const ids = table.columns.variant.data;
    const local = new Map<number, number>();
    missingForRange += scan(table, filters, (row, n) => {
      vehicles += n;
      for (let i = 0; i < present.length; i += 1) facetCounts[i][present[i].data[row]] += n;
      if (yearCol) {
        const raw = yearCol.data[row];
        if (raw !== yearCol.missing) yearCounts.set(raw, (yearCounts.get(raw) ?? 0) + n);
      }
      let band = POWER_BANDS.length;
      if (powerCol) {
        const raw = powerCol.data[row];
        const kw = raw / powerScale;
        if (raw !== powerCol.missing && kw > 0) {
          for (let b = 0; b < POWER_BANDS.length; b += 1) {
            if (kw > POWER_BANDS[b][1] && kw <= POWER_BANDS[b][2]) {
              band = b;
              break;
            }
          }
        }
      }
      bandCounts[band] += n;
      local.set(ids[row], (local.get(ids[row]) ?? 0) + n);
    });
    present.forEach((col, i) => {
      const map = facetMaps.get(col.name) ?? facetMaps.set(col.name, new Map()).get(col.name)!;
      facetCounts[i].forEach((n, code) => {
        if (n) addTo(map, col.dict![code], n);
      });
    });
    for (const [year, n] of yearCounts) years.set(year, (years.get(year) ?? 0) + n);
    for (const [id, n] of local) {
      variantCounts.set(id, (variantCounts.get(id) ?? 0) + n);
      if (!variantTable.has(id)) variantTable.set(id, tableIndex);
    }
  });

  const variants: Variant[] = [];
  for (const [id, n] of variantCounts) {
    const table = tables[variantTable.get(id)!];
    const row = variantRow(table, id);
    const power = numberAt(column(table, "power"), row);
    variants.push({
      id,
      make: textAt(table.columns.make, row),
      model: textAt(table.columns.model, row),
      year: numberAt(table.columns.year, row),
      engine: textAt(table.columns.engine, row),
      power: power == null ? null : Math.round(power),
      gearbox: textAt(table.columns.gearbox, row),
      body: textAt(table.columns.body, row),
      vehicles: n,
    });
  }

  const bandNames = [...POWER_BANDS.map(([band]) => band), "unknown"];
  return {
    vehicles,
    missingForRange,
    facets: Object.fromEntries([...facetMaps.entries()].map(([key, map]) => [key, facet(map)])),
    years: [...years.entries()].map(([year, n]) => ({ year, vehicles: n })).sort((a, b) => a.year - b.year),
    powerBands: bandNames.map((band, i) => ({ band, vehicles: bandCounts[i] })).filter((row) => row.vehicles > 0),
    variants,
  };
}

export type SortKey = "vehicles" | "year" | "power" | "name";

export function sortVariants(variants: Variant[], key: SortKey, dir: 1 | -1): Variant[] {
  const value = (v: Variant) => (key === "year" ? v.year : key === "power" ? v.power : v.vehicles);
  return [...variants].sort((a, b) => {
    if (key === "name") return dir * `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`) || b.vehicles - a.vehicles;
    const av = value(a);
    const bv = value(b);
    // Missing values sort last in both directions.
    if (av == null || bv == null) return av == null && bv == null ? b.vehicles - a.vehicles : av == null ? 1 : -1;
    return dir * (av - bv) || b.vehicles - a.vehicles;
  });
}

export type VariantDetail = {
  numbers: Record<string, { min: number; max: number; known: number }>;
  texts: Record<string, Facet>;
  vehicles: number;
};

const NOT_DETAIL = new Set(["count", "power_kw", "variant", "make", "model", "family"]);

/** Spec ranges and value counts over a variant's vehicles that match the filters (full files only). */
export function variantDetail(tables: Table[], filters: SearchFilters, id: number): VariantDetail {
  const numbers: VariantDetail["numbers"] = {};
  const texts = new Map<string, Map<string, number>>();
  let vehicles = 0;
  for (const table of tables) {
    const ids = table.columns.variant.data;
    const cols = Object.values(table.columns).filter((col) => !NOT_DETAIL.has(col.name));
    scan(table, filters, (row, n) => {
      if (ids[row] !== id) return;
      vehicles += n;
      for (const col of cols) {
        if (col.kind === "number") {
          const value = numberAt(col, row);
          if (value == null) continue;
          const entry = numbers[col.name];
          if (entry) {
            entry.min = Math.min(entry.min, value);
            entry.max = Math.max(entry.max, value);
            entry.known += n;
          } else {
            numbers[col.name] = { min: value, max: value, known: n };
          }
        } else {
          addTo(texts.get(col.name) ?? texts.set(col.name, new Map()).get(col.name)!, textAt(col, row), n);
        }
      }
    });
  }
  return { numbers, texts: Object.fromEntries([...texts.entries()].map(([key, map]) => [key, facet(map)])), vehicles };
}
