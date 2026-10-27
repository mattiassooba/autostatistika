import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { brandHistory, brandPeriodsOf, brandRanking, registrationSeries } from "../data/views";
import { shiftPeriod } from "../data/pages";
import type { ExplorerData, PublishedBundle } from "../data/types";
import { renderTrend, type Translate } from "./render";
import { monthsFrom, runs, trendFacts, trendStatements } from "./trend";
import { validateAnalysis } from "./validate";

// A translator over the real message files: "{name}" placeholders only, as the trend messages use.
function translator(locale: "et" | "en"): Translate {
  const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf-8")).trend;
  return (key, values = {}) => {
    const message = key.split(".").reduce((node, part) => node?.[part], messages);
    assert.equal(typeof message, "string", `missing message trend.${key}`);
    return (message as string).replace(/\{(\w+)\}/g, (_, name) => {
      assert.ok(name in values, `missing value ${name} for trend.${key}`);
      return values[name];
    });
  };
}

type Brand = { slug: string; name: string; value: (period: string, index: number) => number | null };

function data(months: string[], brands: Brand[], total = 1000, neu: number | null = 400): ExplorerData {
  return {
    generatedAt: "2026-10-27T00:00:00+00:00",
    disclaimer: { et: "", en: "" },
    registrations: {
      totals: months.flatMap((period) => [
        { reporting_period: period, category_code: "passenger_car", metric_code: "first_registrations", value: total },
        ...(neu == null ? [] : [{ reporting_period: period, category_code: "passenger_car", metric_code: "new_vehicles", value: neu }]),
      ]),
      brands: months.flatMap((period, index) =>
        brands.flatMap((brand) => {
          const value = brand.value(period, index);
          return value == null ? [] : [{ reporting_period: period, category_code: "passenger_car", brand_slug: brand.slug, brand_source: brand.name, value }];
        }),
      ),
      fuels: [],
      models: [],
      breakdowns: [],
    },
    fleet: { snapshots: [], brands: [], regions: [], ages: [] },
    inspections: { national: [], stations: [] },
    insights: [],
  } as unknown as ExplorerData;
}

function input(explorer: ExplorerData, slugs: string[], from?: string) {
  const all = brandPeriodsOf(explorer, "passenger_car");
  const periods = from ? all.filter((period) => period >= from) : all;
  const history = brandHistory(explorer, "passenger_car", slugs).map((brand) => ({
    ...brand,
    points: brand.points.filter((point) => periods.includes(point.period)),
  }));
  return {
    category: "passenger_car",
    periods,
    history,
    totals: registrationSeries(explorer, "passenger_car"),
    listSize: (period: string) => brandRanking(explorer, "passenger_car", period).length,
  };
}

function render(explorer: ExplorerData, slugs: string[], locale: "et" | "en" = "et", from?: string) {
  const facts = trendFacts(input(explorer, slugs, from));
  const statements = trendStatements(facts);
  const rendered = renderTrend(statements, { locale, category: "Sõiduautod", brands: slugs, period: "x", source: "Transpordiamet" }, translator(locale));
  return { facts, statements, rendered };
}

const months36 = monthsFrom("2023-10", "2026-09");

describe("trendFacts", () => {
  it("compares the first and last complete 12-month blocks", () => {
    const explorer = data(months36, [
      { slug: "bmw", name: "BMW", value: (_, i) => (i < 12 ? 100 : i >= 24 ? 150 : 120) },
      { slug: "toyota", name: "TOYOTA", value: () => 200 },
    ]);
    const facts = trendFacts(input(explorer, ["bmw", "toyota"]));
    assert.equal(facts.status, "ok");
    assert.deepEqual(facts.blocks, { start: { from: "2023-10", to: "2024-09" }, end: { from: "2025-10", to: "2026-09" } });
    const bmw = facts.brands[0];
    assert.equal(bmw.start?.total, 1200);
    assert.equal(bmw.end?.total, 1800);
    assert.equal(bmw.change, 50);
    // share = brand / category first registrations over the same 12 months
    assert.equal(bmw.start?.share, 10);
    assert.equal(bmw.end?.share, 15);
    assert.equal(bmw.shareChange, 5);
    assert.equal(facts.market?.change, 0);
    assert.equal(facts.market?.start.newShare, 40);
  });

  it("gives no total, and no change, for a brand missing from a month's list", () => {
    const explorer = data(months36, [
      { slug: "bmw", name: "BMW", value: (period) => (period === "2026-02" ? null : 100) },
      { slug: "toyota", name: "TOYOTA", value: () => 200 },
    ]);
    const facts = trendFacts(input(explorer, ["bmw", "toyota"]));
    const bmw = facts.brands[0];
    assert.equal(bmw.end?.listed, 11);
    assert.equal(bmw.end?.total, null);
    assert.equal(bmw.change, null);
    const { statements } = trendStatements(facts);
    const change = statements.find((s) => s.section === "changes" && JSON.stringify(s.values.brand) === JSON.stringify({ kind: "brand", value: "BMW" }));
    assert.equal(change?.key, "partial");
  });

  it("is insufficient without two separate complete blocks", () => {
    const months = monthsFrom("2025-04", "2026-09"); // 18 months
    const facts = trendFacts(input(data(months, [{ slug: "bmw", name: "BMW", value: () => 100 }]), ["bmw"]));
    assert.equal(facts.status, "insufficient");
    assert.equal(facts.blocks, null);
    const { statements } = trendStatements(facts);
    assert.deepEqual(statements.filter((s) => s.section === "changes"), []);
    assert.equal(statements[0].key, "insufficient");
  });

  it("skips a gap without a TOP list and reports it", () => {
    const months = monthsFrom("2009-01", "2012-12").filter((period) => period < "2010-07" || period > "2011-07");
    const facts = trendFacts(input(data(months, [{ slug: "bmw", name: "BMW", value: () => 100 }]), ["bmw"]));
    assert.deepEqual(runs(facts.gaps), [{ from: "2010-07", to: "2011-07" }]);
    assert.deepEqual(facts.blocks, { start: { from: "2009-01", to: "2009-12" }, end: { from: "2012-01", to: "2012-12" } });
  });

  it("does not count a month without a category total", () => {
    const explorer = data(months36, [{ slug: "bmw", name: "BMW", value: () => 100 }]);
    explorer.registrations.totals = explorer.registrations.totals.filter(
      (row) => !(row.reporting_period === "2023-10" && row.metric_code === "first_registrations"),
    );
    const facts = trendFacts(input(explorer, ["bmw"]));
    assert.equal(facts.blocks?.start.from, "2023-11");
  });

  it("names a month far from the brand's median", () => {
    const explorer = data(months36, [{ slug: "bmw", name: "BMW", value: (period) => (period === "2025-03" ? 400 : 100) }]);
    const { statements } = trendStatements(trendFacts(input(explorer, ["bmw"])));
    const observation = statements.find((s) => s.section === "observation");
    assert.equal(observation?.key, "peak");
    assert.deepEqual(observation?.values.ratio, { kind: "ratio", value: 4 });
  });

  it("reports steadiness, not a spike, when no month stands out", () => {
    const explorer = data(months36, [{ slug: "bmw", name: "BMW", value: (_, i) => 100 + (i % 3) }]);
    const { statements } = trendStatements(trendFacts(input(explorer, ["bmw"])));
    assert.equal(statements.find((s) => s.section === "observation")?.key, "steadyRank");
  });
});

describe("rendered analysis", () => {
  it("cites only evidence that exists and passes its own number check", () => {
    const explorer = data(months36, [
      { slug: "bmw", name: "BMW", value: (_, i) => (i < 12 ? 100 : 160) },
      { slug: "skoda", name: "SKODA", value: (period) => (period === "2025-12" ? null : 90) },
      { slug: "toyota", name: "TOYOTA", value: (_, i) => (i < 12 ? 210 : 190) },
    ]);
    for (const locale of ["et", "en"] as const) {
      const { rendered } = render(explorer, ["bmw", "skoda", "toyota"], locale);
      const ids = new Set(rendered.evidence.map((row) => row.id));
      for (const statement of rendered.request.statements) for (const id of statement.evidence) assert.ok(ids.has(id));
      const check = validateAnalysis(rendered.analysis, rendered.request);
      assert.ok(check.ok, JSON.stringify(check));
      assert.equal(rendered.analysis.keyChanges.length, 4); // three brands and the type total
    }
  });

  it("formats signs, shares and percentage points", () => {
    const explorer = data(months36, [{ slug: "bmw", name: "BMW", value: (_, i) => (i < 12 ? 100 : 90) }]);
    const { rendered } = render(explorer, ["bmw"]);
    // et-EE groups thousands only from five digits; "%" and "pp" follow a no-break space; minus is U+2212.
    assert.equal(
      rendered.analysis.keyChanges[0].text,
      "BMW: 1200 → 1080 esmaregistreerimist (−10,0 %); osakaal liigis 10,0 % → 9,0 % (−1,0 pp).",
    );
  });
});

describe("real data", () => {
  const bundle = JSON.parse(readFileSync(new URL("../../data/published/bundle.json", import.meta.url), "utf-8")) as PublishedBundle;
  const explorer = { ...bundle, insights: [] } as unknown as ExplorerData;
  const latest = brandPeriodsOf(explorer, "passenger_car").at(-1)!;

  it("every preset window yields text that passes the number check", () => {
    const selections = [["bmw", "toyota", "skoda"], ["tesla"], ["volkswagen", "audi", "volvo", "kia"]];
    for (const years of [2, 5, 10, null]) {
      const from = years ? shiftPeriod(latest, -(years * 12 - 1)) : undefined;
      for (const slugs of selections) {
        for (const locale of ["et", "en"] as const) {
          const { facts, rendered } = render(explorer, slugs, locale, from);
          assert.notEqual(facts.status, "empty");
          const all = [rendered.analysis.summary.text, ...rendered.analysis.keyChanges.map((i) => i.text), rendered.analysis.comparison?.text ?? "", ...rendered.limitations].join(" ");
          assert.doesNotMatch(all, /NaN|undefined|Infinity|\{/);
          const check = validateAnalysis(rendered.analysis, rendered.request);
          assert.ok(check.ok, `${slugs} ${years} ${locale}: ${JSON.stringify(check)}`);
        }
      }
    }
  });

  it("names the 2010-2011 passenger-car gap over the whole period", () => {
    const { facts, rendered } = render(explorer, ["bmw"], "et");
    assert.deepEqual(runs(facts.gaps), [{ from: "2010-07", to: "2011-07" }]);
    assert.ok(rendered.limitations.some((line) => line.includes("13 kuul")));
  });
});
