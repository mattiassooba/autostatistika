import type { BrandRow, DashboardQuery, PublishedBundle, TotalsRow } from "./types";

export function registrationPeriods(bundle: PublishedBundle): string[] {
  return [...new Set(bundle.registrations.totals.map((row) => row.reporting_period))].sort();
}

export function latestPeriod(bundle: PublishedBundle): string | undefined {
  const periods = registrationPeriods(bundle);
  return periods[periods.length - 1];
}

export function filterTotals(bundle: PublishedBundle, query: DashboardQuery): TotalsRow[] {
  const periods = registrationPeriods(bundle);
  const from = query.from ?? periods[0];
  const to = query.to ?? periods[periods.length - 1];
  return bundle.registrations.totals.filter((row) => {
    if (from && row.reporting_period < from) return false;
    if (to && row.reporting_period > to) return false;
    if (query.category && row.category_code !== query.category) return false;
    return true;
  });
}

export function brandRanking(bundle: PublishedBundle, query: DashboardQuery): BrandRow[] {
  const period = query.to ?? latestPeriod(bundle);
  const category = query.category ?? "passenger_car";
  const rows = bundle.registrations.brands.filter(
    (row) => row.reporting_period === period && row.category_code === category,
  );
  const filtered = query.brands.length
    ? rows.filter((row) => query.brands.includes(row.brand_slug))
    : rows;
  return [...filtered].sort((a, b) => b.value - a.value).slice(0, 12);
}

export function firstRegistrationKpi(bundle: PublishedBundle, query: DashboardQuery) {
  const period = query.to ?? latestPeriod(bundle);
  const category = query.category ?? "passenger_car";
  const rows = bundle.registrations.totals.filter(
    (row) => row.reporting_period === period && row.category_code === category,
  );
  const first = rows.find((row) => row.metric_code === "first_registrations")?.value ?? null;
  const neu = rows.find((row) => row.metric_code === "new_vehicles")?.value ?? null;
  const used = rows.find((row) => row.metric_code === "used_first_registrations")?.value ?? null;
  return {
    period,
    category,
    first,
    neu,
    used,
    newShare: first && neu != null ? (neu / first) * 100 : null,
  };
}

export function availableBrands(bundle: PublishedBundle, query: DashboardQuery): Array<{ slug: string; name: string }> {
  const period = query.to ?? latestPeriod(bundle);
  const category = query.category ?? "passenger_car";
  const rows = bundle.registrations.brands.filter(
    (row) => row.reporting_period === period && row.category_code === category,
  );
  return [...rows]
    .sort((a, b) => b.value - a.value)
    .slice(0, 24)
    .map((row) => ({ slug: row.brand_slug, name: row.brand_source }));
}

export function fleetDates(bundle: PublishedBundle): string[] {
  return [...new Set(bundle.fleet.snapshots.map((row) => row.snapshot_date))].sort();
}

export function fleetCategories(bundle: PublishedBundle, date?: string): string[] {
  return [
    ...new Set(
      bundle.fleet.snapshots
        .filter((row) => !date || row.snapshot_date === date)
        .map((row) => row.category_code)
        .filter((code): code is string => Boolean(code)),
    ),
  ].sort();
}

export function fleetKpi(bundle: PublishedBundle, query: DashboardQuery) {
  const dates = fleetDates(bundle);
  const date = query.snapshot && dates.includes(query.snapshot) ? query.snapshot : dates[dates.length - 1];
  const available = fleetCategories(bundle, date);
  const category =
    query.category && available.includes(query.category) ? query.category : available[0];
  const rows = bundle.fleet.snapshots.filter(
    (row) => row.snapshot_date === date && row.category_code === category,
  );
  const value = rows.reduce((sum, row) => sum + row.value, 0);
  return {
    date,
    category,
    value: date ? value : null,
    statuses: rows
      .filter((row) => row.status_code)
      .map((row) => ({ status: row.status_code as string, value: row.value })),
  };
}

export function inspectionPeriods(bundle: PublishedBundle): string[] {
  return [...new Set(bundle.inspections.national.map((row) => row.reporting_period))].sort();
}

export function inspectionPopulations(bundle: PublishedBundle, period?: string): string[] {
  return [
    ...new Set(
      bundle.inspections.national
        .filter((row) => !period || row.reporting_period === period)
        .map((row) => row.population),
    ),
  ];
}

export function inspectionKpi(bundle: PublishedBundle, query?: DashboardQuery) {
  const periods = inspectionPeriods(bundle);
  const period =
    query?.to && periods.includes(query.to) ? query.to : periods[periods.length - 1];
  const populations = inspectionPopulations(bundle, period);
  const population =
    query?.population && populations.includes(query.population) ? query.population : populations[0] ?? "vehicles";
  const rows = bundle.inspections.national.filter(
    (row) => row.reporting_period === period && row.population === population,
  );
  const total = rows.find((row) => row.metric_code === "inspections")?.value ?? null;
  const repeat = rows.find((row) => row.metric_code === "inspections_repeat")?.value ?? null;
  const passed = rows.find((row) => row.metric_code === "inspections_pass")?.value ?? null;
  return {
    period,
    population,
    total,
    repeat,
    passed,
    repeatShare: total && repeat != null ? (repeat / total) * 100 : null,
    rows,
  };
}

export function formatNumber(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale === "et" ? "et-EE" : "en-GB").format(Math.round(value));
}

export function formatPercent(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale === "et" ? "et-EE" : "en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value) + "%";
}
