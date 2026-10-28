// Checks on a trend analysis text before it is shown. Shared by the browser and
// the trend-analyst Worker (workers/trend-analyst), so it has no dependencies.
//
// The model only rewords statements computed in trend.ts. Its text is accepted
// when every number in it appears in those statements or their evidence (with
// the same sign), every cited evidence id exists, there is one key change per
// computed change, and it names no causes. Anything else falls back to the
// computed text.

export type AnalysisItem = { text: string; evidence: string[] };

export type AnalysisText = {
  summary: AnalysisItem;
  keyChanges: AnalysisItem[];
  comparison: AnalysisItem | null;
  observation: AnalysisItem | null;
};

/** What the model is given: the computed statements and evidence, as rendered text. */
export type AnalysisRequest = {
  v: 1;
  locale: "et" | "en";
  context: { kind: "brands" | "registrations"; category: string; brands: string[]; period: string; source: string };
  statements: Array<{ id: string; section: "summary" | "changes" | "comparison" | "observation"; text: string; evidence: string[] }>;
  evidence: Array<{ id: string; label: string; period: string; value: string }>;
  limitations: string[];
};

/**
 * What the page sends to the Worker: a selection only, never text. The Worker
 * rebuilds the AnalysisRequest from the site's trend file and goes on only if its
 * hash equals `hash`, the hash of the request the page computed.
 */
export type SelectionRequest = {
  v: 2;
  kind: "brands" | "registrations";
  locale: "et" | "en";
  generation: string; // generationId(bundle.generatedAt)
  category: string;
  brands: string[]; // brand comparison: 1-4 slugs; registrations: none
  from: string | null; // brand comparison window start
  period: string | null; // registrations: the selected month
  hash: string;
  fresh?: boolean;
};

/** SHA-256 of the request as JSON (hex). Both sides build the request with the same code, so key order matches. */
export async function requestHash(request: AnalysisRequest): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(request)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const LIMITS ={ summary: 480, item: 360, comparison: 640, observation: 480, keyChanges: 6 } as const;

type Sign = "+" | "-" | "";
type Found = { value: string; sign: Sign; index: number };

// et: "1 234,5" (space or no-break space for thousands, decimal comma)
// en: "1,234.5"
const NUMBER = {
  et: /(\d{1,3}(?:[   ]\d{3})+|\d+)(?:,(\d+))?/g,
  en: /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g,
};

/** Numbers in a text, normalised ("1 234,50" → "1234.5"), with an explicit sign if one precedes them. */
export function extractNumbers(text: string, locale: "et" | "en"): Found[] {
  const found: Found[] = [];
  for (const match of text.matchAll(NUMBER[locale])) {
    const index = match.index ?? 0;
    const whole = match[1].replace(/[   ,]/g, "");
    const value = String(Number(match[2] ? `${whole}.${match[2]}` : whole));
    const before = text[index - 1] ?? "";
    const beforeThat = text[index - 2] ?? "";
    // "+", "−" (minus sign) and "-" count as a sign only when not joining two numbers ("2020-10").
    let sign: Sign = "";
    if (before === "+") sign = "+";
    else if (before === "−") sign = "-";
    else if (before === "-" && !/\d/.test(beforeThat)) sign = "-";
    found.push({ value, sign, index });
  }
  return found;
}

const CAUSAL = {
  et: /(tõttu|\bsest\b|põhjusel|põhjuse|põhjusta|mõjul|\btänu\b|seetõttu|seepärast|tingitud|tulenevalt)/i,
  en: /\b(because|due to|driven by|as a result|caused|causing|thanks to|owing to|attributable|reflects?|reflecting|explained by|led by)\b/i,
};
const RISE = { et: /(kasv|suurene|tõus)/i, en: /\b(increas|grew|grow|rose|rise|rising|higher|gain|up\b)/i };
const FALL = { et: /(vähene|langu|lange|kahane|kahanes|madalam)/i, en: /\b(decreas|fell|fall|declin|drop|lower|shrank|down\b)/i };

function sentenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(". ", index), text.lastIndexOf("; ", index)) + 1;
  const stops = [text.indexOf(". ", index), text.indexOf("; ", index)].filter((i) => i >= 0);
  return text.slice(start, stops.length ? Math.min(...stops) : text.length);
}

export type Validation = { ok: true; value: AnalysisText } | { ok: false; reason: string };

export function validateAnalysis(candidate: unknown, request: AnalysisRequest): Validation {
  const fail = (reason: string): Validation => ({ ok: false, reason });
  const locale = request.locale;

  // Shape
  const isItem = (item: unknown): item is AnalysisItem =>
    typeof item === "object" &&
    item !== null &&
    typeof (item as AnalysisItem).text === "string" &&
    Array.isArray((item as AnalysisItem).evidence) &&
    (item as AnalysisItem).evidence.every((id) => typeof id === "string");
  if (typeof candidate !== "object" || candidate === null) return fail("shape");
  const c = candidate as Record<string, unknown>;
  if (!isItem(c.summary) || !Array.isArray(c.keyChanges) || !c.keyChanges.every(isItem)) return fail("shape");
  if (c.comparison != null && !isItem(c.comparison)) return fail("shape");
  if (c.observation != null && !isItem(c.observation)) return fail("shape");
  // A model sometimes cites a statement ("s3") instead of its evidence rows: read that as the
  // statement's own evidence. The number checks below do not depend on citations.
  const statementEvidence = new Map(request.statements.map((s) => [s.id, s.evidence]));
  const tidy = (item: AnalysisItem) => {
    const cleaned = clean(item);
    return { ...cleaned, evidence: [...new Set(cleaned.evidence.flatMap((id) => statementEvidence.get(id) ?? [id]))] };
  };
  const value: AnalysisText = {
    summary: tidy(c.summary),
    keyChanges: (c.keyChanges as AnalysisItem[]).map(tidy),
    comparison: c.comparison ? tidy(c.comparison as AnalysisItem) : null,
    observation: c.observation ? tidy(c.observation as AnalysisItem) : null,
  };

  // One key change per computed change; sections the statements have must be present.
  const has = (section: AnalysisRequest["statements"][number]["section"]) => request.statements.some((s) => s.section === section);
  const changes = request.statements.filter((s) => s.section === "changes").length;
  if (value.keyChanges.length !== changes || changes > LIMITS.keyChanges) return fail("keyChanges");
  if (has("comparison") !== Boolean(value.comparison) || has("observation") !== Boolean(value.observation)) return fail("sections");

  // [item, length limit, whether the computed text it rewrites cites evidence]
  const cites = (section: AnalysisRequest["statements"][number]["section"]) =>
    request.statements.some((s) => s.section === section && s.evidence.length > 0);
  const changeStatements = request.statements.filter((s) => s.section === "changes");
  const items: Array<[AnalysisItem, number, boolean]> = [
    [value.summary, LIMITS.summary, cites("summary")],
    ...value.keyChanges.map((item, index): [AnalysisItem, number, boolean] => [item, LIMITS.item, changeStatements[index].evidence.length > 0]),
    ...(value.comparison ? [[value.comparison, LIMITS.comparison, cites("comparison")] as [AnalysisItem, number, boolean]] : []),
    ...(value.observation ? [[value.observation, LIMITS.observation, cites("observation")] as [AnalysisItem, number, boolean]] : []),
  ];

  // Numbers allowed: everything the computed text and evidence contain, with their signs.
  const allowed = new Map<string, Set<Sign>>();
  const source = [
    ...request.statements.map((s) => s.text),
    ...request.evidence.flatMap((e) => [e.label, e.period, e.value]),
    ...request.limitations,
    request.context.period,
    request.context.category,
    ...request.context.brands,
  ];
  for (const text of source) {
    for (const n of extractNumbers(text, locale)) {
      const signs = allowed.get(n.value) ?? new Set<Sign>();
      signs.add(n.sign);
      allowed.set(n.value, signs);
    }
  }
  const evidenceIds = new Set(request.evidence.map((e) => e.id));

  for (const [item, limit, needsEvidence] of items) {
    if (!item.text || item.text.length > limit) return fail("length");
    if (/[<>{}[\]*`]|https?:/i.test(item.text)) return fail("markup");
    if (CAUSAL[locale].test(item.text)) return fail("causal");
    if (item.evidence.some((id) => !evidenceIds.has(id))) return fail("evidence");
    if (needsEvidence && !item.evidence.length) return fail("evidence");
    const numbers = extractNumbers(item.text, locale);
    for (const n of numbers) {
      const signs = allowed.get(n.value);
      if (!signs) return fail(`number:${n.value}`);
      if (n.sign && !signs.has(n.sign)) return fail(`sign:${n.value}`);
      // A change that is only ever stated as a fall must not be described as a rise, and vice versa.
      if (!n.sign && !signs.has("")) {
        const sentence = sentenceAt(item.text, n.index);
        const rise = RISE[locale].test(sentence);
        const fall = FALL[locale].test(sentence);
        if (signs.has("-") && !signs.has("+") && rise && !fall) return fail(`direction:${n.value}`);
        if (signs.has("+") && !signs.has("-") && fall && !rise) return fail(`direction:${n.value}`);
      }
    }
  }
  return { ok: true, value };
}

function clean(item: AnalysisItem): AnalysisItem {
  // Collapse ordinary whitespace only: no-break spaces keep "12,4 %" and "1,0 pp" together.
  // The model writes "48 674" and "11,0 %" with plain spaces; join those too so a line never breaks inside a figure.
  const text = item.text
    .replace(/[ \t\r\n]+/g, " ")
    .trim()
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ")
    .replace(/(\d) (?=%|pp\b)/g, "$1 ");
  return { text, evidence: [...new Set(item.evidence)] };
}
