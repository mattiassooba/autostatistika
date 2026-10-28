// One selection → the computed trend analysis. The page and the trend-analyst
// Worker both call this, so the Worker rebuilds exactly the statements the page
// shows from the site's own data, and nothing a caller types reaches the model.

import { brandRanking, brandWindow, registrationSeries } from "../data/views";
import type { ExplorerData } from "../data/types";
import { fmtDate, fmtPeriod, fmtPeriodShort, titleCaseBrand } from "../format";
import { renderTrend, type Translate } from "./render";
import { trendFacts, trendStatements } from "./trend";
import { registrationFacts, registrationStatements } from "./registrations";

export type RegistrationSelection = {
  locale: "et" | "en";
  category: string;
  period: string; // the selected month (URL `to`)
};

export type TrendSelection = {
  locale: "et" | "en";
  category: string;
  brands: string[]; // slugs, up to four
  from: string | null; // start of the window (URL `from`); null = every month
};

export function periodRange(periods: string[], locale: string): string {
  return `${fmtPeriodShort(periods[0], locale)} – ${fmtPeriodShort(periods[periods.length - 1], locale)}`;
}

export function buildTrend(data: ExplorerData, selection: TrendSelection, categoryLabel: string, t: Translate) {
  const { locale, category, brands, from } = selection;
  const { periods, history } = brandWindow(data, category, brands, from);
  const facts = trendFacts({
    category,
    periods,
    history,
    totals: registrationSeries(data, category),
    listSize: (period) => brandRanking(data, category, period).length,
  });
  const period = periods.length ? periodRange(periods, locale) : "";
  const rendered = renderTrend(
    trendStatements(facts),
    {
      kind: "brands",
      locale,
      category: categoryLabel,
      brands: history.map((brand) => titleCaseBrand(brand.name)),
      period,
      source: t("source", { period, date: fmtDate(data.generatedAt, locale) }),
    },
    t,
  );
  return { facts, rendered, periods, history };
}

/** The registrations history analysis for one type and month (lib/analysis/registrations.ts). */
export function buildRegistrationTrend(data: ExplorerData, selection: RegistrationSelection, categoryLabel: string, t: Translate) {
  const { locale, category, period } = selection;
  const series = registrationSeries(data, category);
  const facts = registrationFacts(series, category, period);
  const start = series.find((point) => point.first != null)?.period ?? period;
  const rendered = renderTrend(
    registrationStatements(facts),
    {
      kind: "registrations",
      locale,
      category: categoryLabel,
      brands: [],
      period: fmtPeriod(period, locale),
      source: t("sourceReg", { period: periodRange([start, period], locale), date: fmtDate(data.generatedAt, locale) }),
    },
    t,
  );
  return { facts, rendered };
}
