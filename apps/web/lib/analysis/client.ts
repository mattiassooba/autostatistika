// Browser side of the optional AI wording. The site is static, so the model is
// reached through a small Cloudflare Worker (workers/trend-analyst) that holds
// the API key, rate-limits and caches. Without NEXT_PUBLIC_TREND_API_URL at build
// time there is no request at all and the computed text is shown.

import { validateAnalysis, type AnalysisRequest, type AnalysisText } from "./validate";

export const TREND_API_URL = process.env.NEXT_PUBLIC_TREND_API_URL ?? "";

export type ModelResult =
  | { ok: true; analysis: AnalysisText; model: string }
  | { ok: false; reason: "unavailable" | "rateLimited" | "invalid" };

const TIMEOUT_MS = 25_000;
const answers = new Map<string, Extract<ModelResult, { ok: true }>>();

export async function requestWording(request: AnalysisRequest, options: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<ModelResult> {
  const key = JSON.stringify(request);
  const known = answers.get(key);
  if (known && !options.fresh) return known;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(TREND_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, fresh: Boolean(options.fresh) }),
      signal: controller.signal,
    });
    if (response.status === 429) return { ok: false, reason: "rateLimited" };
    if (response.status === 422) return { ok: false, reason: "invalid" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const body = (await response.json()) as { analysis?: unknown; model?: unknown };
    // The Worker validates too; the page does not trust it blindly.
    const checked = validateAnalysis(body.analysis, request);
    if (!checked.ok) return { ok: false, reason: "invalid" };
    const result = { ok: true as const, analysis: checked.value, model: typeof body.model === "string" ? body.model : "" };
    answers.set(key, result);
    return result;
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
