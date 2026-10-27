// POST / with an AnalysisRequest → { analysis, model, cached }.
//
// Order of work: origin check, per-IP rate limit, body checks, cache, daily cap,
// model call, validation. Only validated answers are cached and returned; the
// page falls back to its computed text on any error status.

import { validateAnalysis, type AnalysisRequest, type AnalysisText } from "../../../apps/web/lib/analysis/validate";
import { callModel as defaultCallModel, PROMPT_VERSION, type ModelAnswer } from "./model";
import { MAX_BODY_BYTES, parseRequest } from "./request";

/** The KV and rate-limit binding methods this Worker uses. */
export type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};
export type RateLimit = { limit(options: { key: string }): Promise<{ success: boolean }> };

export type Env = {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  MODEL?: string;
  DAILY_LIMIT?: string;
  CACHE?: KV;
  RATE_LIMITER?: RateLimit;
};

type Deps = { callModel: (request: AnalysisRequest, options: { apiKey: string; model: string }) => Promise<ModelAnswer> };

const CACHE_TTL = 30 * 24 * 3600;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createHandler(deps: Deps = { callModel: defaultCallModel }) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    const origins = (env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
    const origin = request.headers.get("origin") ?? "";
    const allowed = origins.includes(origin);
    const cors: Record<string, string> = allowed
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          vary: "origin",
        }
      : { vary: "origin" };
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors, ...headers } });

    if (!allowed) return json(403, { error: "origin" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json(405, { error: "method" }, { allow: "POST, OPTIONS" });

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: ip })).success) {
      return json(429, { error: "rate_limited" }, { "retry-after": "60" });
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "json" });
    }
    const parsed = parseRequest(body);
    if (!parsed) return json(400, { error: "request" });
    const { request: analysisRequest, fresh } = parsed;

    const model = env.MODEL || "claude-haiku-5-5";
    const key = `answer:v${PROMPT_VERSION}:${await sha256(JSON.stringify({ model, request: analysisRequest }))}`;
    if (!fresh && env.CACHE) {
      const hit = await env.CACHE.get(key);
      if (hit) {
        const checked = validateAnalysis(JSON.parse(hit), analysisRequest);
        if (checked.ok) return json(200, { analysis: checked.value, model, cached: true });
      }
    }

    if (!env.ANTHROPIC_API_KEY) return json(503, { error: "not_configured" });

    // A rough daily cap across all visitors (KV is eventually consistent, so it can overshoot slightly).
    const day = `calls:${new Date().toISOString().slice(0, 10)}`;
    const limit = Number(env.DAILY_LIMIT ?? "500");
    if (env.CACHE) {
      const used = Number((await env.CACHE.get(day)) ?? "0");
      if (used >= limit) return json(503, { error: "daily_limit" });
      await env.CACHE.put(day, String(used + 1), { expirationTtl: 2 * 24 * 3600 });
    }

    const answer = await deps.callModel(analysisRequest, { apiKey: env.ANTHROPIC_API_KEY, model });
    if (!answer.ok) {
      console.warn("model call failed", answer.error);
      return json(answer.status, { error: answer.error });
    }
    const checked = validateAnalysis(answer.candidate, analysisRequest);
    if (!checked.ok) {
      console.warn("model text rejected", checked.reason);
      return json(422, { error: "invalid", reason: checked.reason });
    }
    const analysis: AnalysisText = checked.value;
    if (env.CACHE) await env.CACHE.put(key, JSON.stringify(analysis), { expirationTtl: CACHE_TTL });
    return json(200, { analysis, model, cached: false });
  };
}

const handle = createHandler();

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
