// Browser side of the optional AI wording. The site is static, so the model is
// reached through a small Cloudflare Worker (workers/trend-analyst) that holds
// the API key, rate-limits and caches. Without NEXT_PUBLIC_TREND_API_URL at build
// time there is no request at all and the computed text is shown.
//
// The page sends only the selection and the hash of the request it computed; the
// Worker rebuilds the statements from the site's trend file and refuses a
// mismatch, so no text from a caller ever reaches the model.

import { generationId } from "../data/slices";
import { requestHash, validateAnalysis, type AnalysisRequest, type AnalysisText, type SelectionRequest } from "./validate";
import type { TrendSelection } from "./build";

export const TREND_API_URL = process.env.NEXT_PUBLIC_TREND_API_URL ?? "";

export type ModelResult =
  | { ok: true; analysis: AnalysisText; model: string }
  | { ok: false; reason: "unavailable" | "rateLimited" | "invalid" };

const TIMEOUT_MS = 25_000;
const answers = new Map<string, Extract<ModelResult, { ok: true }>>();

export async function requestWording(
  request: AnalysisRequest,
  selection: TrendSelection & { generatedAt: string },
  options: { fresh?: boolean; signal?: AbortSignal } = {},
): Promise<ModelResult> {
  const hash = await requestHash(request);
  const known = answers.get(hash);
  if (known && !options.fresh) return known;

  const body: SelectionRequest = {
    v: 2,
    locale: selection.locale,
    generation: generationId(selection.generatedAt),
    category: selection.category,
    brands: selection.brands,
    from: selection.from,
    hash,
    fresh: Boolean(options.fresh),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(TREND_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 429) return { ok: false, reason: "rateLimited" };
    if (response.status === 422) return { ok: false, reason: "invalid" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const answer = (await response.json()) as { analysis?: unknown; model?: unknown };
    // The Worker validates too; the page does not trust it blindly.
    const checked = validateAnalysis(answer.analysis, request);
    if (!checked.ok) return { ok: false, reason: "invalid" };
    const result = { ok: true as const, analysis: checked.value, model: typeof answer.model === "string" ? answer.model : "" };
    answers.set(hash, result);
    return result;
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
