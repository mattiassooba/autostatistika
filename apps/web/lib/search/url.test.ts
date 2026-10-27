import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareParam, emptySearch, parseCompare, parseSearch, searchParams } from "./url";

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

  it("keeps a comparison only for the snapshot it was made in", () => {
    const refs = [
      { make: "toyota", id: 1234 },
      { make: "bmw", id: 5678 },
    ];
    const value = compareParam(refs, "2026-10-01");
    assert.equal(value, "2026-10-01:toyota~1234,bmw~5678");
    assert.deepEqual(parseCompare(value, "2026-10-01"), refs);
    assert.deepEqual(parseCompare(value, "2026-11-01"), []);
    assert.deepEqual(parseCompare("2026-10-01:toyota~1,x/y~2,bmw~3,a~4,b~5,c~6", "2026-10-01").length, 4);
  });

  it("keeps the default view's URL empty", () => {
    assert.equal(searchParams(emptySearch()).toString(), "");
  });
});
