// One Messages API call: Claude rewords the computed statements into the four
// parts of the analysis card. Structured output fixes the shape; the numbers are
// checked afterwards by validateAnalysis.

import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisRequest } from "../../../apps/web/lib/analysis/validate";

/** Changing the prompt or schema changes the cache key. */
export const PROMPT_VERSION = 3;

const SYSTEM = `You write the text of a short statistical note on autostatistika.ee, a site that republishes official Estonian vehicle statistics from the Transport Administration (Transpordiamet).

You receive statements that the site has already computed from the data, each with the ids of the evidence rows it rests on. Rewrite them as clear, compact prose for a reader of an automotive market report, in the language given by "locale" ("et" = Estonian, "en" = English).

Return four parts:
- summary: the most important trend in one or two sentences, from the "summary" statements.
- keyChanges: exactly one item per "changes" statement, in the same order.
- comparison: the differences between the brands, from the "comparison" statements.
- observation: the unusual month or steady pattern, from the "observation" statement.
For every part, list the evidence ids it rests on: the ids from the statements' "evidence" lists, which start with "e" (for example "e3"). Never list statement ids ("s1").

Rules:
- Use only numbers that appear in the statements or evidence, copied exactly as written: same digits, sign, decimal separator and unit. Never calculate, round, average or combine numbers, and never add a number of your own (no "twice", "a third", "doubled").
- Describe, do not explain. Name no causes, reasons, drivers, forecasts or advice.
- context.kind says what the figures are:
  - "brands": first registrations of brands on each month's TOP list. A month in which a brand is not on the list is unknown, not zero. Brand rows count new and used vehicles together; do not describe them as new-car sales. Do not claim a brand became more or less popular in general; say what the figures show for the stated months.
  - "registrations": one vehicle type's monthly totals from the general table: first registrations in Estonia, of which new and used (imported second-hand), and new vehicles to private owners. These are not sales or ownership changes.
- Keep every caveat a statement makes, for example that totals were not compared.
- Never dispute, correct or negate a statement; if one seems unclear, keep its wording.
- Plain sentences only: no markdown, lists inside text, emoji, quotation of ids or URLs.
- In Estonian keep brand names in the nominative where possible ("margil BMW", "BMW esmaregistreerimised").`;

const ITEM = {
  type: "object",
  properties: { text: { type: "string" }, evidence: { type: "array", items: { type: "string" } } },
  required: ["text", "evidence"],
  additionalProperties: false,
} as const;

const SCHEMA = {
  type: "object",
  properties: { summary: ITEM, keyChanges: { type: "array", items: ITEM }, comparison: ITEM, observation: ITEM },
  required: ["summary", "keyChanges", "comparison", "observation"],
  additionalProperties: false,
} as const;

export type Usage = { input_tokens: number; output_tokens: number };
export type ModelAnswer = { ok: true; candidate: unknown; usage?: Usage } | { ok: false; status: number; error: string };

export async function callModel(request: AnalysisRequest, options: { apiKey: string; model: string }): Promise<ModelAnswer> {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 20_000 });
  try {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: JSON.stringify(request) }],
    });
    if (response.stop_reason === "refusal") return { ok: false, status: 502, error: "refusal" };
    if (response.stop_reason === "max_tokens") return { ok: false, status: 502, error: "max_tokens" };
    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) return { ok: false, status: 502, error: "empty" };
    const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    try {
      return { ok: true, candidate: JSON.parse(text), usage };
    } catch {
      return { ok: false, status: 502, error: "json" };
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, status: 503, error: "upstream_rate_limit" };
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, status: 503, error: "upstream_auth" };
    }
    if (error instanceof Anthropic.BadRequestError) return { ok: false, status: 502, error: "upstream_bad_request" };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, status: 502, error: "upstream_connection" };
    if (error instanceof Anthropic.APIError) return { ok: false, status: 502, error: `upstream_${error.status ?? "error"}` };
    return { ok: false, status: 502, error: "upstream_unknown" };
  }
}
