"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { ArrowClockwise, ArrowUpRight, Check, Copy, X } from "@phosphor-icons/react";
import { SOURCES } from "./parts";
import type { RenderedTrend, Translate } from "@/lib/analysis/render";
import type { AnalysisItem, AnalysisText } from "@/lib/analysis/validate";
import type { ExplorerData } from "@/lib/data/types";
import { motion as tokens } from "@/lib/design/tokens";

// The engine (build.ts and what it uses, client.ts) loads on the first click, so
// the comparison chart's page carries only this component.
const loadEngine = () =>
  Promise.all([import("@/lib/analysis/build"), import("@/lib/analysis/client")]).then(([build, client]) => ({ ...build, ...client }));
const AI_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TREND_API_URL);

type Result = {
  key: string;
  rendered: RenderedTrend;
  text: AnalysisText;
  mode: "ai" | "computed" | "fallback";
  reason?: "unavailable" | "rateLimited" | "invalid";
  model?: string;
  brands: string;
  period: string;
  category: string;
};

/** "claude-haiku-5-5" → "Claude Haiku 5.5" */
function modelName(id: string): string {
  const match = /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(id);
  if (!match) return id || "Claude";
  return `Claude ${match[1].charAt(0).toUpperCase()}${match[1].slice(1)} ${match[2]}.${match[3]}`;
}

/**
 * Trend analysis card: a button beside a toolbar and a card above the chart, for
 * the brand comparison (kind "brands") or the registrations history (kind
 * "registrations", one type and month). Figures come from build.ts; with a Worker
 * configured, Claude rewords them and the page shows that text only if it passes
 * the checks in validate.ts. A result belongs to the selection it was made for:
 * once the selection changes it is marked out of date and offers a new run.
 */
export function TrendAnalysis({
  kind = "brands",
  toolbar,
  data,
  selection,
  selectionKey,
  categoryLabel,
  shareUrl,
}: {
  kind?: "brands" | "registrations";
  toolbar: ReactNode;
  data: ExplorerData;
  selection: { category: string; brands: string[]; from: string | null; period: string | null };
  selectionKey: string;
  categoryLabel: string;
  shareUrl: () => string;
}) {
  const t = useTranslations("trend");
  const locale: "et" | "en" = useLocale() === "en" ? "en" : "et";
  const reduce = useReducedMotion();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const run = useRef(0);
  const translate = useCallback<Translate>((key, values) => t(key as never, values as never), [t]);

  const analyse = useCallback(
    async (fresh = false) => {
      const id = ++run.current;
      setOpen(true);
      setCopied(false);
      let engine: Awaited<ReturnType<typeof loadEngine>>;
      try {
        engine = await loadEngine();
      } catch {
        if (id === run.current) setOpen(false);
        return;
      }
      if (id !== run.current) return;
      const { buildTrend, buildRegistrationTrend, requestWording } = engine;
      const { facts, rendered } =
        kind === "registrations"
          ? buildRegistrationTrend(data, { locale, category: selection.category, period: selection.period ?? "" }, categoryLabel, translate)
          : buildTrend(data, { locale, category: selection.category, brands: selection.brands, from: selection.from }, categoryLabel, translate);
      const { context } = rendered.request;
      // What the result is about: the compared brands, or the vehicle type for registrations.
      const subject = context.brands.length
        ? new Intl.ListFormat(locale === "et" ? "et-EE" : "en-GB", { type: "conjunction" }).format(context.brands)
        : categoryLabel;
      const base: Result = { key: selectionKey, rendered, text: rendered.analysis, mode: "computed", brands: subject, period: context.period, category: categoryLabel };
      if (facts.status !== "ok" || !AI_CONFIGURED) {
        setLoading(false);
        setResult(base);
        return;
      }
      setLoading(true);
      const answer = await requestWording(
        rendered.request,
        kind === "registrations"
          ? { kind, locale, category: selection.category, brands: [], from: null, period: selection.period, generatedAt: data.generatedAt }
          : { kind, locale, category: selection.category, brands: selection.brands, from: selection.from, period: null, generatedAt: data.generatedAt },
        { fresh },
      );
      if (id !== run.current) return;
      setResult(answer.ok ? { ...base, text: answer.analysis, mode: "ai", model: answer.model } : { ...base, mode: "fallback", reason: answer.reason });
      setLoading(false);
    },
    [kind, data, selection, locale, categoryLabel, selectionKey, translate],
  );

  const close = () => {
    run.current++;
    setOpen(false);
    setLoading(false);
  };

  const stale = Boolean(result && result.key !== selectionKey);
  const evidence = result?.rendered.evidence ?? [];
  const numberOf = new Map(evidence.map((row) => [row.id, row.n]));
  const title = result?.mode === "ai" || (loading && AI_CONFIGURED) ? t("titleAi") : t("title");
  const cardId = `${uid}-card`;

  const copy = async () => {
    if (!result) return;
    const refs = (item: AnalysisItem) => (item.evidence.length ? ` [${item.evidence.map((id) => numberOf.get(id)).join(", ")}]` : "");
    const { text } = result;
    const lines = [
      title,
      `${t(kind === "registrations" ? "meta.month" : "meta.period")}: ${result.period}`,
      ...(kind === "brands" ? [`${t("meta.brands")}: ${result.brands}`] : []),
      `${t("meta.category")}: ${result.category}`,
      "",
      t("sections.summary"),
      text.summary.text + refs(text.summary),
      ...(text.keyChanges.length ? ["", t("sections.changes"), ...text.keyChanges.map((item) => `- ${item.text}${refs(item)}`)] : []),
      ...(text.comparison ? ["", t("sections.comparison"), text.comparison.text + refs(text.comparison)] : []),
      ...(text.observation ? ["", t("sections.observation"), text.observation.text + refs(text.observation)] : []),
      ...(evidence.length ? ["", t("sections.evidence"), ...evidence.map((row) => `${row.n}. ${row.label}, ${row.period}: ${row.value}`)] : []),
      "",
      t("sections.limitations"),
      ...result.rendered.limitations.map((line) => `- ${line}`),
      "",
      t("sections.source"),
      result.rendered.request.context.source,
      SOURCES.registrations,
      shareUrl(),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const markers = (item: AnalysisItem) =>
    item.evidence.length > 0 && (
      <span className="ml-1 inline-flex gap-0.5 align-[0.15em]">
        {item.evidence.map((id) => (
          <a
            key={id}
            href={`#${uid}-${id}`}
            aria-label={t("evidenceRef", { n: String(numberOf.get(id)) })}
            onPointerEnter={() => setHover(id)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(id)}
            onBlur={() => setHover(null)}
            className={`tabular inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold leading-none ring-1 transition-colors ${
              hover === id ? "bg-ink text-lime ring-ink" : "bg-paper text-graphite ring-rule-strong hover:ring-ink/50"
            }`}
          >
            {numberOf.get(id)}
          </a>
        ))}
      </span>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {toolbar}
        <button
          type="button"
          onClick={() => analyse()}
          aria-expanded={open}
          aria-controls={cardId}
          className="press group inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink pl-3.5 pr-4 text-[14px] font-medium text-paper transition-colors hover:bg-graphite"
        >
          <span aria-hidden="true" className="text-[15px] leading-none text-lime transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none">
            ✦
          </span>
          {t("analyse")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="trend"
            id={cardId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: tokens.tab, ease: tokens.easeOut }}
            className="overflow-hidden"
          >
            <section aria-labelledby={`${uid}-title`} aria-busy={loading} className="mt-4 rounded-[16px] bg-paper-2 ring-1 ring-rule">
              <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] leading-none text-lime">
                      ✦
                    </span>
                    <h4 id={`${uid}-title`} className="t-title text-[17px] text-ink">
                      {title}
                    </h4>
                  </div>
                  {result && (
                    <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
                      <div>
                        <dt className="inline">{t(kind === "registrations" ? "meta.month" : "meta.period")}: </dt>
                        <dd className="tabular inline text-ink">{result.period}</dd>
                      </div>
                      {kind === "brands" && (
                        <div>
                          <dt className="inline">{t("meta.brands")}: </dt>
                          <dd className="inline text-ink">{result.brands}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">{t("meta.category")}: </dt>
                        <dd className="inline text-ink">{result.category}</dd>
                      </div>
                    </dl>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CardButton onClick={copy} disabled={!result || loading} label={t("copyLabel")} icon={copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}>
                    {copied ? t("copied") : t("copy")}
                  </CardButton>
                  <CardButton onClick={() => analyse(true)} disabled={loading} label={t("regenerate")} icon={<ArrowClockwise size={14} />}>
                    {t("regenerate")}
                  </CardButton>
                  <CardButton onClick={close} label={t("close")} icon={<X size={14} weight="bold" />} />
                </div>
              </header>

              <p className="sr-only" aria-live="polite">
                {loading ? t("loading") : stale && result ? t("stale", { brands: result.brands, period: result.period }) : ""}
              </p>

              {stale && result && !loading && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-lime-wash px-4 py-3 text-[13.5px] text-graphite sm:px-6">
                  <span>{t("stale", { brands: result.brands, period: result.period })}</span>
                  <button
                    type="button"
                    onClick={() => analyse()}
                    className="press inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-paper hover:bg-graphite"
                  >
                    <span aria-hidden="true" className="text-lime">✦</span>
                    {t("refresh")}
                  </button>
                </div>
              )}

              {loading || !result ? (
                <Skeleton label={t("loading")} />
              ) : (
                <div className={`transition-opacity duration-300 ${stale ? "opacity-50" : ""}`}>
                  <div className="grid gap-x-10 gap-y-6 px-4 py-5 sm:px-6 lg:grid-cols-12">
                    <div className="min-w-0 space-y-5 lg:col-span-8">
                      <Part label={t("sections.summary")}>
                        <p className="t-title text-[16px] leading-snug text-ink md:text-[17px]">
                          {result.text.summary.text}
                          {markers(result.text.summary)}
                        </p>
                      </Part>
                      {result.text.keyChanges.length > 0 && (
                        <Part label={t("sections.changes")}>
                          <ul className="space-y-2">
                            {result.text.keyChanges.map((item, index) => (
                              <li key={index} className="flex gap-3 text-[14.5px] leading-relaxed text-graphite">
                                <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-ink/40" />
                                <span>
                                  {item.text}
                                  {markers(item)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </Part>
                      )}
                      {result.text.comparison && (
                        <Part label={t("sections.comparison")}>
                          <p className="text-[14.5px] leading-relaxed text-graphite">
                            {result.text.comparison.text}
                            {markers(result.text.comparison)}
                          </p>
                        </Part>
                      )}
                      {result.text.observation && (
                        <Part label={t("sections.observation")}>
                          <p className="text-[14.5px] leading-relaxed text-graphite">
                            {result.text.observation.text}
                            {markers(result.text.observation)}
                          </p>
                        </Part>
                      )}
                    </div>

                    <aside className="min-w-0 space-y-5 border-t border-rule pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                      {evidence.length > 0 && (
                        <Part label={t("sections.evidence")}>
                          <ol className="space-y-1.5">
                            {evidence.map((row) => (
                              <li
                                key={row.id}
                                id={`${uid}-${row.id}`}
                                className={`grid scroll-mt-[calc(var(--header-h)+24px)] grid-cols-[18px_1fr_auto] gap-x-2.5 rounded-[6px] px-1.5 py-1 text-[12.5px] leading-snug transition-colors ${
                                  hover === row.id ? "bg-lime-wash" : ""
                                }`}
                              >
                                <span className="tabular pt-px text-[11px] font-semibold text-muted">{row.n}</span>
                                <span className="min-w-0 text-graphite">
                                  {row.label}
                                  <span className="tabular block text-[11.5px] text-muted">{row.period}</span>
                                </span>
                                <span className="tabular text-right font-semibold text-ink">{row.value}</span>
                              </li>
                            ))}
                          </ol>
                        </Part>
                      )}
                      <Part label={t("sections.limitations")}>
                        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-muted">
                          {result.rendered.limitations.map((line, index) => (
                            <li key={index}>{line}</li>
                          ))}
                        </ul>
                      </Part>
                      <Part label={t("sections.source")}>
                        <p className="text-[12.5px] leading-relaxed text-muted">{result.rendered.request.context.source}</p>
                        <a
                          href={SOURCES.registrations}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                        >
                          {t("sourceLink")}
                          <ArrowUpRight size={12} weight="bold" />
                        </a>
                      </Part>
                    </aside>
                  </div>
                  <p className="t-meta border-t border-rule px-4 py-3 text-muted sm:px-6">
                    {result.mode === "ai"
                      ? t("mode.ai", { model: modelName(result.model ?? "") })
                      : result.mode === "fallback"
                        ? t("mode.fallback", { reason: t(`reason.${result.reason ?? "unavailable"}`) })
                        : t("mode.computed")}
                  </p>
                </div>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="t-meta mb-1.5 text-muted">{label}</p>
      {children}
    </div>
  );
}

function CardButton({
  onClick,
  label,
  icon,
  children,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="press inline-flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-paper px-2.5 text-[12.5px] font-medium text-graphite ring-1 ring-rule-strong transition-colors hover:text-ink hover:ring-ink/50 disabled:cursor-default disabled:opacity-50"
    >
      {icon}
      {children && <span className="hidden sm:inline">{children}</span>}
    </button>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-x-10 gap-y-4 px-4 py-6 sm:px-6 lg:grid-cols-12" aria-label={label} role="img">
      <div className="space-y-3 lg:col-span-8">
        {[92, 78, 85, 64, 70].map((width, index) => (
          <span key={index} className="block h-3.5 animate-pulse rounded-full bg-paper-3" style={{ width: `${width}%` }} />
        ))}
      </div>
      <div className="space-y-2.5 lg:col-span-4">
        {[80, 66, 74].map((width, index) => (
          <span key={index} className="block h-3 animate-pulse rounded-full bg-paper-3" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}
