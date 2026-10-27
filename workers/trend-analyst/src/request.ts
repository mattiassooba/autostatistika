// The request body: the page's computed statements and evidence (AnalysisRequest
// in apps/web/lib/analysis/validate.ts). Checked by hand so the Worker carries no
// schema library; anything outside these bounds is refused before the model.

import type { AnalysisRequest } from "../../../apps/web/lib/analysis/validate";

export const MAX_BODY_BYTES = 24_000;

const SECTIONS = new Set(["summary", "changes", "comparison", "observation"]);

const str = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const strings = (value: unknown, maxItems: number, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxItems && value.every((item) => str(item, maxLength));

export function parseRequest(body: unknown): { request: AnalysisRequest; fresh: boolean } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1 || (b.locale !== "et" && b.locale !== "en")) return null;

  const context = b.context as Record<string, unknown> | undefined;
  if (!context || !str(context.category, 80) || !strings(context.brands, 4, 60) || !str(context.period, 80) || !str(context.source, 300)) return null;

  const statements = b.statements;
  if (!Array.isArray(statements) || statements.length < 1 || statements.length > 30) return null;
  for (const s of statements) {
    if (typeof s !== "object" || s === null) return null;
    if (!str(s.id, 4) || !/^s\d{1,3}$/.test(s.id) || !SECTIONS.has(s.section) || !str(s.text, 700)) return null;
    if (!strings(s.evidence, 12, 4) || !s.evidence.every((id: string) => /^e\d{1,3}$/.test(id))) return null;
  }
  // The model writes every section, so every section needs a statement.
  for (const section of SECTIONS) if (!statements.some((s) => s.section === section)) return null;

  const evidence = b.evidence;
  if (!Array.isArray(evidence) || evidence.length > 60) return null;
  for (const e of evidence) {
    if (typeof e !== "object" || e === null) return null;
    if (!str(e.id, 4) || !/^e\d{1,3}$/.test(e.id) || !str(e.label, 160) || !str(e.period, 80) || !str(e.value, 120)) return null;
  }
  if (!strings(b.limitations, 10, 500)) return null;
  if (b.fresh !== undefined && typeof b.fresh !== "boolean") return null;

  const request: AnalysisRequest = {
    v: 1,
    locale: b.locale,
    context: { category: context.category, brands: context.brands, period: context.period, source: context.source },
    statements: statements.map((s) => ({ id: s.id, section: s.section, text: s.text, evidence: s.evidence })),
    evidence: evidence.map((e) => ({ id: e.id, label: e.label, period: e.period, value: e.value })),
    limitations: b.limitations,
  };
  return { request, fresh: b.fresh === true };
}
