import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQuery, toSearchParams } from "./url-state";

describe("url state", () => {
  it("defaults to registrations", () => {
    const query = parseQuery({});
    assert.equal(query.tab, "registreerimised");
    assert.deepEqual(query.brands, []);
  });

  it("roundtrips a shared URL", () => {
    const query = parseQuery({
      tab: "registreerimised",
      category: "passenger_car",
      brands: "toyota,skoda",
      from: "2025-11",
      to: "2026-09",
    });
    assert.equal(query.category, "passenger_car");
    assert.deepEqual(query.brands, ["toyota", "skoda"]);
    assert.equal(toSearchParams(query).get("brands"), "toyota,skoda");
  });

  it("ignores an unknown tab", () => {
    assert.equal(parseQuery({ tab: "pricing" }).tab, "registreerimised");
  });

  it("preserves fleet snapshot and inspection population", () => {
    const query = parseQuery({
      tab: "soidukipark",
      snapshot: "2020-12-31",
      category: "bus",
    });
    assert.equal(query.snapshot, "2020-12-31");
    assert.equal(toSearchParams(query).get("snapshot"), "2020-12-31");
    const inspections = parseQuery({ tab: "ulevaatused", population: "tractors" });
    assert.equal(inspections.population, "tractors");
  });
});
