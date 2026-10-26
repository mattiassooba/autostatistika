import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeTable, encodeTable, numberAt, textAt } from "./format";
import { needsFullFiles, runSearch, sortVariants, variantDetail, type SearchFilters } from "./engine";

const FULL = [
  { name: "variant", kind: "number" },
  { name: "make", kind: "text" },
  { name: "family", kind: "text" },
  { name: "model", kind: "text" },
  { name: "engine", kind: "text" },
  { name: "gearbox", kind: "text" },
  { name: "body", kind: "text" },
  { name: "county", kind: "text" },
  { name: "colour", kind: "text" },
  { name: "year", kind: "number" },
  { name: "power", kind: "number", scale: 10 },
  { name: "co2_wltp", kind: "number" },
  { name: "length", kind: "number" },
  { name: "count", kind: "number" },
] as const;

const rows = [
  { variant: 1, make: "toyota", family: "passenger_car", model: "RAV4", engine: "BENSIIN_HYBRIID", gearbox: "CVT", body: "UNIVERSAAL", county: "Harju", colour: "VALGE", year: 2024, power: 131.0, co2_wltp: 126, length: 4600, count: 5 },
  { variant: 1, make: "toyota", family: "passenger_car", model: "RAV4", engine: "BENSIIN_HYBRIID", gearbox: "CVT", body: "UNIVERSAAL", county: "Tartu", colour: "MUST", year: 2024, power: 131.0, co2_wltp: null, length: 4605, count: 2 },
  { variant: 0, make: "toyota", family: "passenger_car", model: "COROLLA", engine: "BENSIIN", gearbox: "MANUAAL", body: "LUUKPÄRA", county: "Harju", colour: "HALL", year: 2008, power: 71.5, co2_wltp: null, length: 4220, count: 3 },
  { variant: 2, make: "toyota", family: "truck", model: "HILUX", engine: "DIISEL", gearbox: "MANUAAL", body: "PIKAP", county: "Harju", colour: "VALGE", year: 2019, power: 110.0, co2_wltp: null, length: 5330, count: 4 },
];

const full = decodeTable(encodeTable(rows, [...FULL]));

function filters(patch: Partial<SearchFilters> = {}): SearchFilters {
  return { family: "passenger_car", makes: [], models: [], text: {}, ranges: {}, ...patch };
}

describe("search files", () => {
  it("decode text and scaled number columns, with missing values", () => {
    assert.equal(full.rows, 4);
    assert.equal(textAt(full.columns.model, 2), "COROLLA");
    assert.equal(numberAt(full.columns.power, 2), 71.5);
    assert.equal(numberAt(full.columns.co2_wltp, 1), null);
  });
});

describe("search", () => {
  it("counts vehicles, not rows, within the family", () => {
    const result = runSearch([full], filters());
    assert.equal(result.vehicles, 10);
    assert.deepEqual(result.facets.model, [
      { value: "RAV4", vehicles: 7 },
      { value: "COROLLA", vehicles: 3 },
    ]);
  });

  it("groups identical specs into variants regardless of colour or county", () => {
    const result = runSearch([full], filters());
    const rav4 = result.variants.find((v) => v.model === "RAV4")!;
    assert.equal(rav4.vehicles, 7);
    assert.equal(rav4.power, 131);
    assert.equal(rav4.id, 1);
    assert.deepEqual(
      sortVariants(result.variants, "year", 1).map((v) => v.model),
      ["COROLLA", "RAV4"],
    );
  });

  it("excludes vehicles without a value from a range and says how many", () => {
    const result = runSearch([full], filters({ ranges: { co2_wltp: [null, 130] } }));
    assert.equal(result.vehicles, 5);
    // The two RAV4s and three Corollas without a WLTP figure are not zeros.
    assert.equal(result.missingForRange, 5);
  });

  it("filters text dimensions and power in kW", () => {
    const result = runSearch([full], filters({ text: { county: ["Harju"] }, ranges: { power: [100, null] } }));
    assert.equal(result.vehicles, 5);
    assert.deepEqual(result.powerBands, [{ band: "101-150", vehicles: 5 }]);
  });

  it("knows which filters the light index cannot answer", () => {
    const lite = decodeTable(
      encodeTable(
        rows.map(({ variant, make, model, engine, year, count }) => ({ variant, make, model, engine, year, power_kw: 100, count })),
        [
          { name: "variant", kind: "number" },
          { name: "make", kind: "text" },
          { name: "model", kind: "text" },
          { name: "engine", kind: "text" },
          { name: "year", kind: "number" },
          { name: "power_kw", kind: "number" },
          { name: "count", kind: "number" },
        ],
      ),
    );
    assert.equal(needsFullFiles(filters({ ranges: { power: [90, null], year: [2010, null] } }), lite), false);
    assert.equal(needsFullFiles(filters({ text: { colour: ["MUST"] } }), lite), true);
    assert.equal(needsFullFiles(filters({ ranges: { length: [4000, null] } }), lite), true);
  });

  it("summarises a variant's specs as ranges over its vehicles", () => {
    const f = filters({ models: ["RAV4"] });
    const detail = variantDetail([full], f, runSearch([full], f).variants[0].id);
    assert.equal(detail.vehicles, 7);
    assert.deepEqual(detail.numbers.length, { min: 4600, max: 4605, known: 7 });
    assert.deepEqual(detail.numbers.co2_wltp, { min: 126, max: 126, known: 5 });
    assert.deepEqual(detail.texts.colour, [
      { value: "VALGE", vehicles: 5 },
      { value: "MUST", vehicles: 2 },
    ]);
  });
});
