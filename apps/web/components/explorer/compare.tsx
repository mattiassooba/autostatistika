"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { CompareChart } from "../charts/compare-chart";
import { Combobox } from "../ui/combobox";
import { Segmented } from "../ui/segmented";
import { Sheet } from "../ui/sheet";
import { Block, Empty, SourceTag, SOURCES, ViewToggle } from "./parts";
import { CompareAdd } from "./controls";
import { brandHistory, brandPeriodsOf, brandRanking, brandUniverse } from "@/lib/data/views";
import { fmtGap, fmtNumber, fmtPercent, fmtPeriodList, fmtPeriodShort, titleCaseBrand } from "@/lib/format";
import { MAX_COMPARE, motion as tokens, seriesColor } from "@/lib/design/tokens";

/**
 * Signature interaction 2: brand comparison. Pick up to four brands, read them
 * across every imported month as counts or as a share of the category, and
 * share the exact view through the URL.
 */
export function Compare() {
  const t = useTranslations("compare");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const reg = view.registrations;
  const [metric, setMetric] = useState<"value" | "share">("value");
  const [table, setTable] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  const periods = useMemo(() => brandPeriodsOf(data, reg.category), [data, reg.category]);
  const history = useMemo(() => brandHistory(data, reg.category, reg.brands), [data, reg.category, reg.brands]);
  const latest = periods[periods.length - 1];
  const suggestions = useMemo(
    () => (latest ? brandRanking(data, reg.category, latest).slice(0, 3) : []),
    [data, reg.category, latest],
  );

  // Sparse coverage: label each month with the gap to the previous one.
  // Dense coverage: a continuous monthly axis labelled by year.
  const periodLabels =
    periods.length > 12
      ? periods.map((period) => fmtPeriodShort(period, locale))
      : periods.map((period, index) =>
          index === 0 ? fmtPeriodShort(period, locale) : `${fmtPeriodShort(period, locale)}\n${fmtGap(periods[index - 1], period, locale)}`,
        );
  const formatValue = useCallback(
    (value: number) => (metric === "share" ? fmtPercent(value, locale) : fmtNumber(value, locale)),
    [metric, locale],
  );
  const formatAxis = useCallback(
    (value: number) => (metric === "share" ? fmtPercent(value, locale, 0) : fmtNumber(value, locale)),
    [metric, locale],
  );
  const series = history.map((brand, index) => ({
    id: brand.slug,
    name: titleCaseBrand(brand.name),
    color: seriesColor(index),
    values: brand.points.map((point) => (metric === "share" ? point.share : point.value)),
  }));
  const hasMissing = history.some((brand) => brand.points.some((point) => point.value == null));

  const remove = (slug: string) => update((current) => ({ ...current, brands: reg.brands.filter((b) => b !== slug) }));

  if (!reg.hasBrands) return null;

  return (
    <Block
      id="compare"
      title={t("title")}
      description={t("description", { category: tc(reg.category).toLowerCase() })}
      info={t("info")}
      actions={
        reg.brands.length > 0 ? (
          <>
            <Segmented
              size="sm"
              label={t("metric")}
              value={metric}
              onChange={setMetric}
              options={[
                { value: "value", label: t("count") },
                { value: "share", label: t("share") },
              ]}
            />
            <ViewToggle table={table} onChange={setTable} />
          </>
        ) : undefined
      }
      footer={
        <SourceTag
          href={SOURCES.registrations}
          dataset={t("dataset")}
          period={fmtPeriodList(periods, locale, (p) => fmtPeriodShort(p, locale))}
          generatedAt={data.generatedAt}
          note={t("sourceNote")}
        />
      }
    >
      {/* Tray */}
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {history.map((brand, index) => (
            <motion.div
              key={brand.slug}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: tokens.ui, ease: tokens.easeOut }}
              onPointerEnter={() => setFocus(brand.slug)}
              onPointerLeave={() => setFocus(null)}
              className={`flex h-11 items-center gap-2.5 rounded-full bg-paper pl-3 pr-1.5 ring-1 transition-shadow ${
                focus === brand.slug ? "ring-ink" : "ring-rule-strong"
              }`}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: seriesColor(index) }} aria-hidden="true" />
              <span className="text-[14px] font-medium">{titleCaseBrand(brand.name)}</span>
              <button
                type="button"
                onClick={() => remove(brand.slug)}
                aria-label={t("remove", { brand: titleCaseBrand(brand.name) })}
                className="press flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-paper-2 hover:text-ink"
              >
                <X size={13} weight="bold" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {reg.brands.length < MAX_COMPARE && (
          <>
            <div className="hidden sm:block">
              <CompareAdd tone="inline" />
            </div>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="press inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-lime pl-2 pr-4 text-[14px] font-medium text-ink ring-1 ring-lime-deep sm:hidden"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-lime">
                <Plus size={13} weight="bold" />
              </span>
              {t("add")}
            </button>
          </>
        )}
      </div>

      <div className="mt-6">
        {reg.brands.length === 0 ? (
          <Empty
            title={t("emptyTitle")}
            action={
              suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => update((current) => ({ ...current, brands: suggestions.map((s) => s.slug) }))}
                  className="press inline-flex h-11 cursor-pointer items-center gap-3 rounded-full bg-ink pl-4 pr-5 text-[14px] font-medium text-paper hover:bg-graphite"
                >
                  <span className="flex -space-x-1" aria-hidden="true">
                    {suggestions.map((s, i) => (
                      <span key={s.slug} className="h-3 w-3 rounded-full ring-2 ring-ink" style={{ background: seriesColor(i, true) }} />
                    ))}
                  </span>
                  {t("suggest", { brands: suggestions.map((s) => titleCaseBrand(s.name)).join(", ") })}
                </button>
              )
            }
          >
            {t("emptyBody")}
          </Empty>
        ) : table ? (
          <CompareTable history={history} periods={periods} metric={metric} />
        ) : (
          <>
            <CompareChart
              periods={periods}
              periodLabels={periodLabels}
              series={series}
              formatValue={formatValue}
              formatAxis={formatAxis}
              label={t("chartLabel")}
              missingLabel={t("notListed")}
              focus={focus}
              onFocus={setFocus}
            />
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
              <span>{periods.length > 12 ? t("axisNoteDense") : t("axisNote")}</span>
              {hasMissing && <span>{t("missingNote")}</span>}
            </p>
          </>
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("add")} closeLabel={t("close")}>
        <MobilePicker onDone={() => setSheet(false)} />
      </Sheet>
    </Block>
  );
}

function MobilePicker({ onDone }: { onDone: () => void }) {
  const t = useTranslations("filters");
  const { data, view, update } = useDashboard();
  const reg = view.registrations;
  const options = brandUniverse(data, reg.category).map((brand) => {
    const index = reg.brands.indexOf(brand.slug);
    return {
      value: brand.slug,
      label: titleCaseBrand(brand.name),
      meta: t("monthsListed", { count: brand.months }),
      swatch: index >= 0 ? seriesColor(index) : undefined,
    };
  });
  return (
    <Combobox
      options={options}
      selected={reg.brands}
      atLimit={reg.brands.length >= MAX_COMPARE}
      limitText={t("maxCompare", { max: MAX_COMPARE })}
      onPick={(slug) => {
        const next = reg.brands.includes(slug) ? reg.brands.filter((b) => b !== slug) : [...reg.brands, slug].slice(0, MAX_COMPARE);
        update((current) => ({ ...current, brands: next }));
        if (!reg.brands.includes(slug)) onDone();
      }}
      placeholder={t("searchBrand")}
      label={t("compare")}
      emptyText={t("noBrand")}
    />
  );
}

function CompareTable({
  history,
  periods,
  metric,
}: {
  history: ReturnType<typeof brandHistory>;
  periods: string[];
  metric: "value" | "share";
}) {
  const t = useTranslations("compare");
  const locale = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[14px]">
        <caption className="sr-only">{t("chartLabel")}</caption>
        <thead>
          <tr className="text-left text-[12.5px] text-muted">
            <th scope="col" className="py-2.5 pr-4 font-medium">{t("brand")}</th>
            {periods.map((period) => (
              <th key={period} scope="col" className="py-2.5 pl-4 text-right font-medium">
                {fmtPeriodShort(period, locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((brand, index) => (
            <tr key={brand.slug} className="border-t border-rule">
              <th scope="row" className="py-3 pr-4 text-left font-medium">
                <span className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesColor(index) }} aria-hidden="true" />
                  {titleCaseBrand(brand.name)}
                </span>
              </th>
              {brand.points.map((point) => (
                <td key={point.period} className="tabular py-3 pl-4 text-right">
                  {point.value == null ? (
                    <span className="text-muted">{t("notListed")}</span>
                  ) : (
                    <>
                      <span className="font-semibold">{metric === "share" ? fmtPercent(point.share, locale) : fmtNumber(point.value, locale)}</span>
                      <span className="ml-2 text-[12px] text-muted">#{point.rank}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
