import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { variantsCsv } from "./csv";
import type { Variant } from "./engine";

const variant = (patch: Partial<Variant>): Variant => ({
  id: 1,
  make: "toyota",
  model: "RAV4",
  year: 2024,
  engine: "BENSIIN_HYBRIID",
  power: 131,
  gearbox: "CVT",
  body: "UNIVERSAAL",
  vehicles: 805,
  ...patch,
});

describe("search CSV", () => {
  it("writes a BOM, semicolons and empty cells for missing values", () => {
    const csv = variantsCsv([variant({}), variant({ id: 2, model: 'MODEL "X"; LONG', power: null, year: null })], [
      { header: "Mark", value: (v) => v.make },
      { header: "Mudel", value: (v) => v.model },
      { header: "Aasta", value: (v) => v.year },
      { header: "kW", value: (v) => v.power },
      { header: "Sõidukeid", value: (v) => v.vehicles },
    ]);
    assert.ok(csv.startsWith("﻿Mark;Mudel;Aasta;kW;Sõidukeid\r\n"));
    const lines = csv.slice(1).trimEnd().split("\r\n");
    assert.equal(lines[1], "toyota;RAV4;2024;131;805");
    // A missing year or power is an empty cell, and quotes and semicolons are escaped.
    assert.equal(lines[2], 'toyota;"MODEL ""X""; LONG";;;805');
  });
});
