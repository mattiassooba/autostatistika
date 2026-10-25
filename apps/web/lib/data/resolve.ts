// Resolve a (possibly partial or stale) URL query against what the data can
// actually show. Unsupported values fall back to sensible defaults derived from
// availability; compatible selections survive tab switches.

import type { DashboardQuery, ExplorerData } from "./types";
import {
  brandCategoriesOf,
  brandPeriodsOf,
  fleetCategoriesAt,
  fleetDatesOf,
  inspectionPeriodsOf,
  inspectionPopulationsAt,
  registrationCategoriesOf,
  registrationPeriodsOf,
} from "./views";
import { MAX_COMPARE } from "../design/tokens";

export type ResolvedView = {
  tab: DashboardQuery["tab"];
  registrations: {
    category: string;
    period: string;
    periods: string[];
    categories: string[];
    hasBrands: boolean;
    brands: string[];
  };
  fleet: { date: string; dates: string[]; category: string; categories: string[] };
  inspections: { period: string; periods: string[]; population: string; populations: string[] };
};

const PREFERRED_CATEGORY = "passenger_car";

export function resolveView(data: ExplorerData, query: DashboardQuery): ResolvedView {
  // Registrations
  const regCategories = registrationCategoriesOf(data);
  const regCategory =
    query.category && regCategories.includes(query.category)
      ? query.category
      : regCategories.includes(PREFERRED_CATEGORY)
        ? PREFERRED_CATEGORY
        : regCategories[0] ?? PREFERRED_CATEGORY;
  const regPeriods = registrationPeriodsOf(data);
  const regPeriod = query.to && regPeriods.includes(query.to) ? query.to : regPeriods[regPeriods.length - 1] ?? "";
  const brandCats = brandCategoriesOf(data);
  const hasBrands = brandCats.includes(regCategory);
  const knownBrands = new Set(
    data.registrations.brands.filter((row) => row.category_code === regCategory).map((row) => row.brand_slug),
  );
  // Until the category's brand slice is loaded, keep the requested slugs.
  const brands = hasBrands
    ? query.brands.filter((slug) => !knownBrands.size || knownBrands.has(slug)).slice(0, MAX_COMPARE)
    : [];

  // Fleet: default to the newest snapshot that carries the preferred category,
  // otherwise the newest snapshot overall.
  const dates = fleetDatesOf(data);
  const datesWithPreferred = dates.filter((date) => fleetCategoriesAt(data, date).includes(query.category ?? PREFERRED_CATEGORY));
  const date =
    query.snapshot && dates.includes(query.snapshot)
      ? query.snapshot
      : datesWithPreferred[datesWithPreferred.length - 1] ?? dates[dates.length - 1] ?? "";
  const fleetCategories = date ? fleetCategoriesAt(data, date) : [];
  const fleetCategory =
    query.category && fleetCategories.includes(query.category)
      ? query.category
      : fleetCategories.includes(PREFERRED_CATEGORY)
        ? PREFERRED_CATEGORY
        : fleetCategories[0] ?? "";

  // Inspections
  const inspPeriods = inspectionPeriodsOf(data);
  const inspPeriod =
    query.to && inspPeriods.includes(query.to) ? query.to : inspPeriods[inspPeriods.length - 1] ?? "";
  const populations = inspPeriod ? inspectionPopulationsAt(data, inspPeriod) : [];
  const population =
    query.population && populations.includes(query.population) ? query.population : populations[0] ?? "vehicles";

  return {
    tab: query.tab,
    registrations: {
      category: regCategory,
      period: regPeriod,
      periods: regPeriods,
      categories: regCategories,
      hasBrands,
      brands,
    },
    fleet: { date, dates, category: fleetCategory, categories: fleetCategories },
    inspections: { period: inspPeriod, periods: inspPeriods, population, populations },
  };
}

export function brandPeriodsFor(data: ExplorerData, category: string) {
  return brandPeriodsOf(data, category);
}
