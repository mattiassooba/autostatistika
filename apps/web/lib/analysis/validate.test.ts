import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractNumbers, validateAnalysis, type AnalysisRequest, type AnalysisText } from "./validate";

const request: AnalysisRequest = {
  v: 1,
  locale: "et",
  context: { category: "Sõiduautod", brands: ["BMW", "Toyota"], period: "okt 2021 – sept 2026", source: "Transpordiamet" },
  statements: [
    { id: "s1", section: "summary", text: "Toyota on valitud markidest suurim: okt 2025 – sept 2026 4 210 esmaregistreerimist ehk 11,9 % liigi kõigist esmaregistreerimistest.", evidence: ["e1", "e2"] },
    { id: "s2", section: "changes", text: "BMW: 1 200 → 1 080 esmaregistreerimist (−10,0 %); osakaal liigis 10,0 % → 9,0 % (−1,0 pp).", evidence: ["e3", "e4"] },
    { id: "s3", section: "changes", text: "Toyota: 3 900 → 4 210 esmaregistreerimist (+7,9 %).", evidence: ["e1", "e5"] },
    { id: "s4", section: "comparison", text: "Toyota ja BMW esmaregistreerimiste suhe oli 3,9 : 1.", evidence: ["e1", "e4"] },
    { id: "s5", section: "observation", text: "BMW oli edetabelis kõigil 60 kuul, kohtadel 3–7.", evidence: ["e6"] },
  ],
  evidence: [
    { id: "e1", label: "Toyota, esmaregistreerimised kokku", period: "okt 2025 – sept 2026", value: "4 210" },
    { id: "e2", label: "Toyota, osakaal liigis", period: "okt 2025 – sept 2026", value: "11,9 %" },
    { id: "e3", label: "BMW, esmaregistreerimised kokku", period: "okt 2021 – sept 2022", value: "1 200" },
    { id: "e4", label: "BMW, esmaregistreerimised kokku", period: "okt 2025 – sept 2026", value: "1 080" },
    { id: "e5", label: "Toyota, esmaregistreerimised kokku", period: "okt 2021 – sept 2022", value: "3 900" },
    { id: "e6", label: "BMW, edetabelikohad", period: "okt 2021 – sept 2026", value: "kohad 3–7" },
  ],
  limitations: ["Analüüs kirjeldab arve, mitte nende põhjusi."],
};

const good: AnalysisText = {
  summary: { text: "Valitud markidest oli suurim Toyota: okt 2025 – sept 2026 kokku 4 210 esmaregistreerimist, 11,9 % liigist.", evidence: ["e1", "e2"] },
  keyChanges: [
    { text: "BMW esmaregistreerimised vähenesid 1200-lt 1080-le (−10,0 %), osakaal langes 1,0 pp.", evidence: ["e3", "e4"] },
    { text: "Toyota kasvas 3 900-lt 4 210-le (+7,9 %).", evidence: ["e1", "e5"] },
  ],
  comparison: { text: "Toyota ja BMW suhe oli 3,9 : 1.", evidence: ["e1", "e4"] },
  observation: { text: "BMW püsis edetabelis kõigil 60 kuul kohtadel 3–7.", evidence: ["e6"] },
};

const withItem = (patch: Partial<AnalysisText>) => ({ ...good, ...patch });

describe("extractNumbers", () => {
  it("reads Estonian thousands and decimal commas", () => {
    assert.deepEqual(
      extractNumbers("1 234 ja 4 210,5 ning −10,0 % ja +7,9", "et").map((n) => [n.value, n.sign]),
      [["1234", ""], ["4210.5", ""], ["10", "-"], ["7.9", "+"]],
    );
  });
  it("reads English thousands commas and treats a period hyphen as no sign", () => {
    assert.deepEqual(
      extractNumbers("1,234.5 in 2020-10, down -3", "en").map((n) => [n.value, n.sign]),
      [["1234.5", ""], ["2020", ""], ["10", ""], ["3", "-"]],
    );
  });
});

describe("validateAnalysis", () => {
  it("accepts reworded text with the computed numbers", () => {
    const result = validateAnalysis(good, request);
    assert.ok(result.ok, JSON.stringify(result));
  });

  it("keeps no-break spaces and collapses other whitespace", () => {
    const text = withItem({ summary: { text: "Toyota:\n  11,9 %  liigist.", evidence: ["e2"] } });
    const result = validateAnalysis(text, request);
    assert.ok(result.ok);
    assert.equal(result.value.summary.text, "Toyota: 11,9 % liigist.");
  });

  it("joins digit groups and units with no-break spaces, so a figure never wraps", () => {
    const text = withItem({ summary: { text: "Toyota 4 210 ehk 11,9 % ja okt 2025 – sept 2026.", evidence: ["e1"] } });
    const result = validateAnalysis(text, request);
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.value.summary.text, "Toyota 4 210 ehk 11,9 % ja okt 2025 – sept 2026.");
  });

  it("rejects a number that is not in the evidence", () => {
    const result = validateAnalysis(withItem({ summary: { text: "Toyota kasvas 8 %.", evidence: ["e1"] } }), request);
    assert.deepEqual(result, { ok: false, reason: "number:8" });
  });

  it("rejects a flipped sign and a fall described as a rise", () => {
    const flipped = withItem({ keyChanges: [{ text: "BMW: +10,0 %.", evidence: ["e3"] }, good.keyChanges[1]] });
    assert.deepEqual(validateAnalysis(flipped, request), { ok: false, reason: "sign:10" });
    const fall = withItem({ keyChanges: [good.keyChanges[0], { text: "Toyota vähenes 7,9 %.", evidence: ["e1"] }] });
    assert.deepEqual(validateAnalysis(fall, request), { ok: false, reason: "direction:7.9" });
  });

  it("rejects causes, unknown evidence and missing key changes", () => {
    assert.deepEqual(validateAnalysis(withItem({ comparison: { text: "Toyota on suurem hinna tõttu.", evidence: ["e1"] } }), request), { ok: false, reason: "causal" });
    assert.deepEqual(validateAnalysis(withItem({ comparison: { text: "Suhe 3,9 : 1.", evidence: ["e9"] } }), request), { ok: false, reason: "evidence" });
    assert.deepEqual(validateAnalysis(withItem({ keyChanges: [good.keyChanges[0]] }), request), { ok: false, reason: "keyChanges" });
    assert.deepEqual(validateAnalysis(withItem({ observation: null }), request), { ok: false, reason: "sections" });
  });

  it("rejects markup and malformed objects", () => {
    assert.deepEqual(validateAnalysis(withItem({ summary: { text: "**Toyota** 4 210", evidence: ["e1"] } }), request), { ok: false, reason: "markup" });
    assert.deepEqual(validateAnalysis({ summary: "x" }, request), { ok: false, reason: "shape" });
    assert.deepEqual(validateAnalysis(null, request), { ok: false, reason: "shape" });
  });

  it("checks English causal words", () => {
    const en: AnalysisRequest = { ...request, locale: "en" };
    const text = withItem({ summary: { text: "Toyota led, driven by demand.", evidence: ["e1"] } });
    assert.deepEqual(validateAnalysis(text, en), { ok: false, reason: "causal" });
  });
});
