// Statements from trend.ts as sentences in the page's language. The same
// sentences are the computed analysis and the model's input (AnalysisRequest).

import { fmtNumber, fmtPercent, fmtPeriodShort, titleCaseBrand } from "../format";
import type { Section, TrendStatements, Value } from "./trend";
import type { AnalysisItem, AnalysisRequest, AnalysisText } from "./validate";

/** next-intl's translator scoped to the "trend" namespace. */
export type Translate = (key: string, values?: Record<string, string>) => string;

export type RenderedEvidence = { id: string; n: number; label: string; period: string; value: string };

export type RenderedTrend = {
  analysis: AnalysisText;
  evidence: RenderedEvidence[];
  limitations: string[];
  request: AnalysisRequest;
};

const intlLocale = (locale: string) => (locale === "et" ? "et-EE" : "en-GB");

/** "+12,3 %" / "−4,0 %" with a real minus sign; a value that rounds to zero gets no sign. */
function signed(value: number, text: (abs: number) => string): string {
  const abs = Math.abs(value);
  if (Number(abs.toFixed(1)) === 0) return text(0);
  return `${value > 0 ? "+" : "−"}${text(abs)}`;
}

export function formatValue(value: Value, locale: string, t: Translate): string {
  const decimal = (n: number) =>
    new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
  switch (value.kind) {
    case "count":
      return fmtNumber(value.value, locale);
    case "pct":
      return fmtPercent(value.value, locale);
    case "signedPct":
      return signed(value.value, (abs) => fmtPercent(abs, locale));
    case "pp":
      return signed(value.value, (abs) => `${decimal(abs)} ${t("unit.pp")}`);
    case "ratio":
      return decimal(value.value);
    case "int":
      return String(value.value);
    case "period":
      return fmtPeriodShort(value.value, locale);
    case "range": {
      const { from, to } = value.value;
      if (from === to) return fmtPeriodShort(from, locale);
      // Within one year: "jaan–dets 2006"
      if (from.slice(0, 4) === to.slice(0, 4)) return `${fmtPeriodShort(from, locale).replace(/\s*\d{4}$/, "")}–${fmtPeriodShort(to, locale)}`;
      return `${fmtPeriodShort(from, locale)} – ${fmtPeriodShort(to, locale)}`;
    }
    case "change":
      return `${formatValue(value.from, locale, t)} → ${formatValue(value.to, locale, t)}`;
    case "brand":
      return titleCaseBrand(value.value);
    case "list":
      return new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(
        value.value.map((item) => t(`item.${item.key}`, formatValues(item.values, locale, t))),
      );
  }
}

function formatValues(values: Record<string, Value>, locale: string, t: Translate): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatValue(value, locale, t)]));
}

export function renderTrend(
  { statements, evidence, limitations }: TrendStatements,
  context: { locale: "et" | "en"; category: string; brands: string[]; period: string; source: string },
  t: Translate,
): RenderedTrend {
  const { locale } = context;
  const rendered = statements.map((s) => ({ ...s, text: t(`s.${s.section}.${s.key}`, formatValues(s.values, locale, t)) }));
  const join = (section: Section): AnalysisItem | null => {
    const parts = rendered.filter((s) => s.section === section);
    if (!parts.length) return null;
    return { text: parts.map((s) => s.text).join(" "), evidence: [...new Set(parts.flatMap((s) => s.evidence))] };
  };
  const rows = evidence.map((row, index) => ({
    id: row.id,
    n: index + 1,
    label: t(`ev.${row.key}`, row.brand ? { brand: titleCaseBrand(row.brand) } : {}),
    period: formatValue(row.period, locale, t),
    value: formatValue(row.value, locale, t),
  }));
  const limitationTexts = limitations.map((l) => t(`lim.${l.key}`, formatValues(l.values, locale, t)));

  return {
    analysis: {
      summary: join("summary") ?? { text: "", evidence: [] },
      keyChanges: rendered.filter((s) => s.section === "changes").map((s) => ({ text: s.text, evidence: s.evidence })),
      comparison: join("comparison"),
      observation: join("observation"),
    },
    evidence: rows,
    limitations: limitationTexts,
    request: {
      v: 1,
      locale,
      context: { category: context.category, brands: context.brands, period: context.period, source: context.source },
      statements: rendered.map((s) => ({ id: s.id, section: s.section, text: s.text, evidence: s.evidence })),
      evidence: rows.map(({ id, label, period, value }) => ({ id, label, period, value })),
      limitations: limitationTexts,
    },
  };
}
