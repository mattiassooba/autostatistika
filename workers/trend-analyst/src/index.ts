// POST / with a SelectionRequest → { analysis, model, cached }.
//
// The request carries a selection, never text. The Worker reads the site's own
// trend file for that data generation, rebuilds the statements with the page's
// code (apps/web/lib/analysis/build.ts) and goes on only if the hash matches
// the page's. So the model only ever sees sentences this code wrote.
//
// Order of work: origin check, per-IP rate limit, selection checks, rebuild and
// hash check, cache, daily budget, model call, validation. Only validated answers
// are cached and returned; the page falls back to its computed text on any error
// status. Without the budget binding no model call is made (fail closed).

export { DailyBudget } from "./budget";

import { validateAnalysis, requestHash, type AnalysisRequest, type AnalysisText } from "../../../apps/web/lib/analysis/validate";
import { buildRegistrationTrend, buildTrend } from "../../../apps/web/lib/analysis/build";
import { messageTranslator, trendFileData, type TrendFile } from "../../../apps/web/lib/analysis/trend-file";
import { callModel as defaultCallModel, PROMPT_VERSION, type ModelAnswer } from "./model";
import { MAX_BODY_BYTES, parseSelection } from "./request";
import { takeCall, type BudgetNamespace } from "./budget";

/** The KV and rate-limit binding methods this Worker uses. */
export type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};
export type RateLimit = { limit(options: { key: string }): Promise<{ success: boolean }> };

export type Env = {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  SITE_ORIGIN?: string;
  MODEL?: string;
  DAILY_LIMIT?: string;
  CACHE?: KV;
  RATE_LIMITER?: RateLimit;
  BUDGET?: BudgetNamespace;
};

type Deps = {
  callModel: (request: AnalysisRequest, options: { apiKey: string; model: string }) => Promise<ModelAnswer>;
  /** The site's trend file; null when it does not exist (another data generation). */
  loadTrendFile: (url: string) => Promise<TrendFile | null>;
};

const CACHE_TTL = 30 * 24 * 3600;

// Trend files per isolate: a few hundred KB each, immutable per generation.
const files = new Map<string, Promise<TrendFile | null>>();
async function fetchTrendFile(url: string): Promise<TrendFile | null> {
  let file = files.get(url);
  if (!file) {
    file = fetch(url).then(async (response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`trend file ${response.status}`);
      return (await response.json()) as TrendFile;
    });
    files.set(url, file);
    file.catch(() => files.delete(url));
    if (files.size > 8) files.delete(files.keys().next().value!);
  }
  return file;
}

export function createHandler(deps: Partial<Deps> = {}) {
  const callModel = deps.callModel ?? defaultCallModel;
  const loadTrendFile = deps.loadTrendFile ?? fetchTrendFile;

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
    const selection = parseSelection(body);
    if (!selection) return json(400, { error: "request" });

    // Rebuild the statements from the site's data, exactly as the page did.
    const site = (env.SITE_ORIGIN ?? "https://autostatistika.ee").replace(/\/$/, "");
    let file: TrendFile | null;
    try {
      file = await loadTrendFile(`${site}/data/${selection.generation}/trend/${selection.category}.json`);
    } catch {
      return json(502, { error: "site_data" });
    }
    if (!file) return json(409, { error: "generation" });
    const data = trendFileData(file);
    const known = new Set(data.registrations.brands.map((row) => row.brand_slug));
    if (!selection.brands.every((slug) => known.has(slug))) return json(400, { error: "brand" });
    const categoryLabel = file.messages[selection.locale]?.categories?.[selection.category];
    if (!categoryLabel) return json(400, { error: "category" });
    const t = messageTranslator(file.messages[selection.locale].trend);
    const { facts, rendered } =
      selection.kind === "registrations"
        ? buildRegistrationTrend(data, { locale: selection.locale, category: selection.category, period: selection.period! }, categoryLabel, t)
        : buildTrend(data, { locale: selection.locale, category: selection.category, brands: selection.brands, from: selection.from }, categoryLabel, t);
    if (facts.status !== "ok") return json(400, { error: "insufficient" });
    const analysisRequest = rendered.request;
    const hash = await requestHash(analysisRequest);
    if (hash !== selection.hash) return json(409, { error: "mismatch" });

    const model = env.MODEL || "claude-haiku-5-5";
    const key = `answer:v${PROMPT_VERSION}:${model}:${hash}`;
    if (!selection.fresh && env.CACHE) {
      const hit = await env.CACHE.get(key);
      if (hit) {
        const checked = validateAnalysis(JSON.parse(hit), analysisRequest);
        if (checked.ok) return json(200, { analysis: checked.value, model, cached: true });
      }
    }

    if (!env.ANTHROPIC_API_KEY) return json(503, { error: "not_configured" });

    // Hard daily cap on model calls across all visitors (atomic Durable Object counter).
    if (!env.BUDGET) return json(503, { error: "no_budget" });
    const limit = Number(env.DAILY_LIMIT ?? "50");
    const budget = await takeCall(env.BUDGET, Number.isFinite(limit) ? limit : 0);
    if (!budget.ok) return json(503, { error: "daily_limit" });

    const started = Date.now();
    const answer = await callModel(analysisRequest, { apiKey: env.ANTHROPIC_API_KEY, model });
    const log = (outcome: string, extra: Record<string, unknown> = {}) =>
      console.log(JSON.stringify({ event: "model_call", outcome, model, ms: Date.now() - started, calls_today: budget.used, ...extra }));
    if (!answer.ok) {
      log("error", { error: answer.error });
      return json(answer.status, { error: answer.error });
    }
    const checked = validateAnalysis(answer.candidate, analysisRequest);
    // A rejected answer is logged with an excerpt, to tell a real problem from an over-strict check.
    log(checked.ok ? "accepted" : "rejected", {
      ...answer.usage,
      ...(checked.ok ? {} : { reason: checked.reason, excerpt: JSON.stringify(answer.candidate).slice(0, 800) }),
    });
    if (!checked.ok) return json(422, { error: "invalid", reason: checked.reason });
    const analysis: AnalysisText = checked.value;
    if (env.CACHE) await env.CACHE.put(key, JSON.stringify(analysis), { expirationTtl: CACHE_TTL });
    return json(200, { analysis, model, cached: false, usage: answer.usage });
  };
}

const handle = createHandler();

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
