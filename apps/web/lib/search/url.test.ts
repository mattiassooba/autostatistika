import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptySearch, parseSearch, searchParams } from "./url";

describe("search URL", () => {
  it("round-trips a search", () => {
    const state = {
      ...emptySearch("truck"),
      makes: ["volkswagen", "mercedes-benz"],
      models: ["CRAFTER"],
      text: { engine: ["DIISEL"], county: ["Harju", "Tartu"], category: ["N1"] },
      ranges: { year: [2015, null] as [number, null], power: [null, 120] as [null, number] },
      sort: "year" as const,
      dir: 1 as const,
    };
    const params = searchParams(state);
    assert.equal(params.get("year"), "2015..");
    assert.equal(params.get("power"), "..120");
    assert.deepEqual(parseSearch(params), state);
  });

  it("drops what it cannot read instead of guessing", () => {
    const parsed = parseSearch(new URLSearchParams("category=../x&brands=BMW,bmw,a/b&year=abc&power=200..100&sort=price"));
    assert.equal(parsed.family, "passenger_car");
    assert.deepEqual(parsed.makes, ["bmw"]);
    assert.equal(parsed.ranges.year, undefined);
    // A reversed range is read as the range it describes.
    assert.deepEqual(parsed.ranges.power, [100, 200]);
    assert.equal(parsed.sort, "vehicles");
  });

  it("keeps the default view's URL empty", () => {
    assert.equal(searchParams(emptySearch()).toString(), "");
  });
});
