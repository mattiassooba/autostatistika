import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnalysisRequest, AnalysisText } from "../../../apps/web/lib/analysis/validate";
import { createHandler, type Env, type KV } from "../src/index";
import type { ModelAnswer } from "../src/model";

const ORIGIN = "https://autostatistika.ee";

const body: AnalysisRequest = {
  v: 1,
  locale: "en",
  context: { category: "Passenger cars", brands: ["BMW", "Toyota"], period: "Oct 2021 – Sept 2026", source: "Transport Administration" },
  statements: [
    { id: "s1", section: "summary", text: "The largest change was BMW: 6,289 → 4,483 first registrations (−28.7%).", evidence: ["e1", "e2"] },
    { id: "s2", section: "changes", text: "BMW: 6,289 → 4,483 first registrations (−28.7%).", evidence: ["e1", "e2"] },
    { id: "s3", section: "comparison", text: "Oct 2025 – Sept 2026: BMW 4,483 and Toyota 4,064.", evidence: ["e2", "e3"] },
    { id: "s4", section: "observation", text: "BMW was ranked in all 60 months, between 1 and 4.", evidence: ["e4"] },
  ],
  evidence: [
    { id: "e1", label: "BMW, first registrations", period: "Oct 2021 – Sept 2022", value: "6,289" },
    { id: "e2", label: "BMW, first registrations", period: "Oct 2025 – Sept 2026", value: "4,483" },
    { id: "e3", label: "Toyota, first registrations", period: "Oct 2025 – Sept 2026", value: "4,064" },
    { id: "e4", label: "BMW, ranks", period: "Oct 2021 – Sept 2026", value: "#1–4" },
  ],
  limitations: ["The analysis describes the figures, not their causes."],
};

const answer: AnalysisText = {
  summary: { text: "BMW changed the most, falling from 6,289 to 4,483 first registrations (−28.7%).", evidence: ["e1", "e2"] },
  keyChanges: [{ text: "BMW fell from 6,289 to 4,483 (−28.7%).", evidence: ["e1", "e2"] }],
  comparison: { text: "In Oct 2025 – Sept 2026 BMW had 4,483 and Toyota 4,064.", evidence: ["e2", "e3"] },
  observation: { text: "BMW stayed in the ranking all 60 months, between 1 and 4.", evidence: ["e4"] },
};

function kv(): KV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return { store, get: async (key) => store.get(key) ?? null, put: async (key, value) => void store.set(key, value) };
}

function setup(model: (calls: number) => ModelAnswer = () => ({ ok: true, candidate: answer }), env: Partial<Env> = {}) {
  let calls = 0;
  const handle = createHandler({
    callModel: async () => {
      calls += 1;
      return model(calls);
    },
  });
  const cache = kv();
  const fullEnv: Env = { ANTHROPIC_API_KEY: "test", ALLOWED_ORIGINS: ORIGIN, CACHE: cache, ...env };
  const post = (payload: unknown, origin = ORIGIN) =>
    handle(new Request("https://worker.test/", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) }), fullEnv);
  return { post, handle, env: fullEnv, cache, calls: () => calls };
}

describe("trend analyst worker", () => {
  it("returns a validated answer and caches it", async () => {
    const { post, calls } = setup();
    const first = await post(body);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("access-control-allow-origin"), ORIGIN);
    assert.deepEqual(await first.json(), { analysis: answer, model: "claude-haiku-5-5", cached: false });
    const second = await post(body);
    assert.equal((await second.json()).cached, true);
    assert.equal(calls(), 1);
  });

  it("asks the model again for a fresh answer", async () => {
    const { post, calls } = setup();
    await post(body);
    await post({ ...body, fresh: true });
    assert.equal(calls(), 2);
  });

  it("refuses text with a number that is not in the evidence, and does not cache it", async () => {
    const bad = { ...answer, summary: { text: "BMW fell by 1,806 registrations.", evidence: ["e1"] } };
    const { post, cache } = setup(() => ({ ok: true, candidate: bad }));
    const response = await post(body);
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "invalid", reason: "number:1806" });
    assert.ok(![...cache.store.keys()].some((key) => key.startsWith("answer:")));
  });

  it("checks the origin and answers the preflight", async () => {
    const { post, handle, env } = setup();
    assert.equal((await post(body, "https://example.com")).status, 403);
    const preflight = await handle(new Request("https://worker.test/", { method: "OPTIONS", headers: { origin: ORIGIN } }), env);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  });

  it("rate-limits per IP and caps the day", async () => {
    const limited = setup(undefined, { RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const response = await limited.post(body);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");

    const capped = setup(undefined, { DAILY_LIMIT: "1" });
    assert.equal((await capped.post(body)).status, 200);
    assert.equal((await capped.post({ ...body, locale: "en", context: { ...body.context, period: "Oct 2021 – Sep 2026" } })).status, 503);
  });

  it("rejects malformed and oversized requests before the model", async () => {
    const { post, calls } = setup();
    assert.equal((await post({ ...body, v: 2 })).status, 400);
    assert.equal((await post({ ...body, statements: body.statements.slice(0, 3) })).status, 400); // no observation
    assert.equal((await post({ ...body, context: { ...body.context, brands: ["a", "b", "c", "d", "e"] } })).status, 400);
    assert.equal((await post({ ...body, limitations: ["x".repeat(30_000)] })).status, 413);
    assert.equal(calls(), 0);
  });

  it("passes model errors on as an error status", async () => {
    const { post } = setup(() => ({ ok: false, status: 502, error: "upstream_connection" }));
    const response = await post(body);
    assert.equal(response.status, 502);
  });

  it("is unavailable without an API key", async () => {
    const { post } = setup(undefined, { ANTHROPIC_API_KEY: undefined });
    assert.equal((await post(body)).status, 503);
  });
});
