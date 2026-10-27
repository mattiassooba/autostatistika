// View models derived from the published bundle. Pure functions, no I/O, safe
// on server and client. Every derived share names its denominator in a comment.
// Missing stays null: a brand absent from a month's source top list is "not
// listed", never zero.

import type { ExplorerData, FleetSource } from "./types";
import type { Catalog } from "./slices";

const uniq = <T,>(items: T[]) => [...new Set(items)];

/*
 * Lazily built indexes, one per data object. With ~250 months of history the
 * naive filters (every month × every row) cost hundreds of millions of
 * comparisons per render; the indexes make each lookup a map read.
 */
type Index = {
  periods: string[];
  totals: Map<string, Map<string, Record<string, number>>>; // category → period → metric → value
  brands: Map<string, ExplorerData["registrations"]["brands"]>; // category|period
  fuels: Map<string, ExplorerData["registrations"]["fuels"]>; // category|period
  series: Map<string, RegistrationPoint[]>;
  rankings: Map<string, BrandRank[]>;
};
const indexes = new WeakMap<ExplorerData, Index>();

function indexOf(data: ExplorerData): Index {
  let index = indexes.get(data);
  if (index) return index;
  const totals = new Map<string, Map<string, Record<string, number>>>();
  const periodSet = new Set<string>();
  for (const row of data.registrations.totals) {
    periodSet.add(row.reporting_period);
    if (!row.category_code) continue;
    let byPeriod = totals.get(row.category_code);
    if (!byPeriod) totals.set(row.category_code, (byPeriod = new Map()));
    const metrics = byPeriod.get(row.reporting_period) ?? {};
    metrics[row.metric_code] = row.value;
    byPeriod.set(row.reporting_period, metrics);
  }
  const group = <T extends { category_code: string | null; reporting_period: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = `${row.category_code}|${row.reporting_period}`;
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return map;
  };
  index = {
    periods: [...periodSet].sort(),
    totals,
    brands: group(data.registrations.brands),
    fuels: group(data.registrations.fuels),
    series: new Map(),
    rankings: new Map(),
  };
  indexes.set(data, index);
  return index;
}

/** Availability catalogue when the data came through slices (see slices.ts). */
function catalogOf(data: ExplorerData): Catalog | undefined {
  return (data as ExplorerData & { catalog?: Catalog }).catalog;
}

/* ------------------------------------------------------------------ */
/* Registrations                                                        */
/* ------------------------------------------------------------------ */

export type RegistrationPoint = {
  period: string;
  first: number | null;
  neu: number | null;
  used: number | null;
  privateNew: number | null;
  newShare: number | null; // new / first, same category and month
};

export function registrationPeriodsOf(data: ExplorerData): string[] {
  return indexOf(data).periods;
}

const CATEGORY_ORDER = [
  "passenger_car",
  "truck",
  "bus",
  "trailer",
  "motorcycle",
  "moped",
  "offroad",
  "tractor",
  "self_propelled",
  "l_other",
  "tractor_trailer",
  "unclassified",
];

export function sortCategories(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function registrationCategoriesOf(data: ExplorerData): string[] {
  return sortCategories(
    uniq(
      data.registrations.totals
        .map((row) => row.category_code)
        .filter((code): code is string => Boolean(code)),
    ),
  );
}

export function registrationSeries(data: ExplorerData, category: string): RegistrationPoint[] {
  const index = indexOf(data);
  const cached = index.series.get(category);
  if (cached) return cached;
  const byPeriod = index.totals.get(category);
  const series = index.periods.map((period) => {
    const metrics = byPeriod?.get(period);
    const get = (metric: string) => metrics?.[metric] ?? null;
    const first = get("first_registrations");
    const neu = get("new_vehicles");
    const used = get("used_first_registrations");
    return {
      period,
      first,
      neu,
      used,
      privateNew: get("new_private_owner"),
      newShare: first && neu != null ? (neu / first) * 100 : null,
    };
  });
  index.series.set(category, series);
  return series;
}

/** Categories present in a month with their first registrations. */
export function categoryMix(data: ExplorerData, period: string) {
  return sortCategories(registrationCategoriesOf(data))
    .map((category) => {
      const point = registrationSeries(data, category).find((row) => row.period === period);
      return { category, first: point?.first ?? null, neu: point?.neu ?? null, used: point?.used ?? null };
    })
    .filter((row) => row.first != null);
}

export function brandCategoriesOf(data: ExplorerData): string[] {
  const catalog = catalogOf(data);
  if (catalog) return sortCategories(Object.keys(catalog.brandPeriods));
  return sortCategories(
    uniq(
      data.registrations.brands
        .map((row) => row.category_code)
        .filter((code): code is string => Boolean(code)),
    ),
  );
}

export function brandPeriodsOf(data: ExplorerData, category: string): string[] {
  const catalog = catalogOf(data);
  if (catalog) return catalog.brandPeriods[category] ?? [];
  return uniq(
    data.registrations.brands
      .filter((row) => row.category_code === category)
      .map((row) => row.reporting_period),
  ).sort();
}

export type BrandRank = {
  slug: string;
  name: string;
  value: number;
  share: number | null; // brand first registrations / category first registrations, same month
  rank: number;
};

export function brandRanking(data: ExplorerData, category: string, period: string): BrandRank[] {
  const index = indexOf(data);
  const key = `${category}|${period}`;
  const cached = index.rankings.get(key);
  if (cached) return cached;
  const total = index.totals.get(category)?.get(period)?.first_registrations ?? null;
  const ranking = [...(index.brands.get(key) ?? [])]
    .sort((a, b) => b.value - a.value || a.brand_slug.localeCompare(b.brand_slug))
    .map((row, position) => ({
      slug: row.brand_slug,
      name: row.brand_source,
      value: row.value,
      share: total ? (row.value / total) * 100 : null,
      rank: position + 1,
    }));
  index.rankings.set(key, ranking);
  return ranking;
}

export type BrandHistory = {
  slug: string;
  name: string;
  points: Array<{ period: string; value: number | null; share: number | null; rank: number | null }>;
};

export function brandHistory(data: ExplorerData, category: string, slugs: string[]): BrandHistory[] {
  const periods = brandPeriodsOf(data, category);
  const rankings = new Map(periods.map((period) => [period, brandRanking(data, category, period)]));
  return slugs.map((slug) => {
    // The name as the source writes it for this category (the same slug can be listed under trucks too).
    const name =
      data.registrations.brands.find((row) => row.brand_slug === slug && row.category_code === category)?.brand_source ??
      slug.toUpperCase();
    return {
      slug,
      name,
      points: periods.map((period) => {
        const hit = rankings.get(period)?.find((row) => row.slug === slug);
        return {
          period,
          value: hit?.value ?? null,
          share: hit?.share ?? null,
          rank: hit?.rank ?? null,
        };
      }),
    };
  });
}

/** The brand comparison window: months from `from` (null = every month) and the brands' points in them. */
export function brandWindow(data: ExplorerData, category: string, brands: string[], from: string | null) {
  const all = brandPeriodsOf(data, category);
  const periods = from ? all.filter((period) => period >= from) : all;
  const full = brandHistory(data, category, brands);
  const history = from ? full.map((brand) => ({ ...brand, points: brand.points.filter((point) => point.period >= from) })) : full;
  return { periods, history };
}

/** Every brand that appears in any month for a category, by its best showing. */
export function brandUniverse(data: ExplorerData, category: string) {
  const map = new Map<string, { slug: string; name: string; best: number; months: number }>();
  for (const row of data.registrations.brands) {
    if (row.category_code !== category) continue;
    const entry = map.get(row.brand_slug) ?? { slug: row.brand_slug, name: row.brand_source, best: 0, months: 0 };
    entry.best = Math.max(entry.best, row.value);
    entry.months += 1;
    map.set(row.brand_slug, entry);
  }
  return [...map.values()].sort((a, b) => b.best - a.best);
}

export type FuelMixRow = {
  code: string;
  first: number;
  neu: number | null;
  used: number | null; // first − new for the same fuel, when both exist
  share: number | null; // fuel first registrations / sum of listed fuels
};

export function fuelPeriodsOf(data: ExplorerData, category: string): string[] {
  const catalog = catalogOf(data);
  if (catalog) return catalog.fuelPeriods[category] ?? [];
  return uniq(
    data.registrations.fuels.filter((row) => row.category_code === category).map((row) => row.reporting_period),
  ).sort();
}

export function fuelMix(data: ExplorerData, category: string, period: string): FuelMixRow[] {
  // Several source labels can map to one code (CNG and LPG → gas), so sum by code.
  const acc = new Map<string, { first: number | null; neu: number | null }>();
  for (const row of indexOf(data).fuels.get(`${category}|${period}`) ?? []) {
    const entry = acc.get(row.fuel_code) ?? { first: null, neu: null };
    if (row.metric_code === "first_registrations") entry.first = (entry.first ?? 0) + row.value;
    if (row.metric_code === "new_vehicles") entry.neu = (entry.neu ?? 0) + row.value;
    acc.set(row.fuel_code, entry);
  }
  const rows = [...acc.entries()]
    .filter(([, value]) => value.first != null)
    .map(([code, value]) => ({
      code,
      first: value.first as number,
      neu: value.neu,
      used: value.neu != null ? (value.first as number) - value.neu : null,
    }));
  const total = rows.reduce((sum, row) => sum + row.first, 0);
  return rows
    .map((row) => ({ ...row, share: total ? (row.first / total) * 100 : null }))
    .sort((a, b) => b.first - a.first);
}

export type ModelRowView = {
  key: string;
  brandSlug: string;
  brand: string;
  model: string;
  value: number;
  brandShare: number | null; // model / sum of listed models of the same brand, same month
  history: Array<{ period: string; value: number | null }>;
};

export function modelPeriodsOf(data: ExplorerData, category: string): string[] {
  const catalog = catalogOf(data);
  if (catalog) return catalog.modelPeriods[category] ?? [];
  return uniq(
    data.registrations.models.filter((row) => row.category_code === category).map((row) => row.reporting_period),
  ).sort();
}

/** Model rows for a month; history covers that month and up to 11 before it. */
export function modelRows(data: ExplorerData, category: string, period: string): ModelRowView[] {
  const periods = modelPeriodsOf(data, category).filter((p) => p <= period).slice(-12);
  const rows = data.registrations.models.filter(
    (row) => row.category_code === category && row.reporting_period === period,
  );
  const brandTotals = new Map<string, number>();
  for (const row of rows) brandTotals.set(row.brand_slug, (brandTotals.get(row.brand_slug) ?? 0) + row.value);
  const index = new Map<string, number>();
  for (const row of data.registrations.models) {
    if (row.category_code !== category) continue;
    const key = `${row.reporting_period}|${row.brand_slug}|${row.model_source}`;
    index.set(key, (index.get(key) ?? 0) + row.value);
  }
  // Collapse duplicates within the month (same brand + model on several source rows).
  const merged = new Map<string, ModelRowView>();
  for (const row of rows) {
    const key = `${row.brand_slug}|${row.model_source}`;
    const existing = merged.get(key);
    if (existing) {
      existing.value += row.value;
      continue;
    }
    merged.set(key, {
      key,
      brandSlug: row.brand_slug,
      brand: row.brand_source,
      model: row.model_source,
      value: row.value,
      brandShare: null,
      history: periods.map((p) => ({
        period: p,
        value: index.get(`${p}|${row.brand_slug}|${row.model_source}`) ?? null,
      })),
    });
  }
  return [...merged.values()]
    .map((row) => {
      const total = brandTotals.get(row.brandSlug);
      return { ...row, brandShare: total ? (row.value / total) * 100 : null };
    })
    .sort((a, b) => b.value - a.value || a.model.localeCompare(b.model));
}

/* ------------------------------------------------------------------ */
/* Fleet (stocks). Snapshots are never added across dates.             */
/* ------------------------------------------------------------------ */

export function fleetDatesOf(data: ExplorerData): string[] {
  return uniq(data.fleet.snapshots.map((row) => row.snapshot_date)).sort();
}

export function fleetCategoriesAt(data: ExplorerData, date: string): string[] {
  return sortCategories(
    uniq(
      data.fleet.snapshots
        .filter((row) => row.snapshot_date === date)
        .map((row) => row.category_code)
        .filter((code): code is string => Boolean(code)),
    ),
  );
}

export function fleetValue(data: ExplorerData, date: string, category: string) {
  const rows = data.fleet.snapshots.filter((row) => row.snapshot_date === date && row.category_code === category);
  if (!rows.length) return null;
  return {
    value: rows.reduce((sum, row) => sum + row.value, 0),
    statuses: rows
      .filter((row) => row.status_code)
      .map((row) => ({ status: row.status_code as string, value: row.value })),
    mixedStatus: rows.some((row) => row.status_code && row.status_code !== "registered"),
  };
}

/** Where a stock date comes from: the open register files (2020+) or the Infoleht tables. */
export function fleetSourceOf(data: ExplorerData, date: string): FleetSource | null {
  return data.fleet.sources?.find((row) => row.snapshot_date === date) ?? null;
}

/** The same category across every snapshot date (stocks compared, not summed). */
export function fleetHistory(data: ExplorerData, category: string) {
  return fleetDatesOf(data)
    .map((date) => ({ date, value: fleetValue(data, date, category)?.value ?? null }))
    .filter((row) => row.value != null) as Array<{ date: string; value: number }>;
}

export function fleetComposition(data: ExplorerData, date: string) {
  return fleetCategoriesAt(data, date).map((category) => ({
    category,
    value: fleetValue(data, date, category)?.value ?? 0,
  }));
}

export function fleetRegions(data: ExplorerData, date: string, category: string) {
  const rows = data.fleet.regions.filter((row) => row.snapshot_date === date && row.category_code === category);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .map((row) => ({
      code: row.region_code,
      name: row.region_source,
      value: row.value,
      share: total ? (row.value / total) * 100 : null, // county / sum of county rows, same date
    }))
    .sort((a, b) => b.value - a.value);
}

export const AGE_ORDER = ["0-2", "3-5", "6-10", "over-10"];

export function fleetAges(data: ExplorerData, category: string) {
  const dates = uniq(
    data.fleet.ages.filter((row) => row.category_code === category).map((row) => row.snapshot_date),
  ).sort();
  return dates.map((date) => {
    const rows = data.fleet.ages.filter((row) => row.snapshot_date === date && row.category_code === category);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return {
      date,
      total,
      bands: AGE_ORDER.map((band) => {
        const value = rows.find((row) => row.age_band === band)?.value ?? null;
        return { band, value, share: value != null && total ? (value / total) * 100 : null };
      }),
    };
  });
}

export type FleetBrandView = {
  rows: Array<{ slug: string; name: string; value: number; share: number | null }>;
  /** complete: a full split; top: the source's top list; none: nothing usable. */
  kind: "complete" | "top" | "none";
  reconciles: boolean;
  brandSum: number;
  stock: number | null;
};

/**
 * Brand rows for a snapshot.
 *
 * * Complete splits (bus register files) are shown when they reconcile with
 *   the stock (90-110 %); share = brand / sum of brand rows.
 * * Top lists ("enim arvel olevad") are shown as such; share = brand / the
 *   snapshot stock, and the remainder is stated as not listed, never drawn.
 */
export function fleetBrands(data: ExplorerData, date: string, category: string): FleetBrandView {
  const all = data.fleet.brands.filter((row) => row.snapshot_date === date && row.category_code === category);
  const stockValue = fleetValue(data, date, category)?.value ?? null;
  const top = all.filter((row) => row.complete === false);
  const completeRows = all.filter((row) => row.complete !== false);
  if (!completeRows.length && top.length) {
    const rows = top
      .map((row) => ({
        slug: row.brand_slug,
        name: row.brand_source,
        value: row.value,
        share: stockValue ? (row.value / stockValue) * 100 : null,
      }))
      .sort((a, b) => b.value - a.value);
    return { rows, kind: "top", reconciles: true, brandSum: rows.reduce((sum, row) => sum + row.value, 0), stock: stockValue };
  }
  const raw = completeRows;
  const merged = new Map<string, { slug: string; name: string; value: number }>();
  for (const row of raw) {
    const entry = merged.get(row.brand_slug) ?? { slug: row.brand_slug, name: row.brand_source, value: 0 };
    entry.value += row.value;
    merged.set(row.brand_slug, entry);
  }
  const brandSum = [...merged.values()].reduce((sum, row) => sum + row.value, 0);
  const stock = stockValue;
  const reconciles = stock != null && brandSum > 0 && brandSum / stock >= 0.9 && brandSum / stock <= 1.1;
  return {
    kind: merged.size ? "complete" : "none",
    rows: [...merged.values()]
      .map((row) => ({ ...row, share: brandSum ? (row.value / brandSum) * 100 : null }))
      .sort((a, b) => b.value - a.value),
    reconciles,
    brandSum,
    stock,
  };
}

/* ------------------------------------------------------------------ */
/* Inspections (events at stations)                                     */
/* ------------------------------------------------------------------ */

export function inspectionPeriodsOf(data: ExplorerData): string[] {
  return uniq(data.inspections.national.map((row) => row.reporting_period)).sort();
}

export function inspectionPopulationsAt(data: ExplorerData, period: string): string[] {
  const order = ["vehicles", "tractors"];
  return uniq(
    data.inspections.national.filter((row) => row.reporting_period === period).map((row) => row.population),
  ).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export type InspectionOutcome = {
  period: string;
  population: string;
  total: number | null;
  pass: number | null;
  repeat: number | null;
  rest: number | null; // total − pass − repeat, other recorded outcomes
  periodic: number | null;
  passShare: number | null; // pass / total
  repeatShare: number | null; // repeat / total
  periodicShare: number | null; // periodic / total
};

export function inspectionOutcome(data: ExplorerData, period: string, population: string): InspectionOutcome {
  const rows = data.inspections.national.filter(
    (row) => row.reporting_period === period && row.population === population,
  );
  const get = (metric: string) => rows.find((row) => row.metric_code === metric)?.value ?? null;
  const total = get("inspections");
  const pass = get("inspections_pass");
  const repeat = get("inspections_repeat");
  const periodic = get("periodic_inspections");
  const rest = total != null && pass != null && repeat != null ? Math.max(0, total - pass - repeat) : null;
  const share = (value: number | null) => (total && value != null ? (value / total) * 100 : null);
  return {
    period,
    population,
    total,
    pass,
    repeat,
    rest,
    periodic,
    passShare: share(pass),
    repeatShare: share(repeat),
    periodicShare: share(periodic),
  };
}

export type StationRow = {
  code: string;
  name: string;
  total: number;
  pass: number | null;
  repeat: number | null;
  repeatShare: number | null; // station repeat / station inspections
};

export function inspectionStations(data: ExplorerData, period: string, population: string) {
  // Station identity is the source's bureau + point code; names repeat.
  const map = new Map<string, { name: string; metrics: Record<string, number> }>();
  for (const row of data.inspections.stations) {
    if (row.reporting_period !== period || row.population !== population) continue;
    const name = (row.station_name ?? "—").replace(/_/g, " ");
    const key = row.station_code ?? name;
    const entry = map.get(key) ?? { name, metrics: {} };
    entry.metrics[row.metric_code] = (entry.metrics[row.metric_code] ?? 0) + row.value;
    map.set(key, entry);
  }
  const rows: StationRow[] = [...map.entries()]
    .map(([code, { name, metrics }]) => ({
      code,
      name,
      total: metrics.inspections ?? 0,
      pass: metrics.inspections_pass ?? null,
      repeat: metrics.inspections_repeat ?? null,
      repeatShare:
        metrics.inspections && metrics.inspections_repeat != null
          ? (metrics.inspections_repeat / metrics.inspections) * 100
          : null,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const sum = rows.reduce((acc, row) => acc + row.total, 0);
  return { rows, sum };
}

/** Stock dates that carry a county split for a category. */
export function regionDatesOf(data: ExplorerData, category: string): string[] {
  const catalog = catalogOf(data);
  if (catalog) return catalog.regionDates[category] ?? [];
  return uniq(data.fleet.regions.filter((row) => row.category_code === category).map((row) => row.snapshot_date)).sort();
}

/** Stock dates with a usable brand list for a category. */
export function fleetBrandDatesOf(data: ExplorerData, category: string): string[] {
  const catalog = catalogOf(data);
  if (catalog) return (catalog.fleetBrandDates[category] ?? []).map((entry) => entry.date);
  return uniq(data.fleet.brands.filter((row) => row.category_code === category).map((row) => row.snapshot_date)).sort();
}

/** The n available values closest in time to `value` (periods or dates), oldest first. */
export function nearestItems(items: string[], value: string, n = 3): string[] {
  const toNumber = (v: string) => {
    const [y, m = "1", d = "1"] = v.split("-");
    return Number(y) * 372 + (Number(m) - 1) * 31 + (Number(d) - 1);
  };
  const target = toNumber(value);
  return [...items]
    .sort((a, b) => Math.abs(toNumber(a) - target) - Math.abs(toNumber(b) - target))
    .slice(0, n)
    .sort();
}
