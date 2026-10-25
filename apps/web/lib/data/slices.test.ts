import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeTable, encodeTable } from "./table";
import { buildExplorerData, isSliceKey, requiredSlices, type Catalog, type CorePayload } from "./slices";

const catalog: Catalog = {
  brandPeriods: { passenger_car: ["2026-08", "2026-09"], truck: ["2026-09"] },
  fuelPeriods: {},
  modelPeriods: {},
  regionDates: {},
  fleetBrandDates: {},
  stationPeriods: ["2019-04"],
};

const core: CorePayload = {
  generatedAt: "2026-10-25T00:00:00+00:00",
  disclaimer: { et: "", en: "" },
  insights: [],
  catalog,
  tables: {
    totals: encodeTable([{ reporting_period: "2026-09", category_code: "passenger_car", metric_code: "first_registrations", value: 3639 }]),
    snapshots: encodeTable([]),
    ages: encodeTable([]),
    national: encodeTable([]),
  },
};

describe("table encoding", () => {
  it("round-trips rows with dictionary-encoded strings and nulls", () => {
    const rows = [
      { period: "2026-09", brand: "BMW", value: 565, complete: true, note: null },
      { period: "2026-09", brand: "SKODA", value: 339, complete: false, note: "x" },
      { period: "2026-08", brand: "BMW", value: 500, complete: true, note: null },
    ];
    const encoded = encodeTable(rows);
    assert.deepEqual(encoded.d[0], ["2026-09", "2026-08"]);
    assert.deepEqual(decodeTable(encoded), rows);
  });
});

describe("slices", () => {
  it("validates slice keys against a fixed grammar", () => {
    assert.ok(isSliceKey("brands:passenger_car"));
    assert.ok(isSliceKey("month:2026-09"));
    assert.ok(isSliceKey("fleet:2015-01-01"));
    assert.ok(!isSliceKey("brands:../../etc"));
    assert.ok(!isSliceKey("month:2026-9"));
  });

  it("does not double count rows present in two overlapping slices", () => {
    const models = [{ reporting_period: "2026-08", category_code: "passenger_car", brand_slug: "bmw", brand_source: "BMW", model_source: "X3", value: 20 }];
    const a = { key: "month:2026-09", tables: { models: encodeTable(models) } };
    const b = { key: "month:2026-08", tables: { models: encodeTable(models) } };
    const data = buildExplorerData(core, [a, b]);
    assert.equal(data.registrations.models.length, 1);
    assert.equal(data.registrations.totals[0].value, 3639);
  });

  it("asks only for the slices a view renders", () => {
    const view = {
      tab: "registreerimised" as const,
      registrations: { category: "truck", period: "2026-09" },
      fleet: { date: "" },
      inspections: { period: "" },
    };
    assert.deepEqual(requiredSlices(view, catalog).sort(), ["brands:passenger_car", "brands:truck", "month:2026-09"]);
    const insp = { ...view, tab: "ulevaatused" as const, inspections: { period: "2010-01" } };
    assert.deepEqual(requiredSlices(insp, catalog), ["brands:passenger_car"]);
  });
});
