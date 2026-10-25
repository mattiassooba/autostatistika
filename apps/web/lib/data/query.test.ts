import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstRegistrationKpi, formatNumber, formatPercent, inspectionKpi } from "./query";
import type { PublishedBundle } from "./types";

const bundle = {
  generatedAt: "2026-10-24T00:00:00+00:00",
  disclaimer: { et: "", en: "" },
  registrations: {
    totals: [
      { reporting_period: "2026-09", category_code: "passenger_car", metric_code: "first_registrations", value: 3639 },
      { reporting_period: "2026-09", category_code: "passenger_car", metric_code: "new_vehicles", value: 1670 },
      { reporting_period: "2026-09", category_code: "passenger_car", metric_code: "used_first_registrations", value: 1969 },
    ],
    brands: [],
    fuels: [],
    models: [],
  },
  fleet: { snapshots: [], brands: [], regions: [], ages: [] },
  inspections: {
    national: [
      { reporting_period: "2019-04", population: "vehicles", metric_code: "inspections", value: 64144 },
      { reporting_period: "2019-04", population: "vehicles", metric_code: "inspections_repeat", value: 9798 },
    ],
    stations: [],
  },
  insights: [],
} as PublishedBundle;

describe("statistical helpers", () => {
  it("computes new-vehicle share from first registrations", () => {
    const kpi = firstRegistrationKpi(bundle, { tab: "registreerimised", brands: [] });
    assert.equal(kpi.first, 3639);
    assert.ok(kpi.newShare != null);
    assert.equal(Math.round((kpi.newShare ?? 0) * 10) / 10, 45.9);
  });

  it("does not treat missing as zero", () => {
    assert.equal(formatNumber(null, "et"), "—");
    assert.equal(formatPercent(null, "et"), "—");
  });

  it("computes inspection repeat share from events", () => {
    const kpi = inspectionKpi(bundle, { tab: "ulevaatused", brands: [] });
    assert.equal(kpi.total, 64144);
    assert.ok(kpi.repeatShare != null);
    assert.equal(Math.round((kpi.repeatShare ?? 0) * 10) / 10, 15.3);
  });
});
