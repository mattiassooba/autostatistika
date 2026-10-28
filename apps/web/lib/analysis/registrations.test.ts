import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { RegistrationPoint } from "../data/views";
import { registrationCategoriesOf, registrationSeries } from "../data/views";
import type { ExplorerData, PublishedBundle } from "../data/types";
import { shiftPeriod } from "../format";
import { buildRegistrationTrend } from "./build";
import { registrationFacts, registrationStatements } from "./registrations";
import { messageTranslator } from "./trend-file";
import { validateAnalysis } from "./validate";

const messages = (locale: "et" | "en") => JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf-8"));

/** Monthly points from `start`, `n` months long; `first(i)` and `neu(i)` per month index (null = not stated). */
function series(start: string, n: number, first: (i: number, period: string) => number | null, neu: (i: number) => number | null = () => null): RegistrationPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const period = shiftPeriod(start, i);
    const f = first(i, period);
    const nv = f == null ? null : neu(i);
    return { period, first: f, neu: nv, used: f != null && nv != null ? f - nv : null, privateNew: null, newShare: f && nv != null ? (nv / f) * 100 : null };
  });
}
const keys = (points: RegistrationPoint[], period: string) =>
  Object.fromEntries(
    (["summary", "changes", "comparison", "observation"] as const).map((section) => [
      section,
      registrationStatements(registrationFacts(points, "passenger_car", period)).statements.filter((s) => s.section === section).map((s) => s.key),
    ]),
  );

describe("registrationFacts", () => {
  it("compares the month with a year earlier and 12 months with the 12 before", () => {
    // 2024-10 … 2026-09; each month of the last year is 10 % above the year before.
    const points = series("2024-10", 24, (i) => (i < 12 ? 1000 : 1100), (i) => (i < 12 ? 400 : 500));
    const facts = registrationFacts(points, "passenger_car", "2026-09");
    assert.equal(facts.status, "ok");
    assert.equal(facts.yearAgo?.first, 1000);
    assert.deepEqual(facts.rolling, {
      last: { from: "2025-10", to: "2026-09", first: 13200, neu: 6000 },
      previous: { from: "2024-10", to: "2025-09", first: 12000, neu: 4800 },
    });
    assert.deepEqual(keys(points, "2026-09"), {
      summary: ["regMonth", "regYearAgo"],
      changes: ["regFirst", "regNew", "regUsed", "regRolling"],
      comparison: ["regNewShare", "regRollingShare"],
      observation: ["regSeasonShort"],
    });
  });

  it("gives no 12-month comparison when a month in either block is missing", () => {
    const points = series("2024-10", 24, (i) => (i === 5 ? null : 1000));
    const facts = registrationFacts(points, "passenger_car", "2026-09");
    assert.equal(facts.rolling, null);
    assert.deepEqual(facts.gaps, ["2025-03"]);
    assert.ok(!keys(points, "2026-09").changes.includes("regRolling"));
  });

  it("is insufficient without the month a year earlier, and empty without the month", () => {
    const points = series("2026-01", 9, () => 1000);
    assert.equal(registrationFacts(points, "passenger_car", "2026-09").status, "insufficient");
    assert.deepEqual(keys(points, "2026-09").summary, ["regMonthNoNew", "regNoYearAgo"]);
    assert.equal(registrationFacts(points, "passenger_car", "2027-01").status, "empty");
  });

  it("does not count months before the type's first stated month as gaps", () => {
    // Mopeds start in 06/2012: the page's series has empty months before that, the Worker's does not.
    const page = series("2006-01", 85, (_, period) => (period < "2012-06" ? null : 500));
    const worker = page.filter((point) => point.period >= "2012-06");
    assert.deepEqual(registrationFacts(page, "moped", "2013-01").gaps, []);
    assert.deepEqual(registrationFacts(page, "moped", "2013-01"), registrationFacts(worker, "moped", "2013-01"));
  });

  it("places the month among the same calendar month in earlier years", () => {
    // Septembers 2016-2025 and the selected September 2026.
    const septembers = (values: number[]) => series("2016-09", 121, (i) => (i % 12 === 0 ? values[i / 12] : 1000));
    // Highest of all 11 Septembers.
    assert.deepEqual(keys(septembers([500, 600, 700, 800, 900, 600, 700, 800, 900, 950, 1200]), "2026-09").observation, ["regSeasonTop"]);
    // Highest since September 2019 (1500), seven years back; every September after it was lower.
    assert.deepEqual(keys(septembers([500, 600, 700, 1500, 900, 600, 700, 800, 900, 950, 1200]), "2026-09").observation, ["regSeasonHigh"]);
    // Last year was higher: no "since" claim, only the range.
    assert.deepEqual(keys(septembers([500, 600, 700, 800, 900, 600, 700, 800, 900, 1300, 1200]), "2026-09").observation, ["regSeasonRange"]);
    // A tie with an earlier year is not "the highest".
    assert.deepEqual(keys(septembers([500, 600, 700, 800, 900, 600, 700, 800, 900, 1200, 1200]), "2026-09").observation, ["regSeasonRange"]);
  });
});

describe("registrations analysis on real data", () => {
  const bundle = JSON.parse(readFileSync(new URL("../../data/published/bundle.json", import.meta.url), "utf-8")) as PublishedBundle;
  const explorer = { ...bundle, insights: [] } as unknown as ExplorerData;

  it("every category, many months, both languages: text passes the number check", () => {
    let checked = 0;
    for (const category of registrationCategoriesOf(explorer)) {
      const months = registrationSeries(explorer, category).filter((point) => point.first != null).map((point) => point.period);
      for (const period of months.filter((_, i) => i % 7 === 0 || i === months.length - 1)) {
        for (const locale of ["et", "en"] as const) {
          const all = messages(locale);
          const { facts, rendered } = buildRegistrationTrend(explorer, { locale, category, period }, all.categories[category], messageTranslator(all.trend));
          const text = [rendered.analysis.summary.text, ...rendered.analysis.keyChanges.map((i) => i.text), rendered.analysis.comparison?.text ?? "", rendered.analysis.observation?.text ?? "", ...rendered.limitations, rendered.request.context.source].join(" ");
          assert.doesNotMatch(text, /NaN|undefined|Infinity|\{/, `${category} ${period} ${locale}`);
          const check = validateAnalysis(rendered.analysis, rendered.request);
          assert.ok(check.ok, `${category} ${period} ${locale}: ${JSON.stringify(check)}`);
          if (facts.status === "ok") assert.ok(rendered.analysis.keyChanges.length >= 1);
          checked += 1;
        }
      }
    }
    assert.ok(checked > 300, String(checked));
  });

  it("September 2026 passenger cars: the leaflet's figures", () => {
    const { rendered } = buildRegistrationTrend(explorer, { locale: "en", category: "passenger_car", period: "2026-09" }, "Passenger cars", messageTranslator(messages("en").trend));
    // README: September 2026, passenger cars: 3639 first registrations, 1670 new, 1969 used.
    assert.match(rendered.analysis.summary.text, /^Sept 2026: 3,639 first registrations, of which 1,670 new/);
    assert.ok(rendered.analysis.keyChanges.some((item) => item.text.includes("→ 1,969")));
  });
});

describe("registration evidence", () => {
  it("lists only rows that a statement cites", () => {
    const points = series("2024-10", 24, (i) => (i < 12 ? 1000 : 1100), (i) => (i < 12 ? 400 : 500)).map((point, i) =>
      // The private-owner figure is stated only for the selected month: no comparison, so no row.
      i === 23 ? { ...point, privateNew: 50 } : point,
    );
    const { statements, evidence } = registrationStatements(registrationFacts(points, "passenger_car", "2026-09"));
    const cited = new Set(statements.flatMap((s) => s.evidence));
    assert.deepEqual(evidence.map((row) => row.id).filter((id) => !cited.has(id)), []);
    assert.ok(!evidence.some((row) => row.key === "regPrivateShare"));
  });
});
