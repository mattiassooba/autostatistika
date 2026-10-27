// Read models for the static brand and month pages (/[locale]/margid,
// /[locale]/kuu). Pure functions over the published bundle, evaluated at build
// time only. The rules match the explorer: missing is not zero, every share
// names its denominator.
//
// Two brand sources with different meaning:
// * TOP lists (Infoleht TOP sheets): first registrations, new and used, for the
//   largest passenger-car and truck brands. A brand outside the list is "not
//   ranked", never zero.
// * The new-passenger-car model sheet ("Sõidu-uus"): every new car by brand and
//   model. It is used only in months where its sum reconciles with the stated
//   new-vehicle total; there a brand without rows really had zero new cars.

import type { BrandRow, ModelRow, PublishedBundle } from "./types";
import { shiftPeriod, titleCaseBrand } from "../format";

/** Model-sheet months count only if their sum is within this share of the stated total. */
const RECONCILE_TOLERANCE = 0.01;
/** A brand gets a page with at least this many ranked months or new cars. */
const MIN_RANKED_MONTHS = 12;
const MIN_NEW_CARS = 100;
const CAR = "passenger_car";
const TRUCK = "truck";
/** Source renames of the same make; the old slug's rows count under the new one. */
const ALIASES: Record<string, string> = { "tesla-motors": "tesla" };
const SPLIT_ORDER = ["county", "power_band", "gearbox", "colour"];
const POWER_ORDER = ["0-70", "71-100", "101-150", "151-200", "201-300", "over-300"];
const CATEGORY_ORDER = ["passenger_car", "truck", "bus", "trailer", "motorcycle", "moped", "offroad", "tractor"];

export type Ranked = { slug: string; name: string; value: number; rank: number; share: number | null };
export type MonthValue = { period: string; value: number };
/** A brand in one register snapshot: rank and share within the complete split by make. */
export type FleetPoint = { date: string; value: number; rank: number; share: number | null; retroactive: boolean };

export type BrandSummary = {
  slug: string;
  name: string;
  /** New passenger cars in the last 12 reconciled months up to the latest period, null when not all 12 reconcile. */
  last12: number | null;
  prev12: number | null;
  carRank: number | null;
  truckRank: number | null;
};

export type BrandDetail = BrandSummary & {
  latest: string;
  /** New passenger cars per reconciled month (0 = none registered). */
  newCars: MonthValue[];
  newCarsLatest: number | null;
  newCarsRankLatest: number | null;
  newCarsShareLatest: number | null;
  yearly: Array<{ year: string; value: number; months: number }>;
  topModels: Array<{ model: string; value: number; share: number }>;
  topModelsMonths: number;
  /** TOP-list history, ranked months only. */
  cars: Array<Ranked & { period: string }>;
  trucks: Array<Ranked & { period: string }>;
  /** Months that have a TOP list at all; elsewhere "not ranked" would be a guess. */
  carListPeriods: string[];
  truckListPeriods: string[];
  /** Register snapshots (open register files, 2020+); empty when the brand has none. */
  fleetCars: FleetPoint[];
  fleetTrucks: FleetPoint[];
};

export type MonthDetail = {
  period: string;
  prev: string | null;
  next: string | null;
  yearAgo: string | null;
  categories: Array<{
    code: string;
    first: number | null;
    neu: number | null;
    used: number | null;
    firstYearAgo: number | null;
  }>;
  carBrands: Ranked[];
  truckBrands: Ranked[];
  /** Top new passenger-car models; null when the model sheet does not reconcile this month. */
  models: Array<{ slug: string; brand: string; model: string; value: number }> | null;
  modelBrands: Array<{ slug: string; name: string; value: number; share: number }> | null;
  fuels: Array<{ code: string; source: string; first: number | null; neu: number | null }>;
  /** New passenger cars by county, power band, gearbox and colour; only dimensions the leaflet has. */
  newCarSplits: Array<{ dimension: string; rows: Array<{ code: string; value: number; share: number | null }> }>;
};

export type MonthIndex = Array<{
  year: string;
  months: string[];
  /** Passenger-car first registrations, only when all 12 months exist. */
  carsFirst: number | null;
}>;

type Model = {
  bundle: PublishedBundle;
  periods: string[];
  latest: string;
  totals: Map<string, Map<string, Record<string, number>>>;
  rankings: Map<string, Ranked[]>;
  reconciled: Set<string>;
  newCars: Map<string, Map<string, number>>;
  models: Map<string, ModelRow[]>;
  names: Map<string, string>;
  pageBrands: string[];
  /** category|date → complete make ranking from the register files. */
  fleet: Map<string, Ranked[]>;
  fleetDates: Array<{ date: string; retroactive: boolean }>;
};

const cache = new WeakMap<PublishedBundle, Model>();

/** Real brand rows: drops parser debris such as rank numbers or "GRAND TOTAL". */
export function isBrandSlug(slug: string): boolean {
  return /[a-z]/.test(slug) && slug !== "grand-total" && slug !== "kokku" && slug !== "total";
}

function canonical(row: { brand_slug: string }): string {
  return ALIASES[row.brand_slug] ?? row.brand_slug;
}

export { shiftPeriod };

function build(bundle: PublishedBundle): Model {
  const reg = bundle.registrations;

  const totals = new Map<string, Map<string, Record<string, number>>>();
  for (const row of reg.totals) {
    if (!row.category_code) continue;
    const byPeriod = totals.get(row.category_code) ?? new Map<string, Record<string, number>>();
    totals.set(row.category_code, byPeriod);
    (byPeriod.get(row.reporting_period) ?? byPeriod.set(row.reporting_period, {}).get(row.reporting_period)!)[row.metric_code] =
      row.value;
  }
  const periods = [...new Set(reg.totals.map((row) => row.reporting_period))].sort();

  const names = new Map<string, string>();
  const grouped = new Map<string, BrandRow[]>();
  for (const row of reg.brands) {
    if (!row.category_code || !isBrandSlug(row.brand_slug)) continue;
    const key = `${row.category_code}|${row.reporting_period}`;
    const slug = canonical(row);
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push({ ...row, brand_slug: slug });
    if (!names.has(row.brand_slug)) names.set(row.brand_slug, titleCaseBrand(row.brand_source));
  }
  const rankings = new Map<string, Ranked[]>();
  for (const [key, rows] of grouped) {
    const [category, period] = key.split("|");
    const total = totals.get(category)?.get(period)?.first_registrations ?? null;
    rankings.set(
      key,
      [...rows]
        .sort((a, b) => b.value - a.value || a.brand_slug.localeCompare(b.brand_slug))
        .map((row, index) => ({
          slug: row.brand_slug,
          name: names.get(row.brand_slug) ?? titleCaseBrand(row.brand_source),
          value: row.value,
          rank: index + 1,
          share: total ? (row.value / total) * 100 : null,
        })),
    );
  }

  const models = new Map<string, ModelRow[]>();
  const modelSums = new Map<string, number>();
  for (const row of reg.models) {
    if (row.category_code !== CAR || !isBrandSlug(row.brand_slug)) continue;
    const slug = canonical(row);
    (models.get(row.reporting_period) ?? models.set(row.reporting_period, []).get(row.reporting_period)!).push({ ...row, brand_slug: slug });
    modelSums.set(row.reporting_period, (modelSums.get(row.reporting_period) ?? 0) + row.value);
    if (!names.has(row.brand_slug)) names.set(row.brand_slug, titleCaseBrand(row.brand_source));
  }
  const reconciled = new Set<string>();
  for (const [period, sum] of modelSums) {
    const stated = totals.get(CAR)?.get(period)?.new_vehicles;
    if (stated && Math.abs(sum - stated) <= stated * RECONCILE_TOLERANCE) reconciled.add(period);
  }
  const newCars = new Map<string, Map<string, number>>();
  for (const period of reconciled) {
    for (const row of models.get(period) ?? []) {
      const byPeriod = newCars.get(row.brand_slug) ?? newCars.set(row.brand_slug, new Map()).get(row.brand_slug)!;
      byPeriod.set(period, (byPeriod.get(period) ?? 0) + row.value);
    }
  }

  const rankedMonths = new Map<string, number>();
  for (const [key, list] of rankings) {
    if (!key.startsWith(`${CAR}|`) && !key.startsWith(`${TRUCK}|`)) continue;
    for (const entry of list) rankedMonths.set(entry.slug, (rankedMonths.get(entry.slug) ?? 0) + 1);
  }
  for (const [alias, slug] of Object.entries(ALIASES)) if (!names.has(slug) && names.has(alias)) names.set(slug, names.get(alias)!);
  for (const alias of Object.keys(ALIASES)) names.delete(alias);
  const pageBrands = [...names.keys()]
    .filter((slug) => {
      const newTotal = [...(newCars.get(slug)?.values() ?? [])].reduce((sum, value) => sum + value, 0);
      return (rankedMonths.get(slug) ?? 0) >= MIN_RANKED_MONTHS || newTotal >= MIN_NEW_CARS;
    })
    .sort();

  // Register snapshots only: their split by make is complete, so a rank means
  // something. Infoleht top lists and bus files are left to the fleet tab.
  const fleetDates = (bundle.fleet.sources ?? []).map((row) => ({ date: row.snapshot_date, retroactive: row.retroactive })).sort((a, b) => a.date.localeCompare(b.date));
  const registerDates = new Set(fleetDates.map((row) => row.date));
  const fleetSums = new Map<string, Map<string, number>>();
  for (const row of bundle.fleet.brands) {
    if (!registerDates.has(row.snapshot_date) || row.complete === false) continue;
    if (row.category_code !== CAR && row.category_code !== TRUCK) continue;
    const key = `${row.category_code}|${row.snapshot_date}`;
    const sums = fleetSums.get(key) ?? fleetSums.set(key, new Map()).get(key)!;
    const slug = canonical(row);
    sums.set(slug, (sums.get(slug) ?? 0) + row.value);
  }
  const fleet = new Map<string, Ranked[]>();
  for (const [key, sums] of fleetSums) {
    const total = [...sums.values()].reduce((sum, value) => sum + value, 0);
    fleet.set(
      key,
      [...sums.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([slug, value], index) => ({ slug, name: names.get(slug) ?? slug, value, rank: index + 1, share: total ? (value / total) * 100 : null })),
    );
  }

  return {
    bundle,
    fleet,
    fleetDates,
    periods,
    latest: periods[periods.length - 1] ?? "",
    totals,
    rankings,
    reconciled,
    newCars,
    models,
    names,
    pageBrands,
  };
}

function model(bundle: PublishedBundle): Model {
  let built = cache.get(bundle);
  if (!built) {
    built = build(bundle);
    cache.set(bundle, built);
  }
  return built;
}

/** Sum of a brand's new cars over the 12 months ending at `end`, null unless all 12 reconcile. */
function window12(m: Model, slug: string, end: string): number | null {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const period = shiftPeriod(end, -i);
    if (!m.reconciled.has(period)) return null;
    sum += m.newCars.get(slug)?.get(period) ?? 0;
  }
  return sum;
}

function rankOf(m: Model, category: string, period: string, slug: string): number | null {
  return m.rankings.get(`${category}|${period}`)?.find((entry) => entry.slug === slug)?.rank ?? null;
}

export function brandSlugs(bundle: PublishedBundle): string[] {
  return model(bundle).pageBrands;
}

export function latestPeriod(bundle: PublishedBundle): string {
  return model(bundle).latest;
}

export function brandName(bundle: PublishedBundle, slug: string): string {
  return model(bundle).names.get(slug) ?? titleCaseBrand(slug.toUpperCase());
}

export function brandSummaries(bundle: PublishedBundle): BrandSummary[] {
  const m = model(bundle);
  return m.pageBrands.map((slug) => ({
    slug,
    name: m.names.get(slug)!,
    last12: window12(m, slug, m.latest),
    prev12: window12(m, slug, shiftPeriod(m.latest, -12)),
    carRank: rankOf(m, CAR, m.latest, slug),
    truckRank: rankOf(m, TRUCK, m.latest, slug),
  }));
}

export function brandDetail(bundle: PublishedBundle, slug: string): BrandDetail | null {
  const m = model(bundle);
  if (!m.pageBrands.includes(slug)) return null;
  const reconciled = [...m.reconciled].sort();
  const byPeriod = m.newCars.get(slug);
  const newCars = reconciled.map((period) => ({ period, value: byPeriod?.get(period) ?? 0 }));

  const years = new Map<string, { value: number; months: number }>();
  for (const { period, value } of newCars) {
    const entry = years.get(period.slice(0, 4)) ?? { value: 0, months: 0 };
    entry.value += value;
    entry.months += 1;
    years.set(period.slice(0, 4), entry);
  }

  // Years before the brand's first new car in Estonia are left out, not drawn as zeros.
  const allYears = [...years.entries()].map(([year, entry]) => ({ year, ...entry })).sort((a, b) => a.year.localeCompare(b.year));
  const firstYear = allYears.findIndex((year) => year.value > 0);
  const yearly = firstYear === -1 ? [] : allYears.slice(firstYear);

  // Latest month's new-car ranking across all brands (complete list).
  let newCarsRankLatest: number | null = null;
  let newCarsShareLatest: number | null = null;
  const latestReconciled = m.reconciled.has(m.latest);
  if (latestReconciled) {
    const latestTotals = [...m.newCars.entries()].map(([brand, map]) => ({ brand, value: map.get(m.latest) ?? 0 }));
    const own = byPeriod?.get(m.latest) ?? 0;
    if (own > 0) newCarsRankLatest = 1 + latestTotals.filter((entry) => entry.value > own).length;
    const stated = m.totals.get(CAR)?.get(m.latest)?.new_vehicles;
    newCarsShareLatest = stated ? (own / stated) * 100 : null;
  }

  // Top models over the last 12 reconciled months up to the latest period.
  const recent = reconciled.filter((period) => period > shiftPeriod(m.latest, -12));
  const modelTotals = new Map<string, number>();
  for (const period of recent) {
    for (const row of m.models.get(period) ?? []) {
      if (row.brand_slug === slug) modelTotals.set(row.model_source, (modelTotals.get(row.model_source) ?? 0) + row.value);
    }
  }
  const brandRecent = [...modelTotals.values()].reduce((sum, value) => sum + value, 0);
  const topModels = [...modelTotals.entries()]
    .map(([name, value]) => ({ model: name, value, share: brandRecent ? (value / brandRecent) * 100 : 0 }))
    .sort((a, b) => b.value - a.value || a.model.localeCompare(b.model))
    .slice(0, 12);

  const history = (category: string) =>
    m.periods.flatMap((period) => {
      const entry = m.rankings.get(`${category}|${period}`)?.find((ranked) => ranked.slug === slug);
      return entry ? [{ ...entry, period }] : [];
    });

  return {
    slug,
    name: m.names.get(slug)!,
    latest: m.latest,
    last12: window12(m, slug, m.latest),
    prev12: window12(m, slug, shiftPeriod(m.latest, -12)),
    carRank: rankOf(m, CAR, m.latest, slug),
    truckRank: rankOf(m, TRUCK, m.latest, slug),
    newCars,
    newCarsLatest: latestReconciled ? (byPeriod?.get(m.latest) ?? 0) : null,
    newCarsRankLatest,
    newCarsShareLatest,
    yearly,
    topModels,
    topModelsMonths: recent.length,
    cars: history(CAR),
    trucks: history(TRUCK),
    carListPeriods: m.periods.filter((period) => m.rankings.get(`${CAR}|${period}`)?.length),
    truckListPeriods: m.periods.filter((period) => m.rankings.get(`${TRUCK}|${period}`)?.length),
    fleetCars: fleetPoints(m, CAR, slug),
    fleetTrucks: fleetPoints(m, TRUCK, slug),
  };
}

function fleetPoints(m: Model, category: string, slug: string): FleetPoint[] {
  return m.fleetDates.flatMap(({ date, retroactive }) => {
    const entry = m.fleet.get(`${category}|${date}`)?.find((ranked) => ranked.slug === slug);
    return entry ? [{ date, value: entry.value, rank: entry.rank, share: entry.share, retroactive }] : [];
  });
}

export function monthPeriods(bundle: PublishedBundle): string[] {
  return model(bundle).periods;
}

export function monthDetail(bundle: PublishedBundle, period: string): MonthDetail | null {
  const m = model(bundle);
  const index = m.periods.indexOf(period);
  if (index === -1) return null;
  const yearAgo = shiftPeriod(period, -12);
  const hasYearAgo = m.periods.includes(yearAgo);

  const categories = CATEGORY_ORDER.flatMap((code) => {
    const metrics = m.totals.get(code)?.get(period);
    if (!metrics) return [];
    return [
      {
        code,
        first: metrics.first_registrations ?? null,
        neu: metrics.new_vehicles ?? null,
        used: metrics.used_first_registrations ?? null,
        firstYearAgo: hasYearAgo ? (m.totals.get(code)?.get(yearAgo)?.first_registrations ?? null) : null,
      },
    ];
  });

  let models: MonthDetail["models"] = null;
  let modelBrands: MonthDetail["modelBrands"] = null;
  if (m.reconciled.has(period)) {
    const rows = m.models.get(period) ?? [];
    const merged = new Map<string, { slug: string; brand: string; model: string; value: number }>();
    const brands = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.brand_slug}|${row.model_source}`;
      const entry = merged.get(key) ?? { slug: row.brand_slug, brand: m.names.get(row.brand_slug)!, model: row.model_source, value: 0 };
      entry.value += row.value;
      merged.set(key, entry);
      brands.set(row.brand_slug, (brands.get(row.brand_slug) ?? 0) + row.value);
    }
    models = [...merged.values()].sort((a, b) => b.value - a.value || a.model.localeCompare(b.model)).slice(0, 15);
    const stated = m.totals.get(CAR)?.get(period)?.new_vehicles ?? 0;
    modelBrands = [...brands.entries()]
      .map(([slug, value]) => ({ slug, name: m.names.get(slug)!, value, share: stated ? (value / stated) * 100 : 0 }))
      .sort((a, b) => b.value - a.value || a.slug.localeCompare(b.slug))
      .slice(0, 15);
  }

  const fuelRows = m.bundle.registrations.fuels.filter((row) => row.category_code === CAR && row.reporting_period === period);
  const fuels = [...new Set(fuelRows.map((row) => row.fuel_code))].map((code) => {
    const rows = fuelRows.filter((row) => row.fuel_code === code);
    const value = (metric: string) => rows.find((row) => row.metric_code === metric)?.value ?? null;
    return { code, source: rows[0].fuel_source, first: value("first_registrations"), neu: value("new_vehicles") };
  });
  fuels.sort((a, b) => (b.first ?? 0) - (a.first ?? 0));

  // Each dimension is published only when it adds up to the stated new cars
  // (checked at import); share = rows / the stated new passenger cars.
  const statedNew = m.totals.get(CAR)?.get(period)?.new_vehicles ?? null;
  const splitRows = (m.bundle.registrations.breakdowns ?? []).filter((row) => row.category_code === CAR && row.reporting_period === period);
  const newCarSplits = SPLIT_ORDER.flatMap((dimension) => {
    const rows = splitRows
      .filter((row) => row.dimension === dimension)
      .map((row) => ({ code: row.dimension_value, value: row.value, share: statedNew ? (row.value / statedNew) * 100 : null }));
    if (!rows.length) return [];
    const order = dimension === "power_band" ? POWER_ORDER : null;
    rows.sort((a, b) => {
      if (a.code === "unknown" || b.code === "unknown") return a.code === "unknown" ? 1 : -1;
      return order ? order.indexOf(a.code) - order.indexOf(b.code) : b.value - a.value || a.code.localeCompare(b.code);
    });
    return [{ dimension, rows }];
  });

  return {
    period,
    newCarSplits,
    prev: m.periods[index - 1] ?? null,
    next: m.periods[index + 1] ?? null,
    yearAgo: hasYearAgo ? yearAgo : null,
    categories,
    carBrands: m.rankings.get(`${CAR}|${period}`) ?? [],
    truckBrands: m.rankings.get(`${TRUCK}|${period}`) ?? [],
    models,
    modelBrands,
    fuels,
  };
}

export function monthIndex(bundle: PublishedBundle): MonthIndex {
  const m = model(bundle);
  const years = new Map<string, string[]>();
  for (const period of m.periods) (years.get(period.slice(0, 4)) ?? years.set(period.slice(0, 4), []).get(period.slice(0, 4))!).push(period);
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => {
      const values = months.map((period) => m.totals.get(CAR)?.get(period)?.first_registrations);
      const complete = months.length === 12 && values.every((value) => value != null);
      return { year, months, carsFirst: complete ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null };
    });
}

/** Passenger-car first registrations per month, for charts on month pages and images. */
export function carSeries(bundle: PublishedBundle): MonthValue[] {
  const m = model(bundle);
  return m.periods.flatMap((period) => {
    const value = m.totals.get(CAR)?.get(period)?.first_registrations;
    return value == null ? [] : [{ period, value }];
  });
}
