import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandDetail, brandSlugs, isBrandSlug, monthDetail, monthIndex, shiftPeriod } from "./pages";
import type { PublishedBundle } from "./types";

// 2025-10 … 2026-09: twelve months. The model sheet reconciles everywhere except
// 2026-03, where its rows are doubled (as in the real 2024 summer files).
const periods = Array.from({ length: 12 }, (_, i) => shiftPeriod("2025-10", i));

function bundle(): PublishedBundle {
  const totals = periods.flatMap((period) => [
    { reporting_period: period, category_code: "passenger_car", metric_code: "first_registrations", value: 300 },
    { reporting_period: period, category_code: "passenger_car", metric_code: "new_vehicles", value: 100 },
  ]);
  const brands = periods.flatMap((period) => [
    { reporting_period: period, category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", value: 60 },
    { reporting_period: period, category_code: "passenger_car", brand_slug: "mercedes-benz", brand_source: "MERCEDES-BENZ", value: 40 },
  ]);
  brands.push({ reporting_period: "2026-09", category_code: "passenger_car", brand_slug: "1", brand_source: "1", value: 999 });
  brands.push({ reporting_period: "2026-09", category_code: "passenger_car", brand_slug: "grand-total", brand_source: "GRAND TOTAL", value: 9999 });
  const models = periods.flatMap((period) => {
    const rows = [
      { reporting_period: period, category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", model_source: "X5", value: 30 },
      {
        reporting_period: period,
        category_code: "passenger_car",
        brand_slug: period < "2026-01" ? "tesla-motors" : "tesla",
        brand_source: period < "2026-01" ? "TESLA MOTORS" : "TESLA",
        model_source: "MODEL Y",
        value: 70,
      },
    ];
    return period === "2026-03" ? [...rows, ...rows] : rows;
  });
  return {
    generatedAt: "2026-10-25T00:00:00+00:00",
    disclaimer: { et: "", en: "" },
    registrations: { totals, brands, fuels: [], models },
    fleet: { snapshots: [], brands: [], regions: [], ages: [] },
    inspections: { national: [], stations: [] },
    insights: [],
  };
}

describe("brand pages", () => {
  it("drops parser debris from rankings", () => {
    assert.equal(isBrandSlug("1"), false);
    assert.equal(isBrandSlug("grand-total"), false);
    assert.equal(isBrandSlug("mercedes-benz"), true);
    const month = monthDetail(bundle(), "2026-09")!;
    assert.deepEqual(
      month.carBrands.map((entry) => [entry.slug, entry.rank, entry.share]),
      [
        ["bmw", 1, 20],
        ["mercedes-benz", 2, (40 / 300) * 100],
      ],
    );
  });

  it("gives pages to ranked brands and to brands with enough new cars, under one name per make", () => {
    assert.deepEqual(brandSlugs(bundle()), ["bmw", "mercedes-benz", "tesla"]);
    const tesla = brandDetail(bundle(), "tesla")!;
    assert.equal(tesla.name, "Tesla");
    assert.equal(tesla.newCars.find((entry) => entry.period === "2025-11")?.value, 70);
  });

  it("uses the model sheet only in months that reconcile with the stated new-car total", () => {
    const b = bundle();
    const bmw = brandDetail(b, "bmw")!;
    assert.equal(bmw.newCars.length, 11);
    assert.ok(!bmw.newCars.some((entry) => entry.period === "2026-03"));
    // A 12-month window that crosses the unreconciled month has no total.
    assert.equal(bmw.last12, null);
    assert.equal(monthDetail(b, "2026-03")!.models, null);
    assert.equal(monthDetail(b, "2026-09")!.models?.[0].model, "MODEL Y");
    assert.equal(bmw.newCarsLatest, 30);
    assert.equal(bmw.newCarsRankLatest, 2);
    assert.equal(bmw.newCarsShareLatest, 30);
    assert.equal(bmw.yearly.find((year) => year.year === "2026")?.months, 8);
    assert.deepEqual(
      bmw.yearly.map((year) => year.year),
      ["2025", "2026"],
    );
  });

  it("ranks a make in the register only on register dates, within the complete split", () => {
    const b = bundle();
    b.fleet.sources = [
      { snapshot_date: "2020-01-01", source: "register", retroactive: true },
      { snapshot_date: "2026-10-01", source: "register", retroactive: false },
    ];
    b.fleet.brands = [
      // An Infoleht top list on another date is not a complete split: never ranked here.
      { snapshot_date: "2014-12-01", category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", value: 9, complete: false },
      { snapshot_date: "2020-01-01", category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", value: 30, complete: true },
      { snapshot_date: "2020-01-01", category_code: "passenger_car", brand_slug: "tesla-motors", brand_source: "TESLA MOTORS", value: 10, complete: true },
      { snapshot_date: "2020-01-01", category_code: "passenger_car", brand_slug: "tesla", brand_source: "TESLA", value: 60, complete: true },
      { snapshot_date: "2026-10-01", category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", value: 80, complete: true },
      { snapshot_date: "2026-10-01", category_code: "passenger_car", brand_slug: "tesla", brand_source: "TESLA", value: 20, complete: true },
    ];
    const bmw = brandDetail(b, "bmw")!;
    assert.deepEqual(
      bmw.fleetCars.map((p) => [p.date, p.value, p.rank, p.share, p.retroactive]),
      [
        ["2020-01-01", 30, 2, 30, true],
        ["2026-10-01", 80, 1, 80, false],
      ],
    );
    // TESLA MOTORS counts as Tesla.
    assert.equal(brandDetail(b, "tesla")!.fleetCars[0].value, 70);
    assert.deepEqual(bmw.fleetTrucks, []);
  });

  it("splits a month's new cars by dimension, with the stated new cars as denominator", () => {
    const b = bundle();
    const row = (dimension: string, value: string, n: number) => ({
      reporting_period: "2026-09",
      category_code: "passenger_car",
      dimension,
      dimension_value: value,
      value: n,
    });
    b.registrations.breakdowns = [
      row("power_band", "unknown", 5),
      row("power_band", "101-150", 40),
      row("power_band", "0-70", 55),
      row("county", "tartu", 30),
      row("county", "harju", 70),
      { ...row("county", "harju", 9), category_code: "truck" },
    ];
    const month = monthDetail(b, "2026-09")!;
    assert.deepEqual(
      month.newCarSplits.map((split) => [split.dimension, split.rows.map((r) => [r.code, r.value, Math.round(r.share! * 100) / 100])]),
      [
        ["county", [["harju", 70, 70], ["tartu", 30, 30]]],
        // Power bands keep their order; "unknown" goes last and is never zero-filled.
        ["power_band", [["0-70", 55, 55], ["101-150", 40, 40], ["unknown", 5, 5]]],
      ],
    );
    assert.deepEqual(monthDetail(b, "2026-08")!.newCarSplits, []);
  });

  it("totals a year only when all twelve months exist", () => {
    const index = monthIndex(bundle());
    assert.deepEqual(
      index.map((year) => [year.year, year.months.length, year.carsFirst]),
      [
        ["2026", 9, null],
        ["2025", 3, null],
      ],
    );
  });
});
