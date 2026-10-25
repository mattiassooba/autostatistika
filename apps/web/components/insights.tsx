"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight } from "@phosphor-icons/react";
import { useDashboard } from "./dashboard-context";
import { Reveal } from "./ui/reveal";
import { DatasetGlyph } from "./ui/glyphs";
import { localizedLabel, METRIC_LABELS, POPULATION_LABELS } from "@/lib/data/labels";
import type { DashboardQuery, Insight } from "@/lib/data/types";
import { fmtDate, fmtNumber, fmtPeriod, titleCaseBrand } from "@/lib/format";

const CATEGORY_CODES = new Set([
  "passenger_car",
  "truck",
  "bus",
  "trailer",
  "motorcycle",
  "moped",
  "offroad",
  "tractor",
  "self_propelled",
  "l_other",
]);

/**
 * Editorial presentation of the published, evidence-backed insights. Nothing is
 * generated here: headline, sentence and evidence come from the bundle. Each
 * insight can open the explorer on the exact slice its evidence describes.
 */
export function Insights() {
  const t = useTranslations("insights");
  const { data } = useDashboard();
  const order = ["registreerimised", "soidukipark", "ulevaatused"];
  const insights = [...data.insights].sort((a, b) => order.indexOf(a.tab) - order.indexOf(b.tab));
  if (!insights.length) return null;
  const [lead, ...rest] = insights;

  return (
    <section id="insights" aria-labelledby="insights-title" className="on-dark grid-dark relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto max-w-[1600px] px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="insights-title" className="t-headline text-[clamp(2.4rem,5vw,4.2rem)] lg:col-span-7">
            {t("title")}
          </h2>
          <p className="max-w-[46ch] text-[16px] leading-relaxed text-paper/65 lg:col-span-5">{t("lede")}</p>
        </Reveal>

        <div className="mt-14 overflow-hidden rounded-[22px] ring-1 ring-white/10">
          <Reveal className="bg-ink">
            <InsightCard insight={lead} lead />
          </Reveal>
          <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-3">
            {rest.map((insight, index) => (
              <Reveal key={`${insight.tab}-${insight.period}-${index}`} className="bg-ink" delay={80 * (index + 1)}>
                <InsightCard insight={insight} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InsightCard({ insight, lead = false }: { insight: Insight; lead?: boolean }) {
  const t = useTranslations("insights");
  const tt = useTranslations("tabs");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, update } = useDashboard();
  const loc = locale === "en" ? "en" : "et";
  const primary = insight.evidence[0];
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(insight.period);
  const periodText = isDate ? fmtDate(insight.period, locale) : fmtPeriod(insight.period, locale);

  function entityLabel(entity: string) {
    if (CATEGORY_CODES.has(entity)) return tc(entity);
    if (POPULATION_LABELS[entity]) return localizedLabel(POPULATION_LABELS, entity, locale);
    return titleCaseBrand(entity);
  }

  function open() {
    const next: Partial<DashboardQuery> = { tab: insight.tab };
    let target = "explorer";
    const entity = primary?.entity ?? "";
    if (insight.tab === "registreerimised") {
      next.to = insight.period;
      const brand = data.registrations.brands.find(
        (row) => row.reporting_period === insight.period && row.brand_source.toLowerCase() === entity.toLowerCase(),
      );
      if (brand) {
        next.category = brand.category_code ?? "passenger_car";
        next.brands = [brand.brand_slug];
        target = "compare";
      } else {
        next.category = CATEGORY_CODES.has(entity) ? entity : "passenger_car";
        next.brands = [];
        target = "history";
      }
    } else if (insight.tab === "ulevaatused") {
      next.to = insight.period;
      if (POPULATION_LABELS[entity]) next.population = entity;
      target = "outcomes";
    } else {
      next.snapshot = insight.period;
      if (CATEGORY_CODES.has(entity)) next.category = entity;
    }
    update((current) => ({ ...current, brands: [], ...next }), { scrollTo: target });
  }

  const action = () => (
        <button
      type="button"
      onClick={open}
      className={`press group inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full pl-4 pr-2 text-[14px] font-medium transition-colors ${
        lead ? "bg-lime text-ink hover:bg-lime-deep" : "bg-paper/8 text-paper ring-1 ring-white/15 hover:bg-paper/14"
      }`}
    >
      {t("open")}
      <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5 ${lead ? "bg-ink text-lime" : "bg-lime text-ink"}`}>
        <ArrowDownRight size={13} weight="bold" />
      </span>
    </button>
  );

  const evidenceMax = Math.max(1, ...insight.evidence.map((row) => row.value));

  return (
    <article className={`flex h-full flex-col ${lead ? "gap-10 p-6 sm:p-10 lg:grid lg:grid-cols-12 lg:gap-12 xl:p-12" : "p-6 sm:p-8"}`}>
      <div className={lead ? "flex flex-col lg:col-span-7" : "contents"}>
      <p className="flex items-center gap-2 text-[13px] text-paper/55">
        <DatasetGlyph tab={insight.tab} className="h-4 w-4 text-lime" />
        <span>{tt(insight.tab)}</span>
        <span aria-hidden="true" className="h-3 w-px bg-white/20" />
        <span className="tabular">{periodText}</span>
      </p>
      <h3 className={`t-title mt-4 text-paper ${lead ? "text-[26px] md:text-[30px]" : "text-[20px]"}`}>{insight.title[loc]}</h3>

      {primary && (
        <p className={`t-figure mt-5 ${lead ? "text-[clamp(4rem,8vw,7.5rem)] text-lime" : "text-[clamp(2.4rem,3.4vw,3rem)] text-paper"}`}>
          {fmtNumber(primary.value, locale)}
          <span className={`ml-3 align-middle font-normal tracking-normal text-paper/50 ${lead ? "text-[15px]" : "text-[13px]"}`} style={{ fontVariationSettings: '"wdth" 100' }}>
            {t.has(`unit.${primary.unit}`) ? t(`unit.${primary.unit}`) : primary.unit}
          </span>
        </p>
      )}

      <p className={`mt-4 max-w-[52ch] leading-relaxed text-paper/75 ${lead ? "text-[17px]" : "text-[14.5px]"}`}>{insight.body[loc]}</p>

      {lead && <div className="mt-8 hidden lg:block">{action()}</div>}
      </div>

      {lead && (
        <div className="flex flex-col justify-end lg:col-span-5 lg:border-l lg:border-white/10 lg:pl-12">
          <p className="text-[13px] text-paper/55">{t("evidence", { count: insight.evidence.length })}</p>
          <ul className="mt-4 flex flex-col gap-5">
            {insight.evidence.map((row, index) => (
              <li key={index}>
                <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
                  <span className="text-paper/80">
                    {localizedLabel(METRIC_LABELS, row.metric, locale, row.metric)}
                    <span className="text-paper/45">, {entityLabel(row.entity)}</span>
                  </span>
                  <span className="tabular font-semibold text-paper">{fmtNumber(row.value, locale)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-r-[4px]" aria-hidden="true">
                  <span
                    className={`block h-full rounded-r-[4px] ${index === 0 ? "bg-lime" : "bg-mist/70"}`}
                    style={{ width: `${(row.value / evidenceMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="t-meta mt-6 text-paper/40">
            {insight.generationMode === "deterministic" ? t("deterministic") : t("modelPhrased")}
          </p>
          <div className="mt-8 lg:hidden">{action()}</div>
        </div>
      )}

      {!lead && (
      <div className="mt-auto pt-8">
        {insight.evidence.length > 0 && (
          <details className="group/ev mb-5">
            <summary className="t-meta inline-flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 text-paper/55 hover:text-paper [&::-webkit-details-marker]:hidden">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-white/25 transition-transform group-open/ev:rotate-45">+</span>
              {t("evidence", { count: insight.evidence.length })}
            </summary>
            <ul className="mt-3 space-y-1.5 border-l border-white/15 pl-4">
              {insight.evidence.map((row, index) => (
                <li key={index} className="t-meta flex flex-wrap gap-x-3 text-paper/60">
                  <span className="text-paper/85">{localizedLabel(METRIC_LABELS, row.metric, locale, row.metric)}</span>
                  <span>{entityLabel(row.entity)}</span>
                  <span className="tabular">{/^\d{4}-\d{2}-\d{2}$/.test(row.period) ? fmtDate(row.period, locale) : fmtPeriod(row.period, locale)}</span>
                  <span className="tabular text-paper">{fmtNumber(row.value, locale)}</span>
                </li>
              ))}
            </ul>
            <p className="t-meta mt-3 text-paper/40">
              {insight.generationMode === "deterministic" ? t("deterministic") : t("modelPhrased")}
            </p>
          </details>
        )}
        {action()}
      </div>
      )}
    </article>
  );
}
