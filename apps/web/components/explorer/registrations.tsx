"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { CategoryGlyph } from "../ui/glyphs";
import { MonthColumns } from "../charts/month-columns";
import { HistoryChart } from "../charts/history-chart";
import { RankChart, type RankItem } from "../charts/rank-chart";
import { FuelChart } from "../charts/fuel-chart";
import { BarRow, Block, Empty, Figure, SmallButton, SourceTag, SOURCES, ViewToggle } from "./parts";
import { Compare } from "./compare";
import { TrendAnalysis } from "./trend-analysis";
import { Models } from "./models";
import { localizedLabel, FUEL_LABELS } from "@/lib/data/labels";
import {
  brandPeriodsOf,
  brandRanking,
  brandUniverse,
  categoryMix,
  fuelMix,
  fuelPeriodsOf,
  nearestItems,
  registrationSeries,
  type RegistrationPoint,
} from "@/lib/data/views";
import { fmtNumber, fmtPercent, fmtPeriod, fmtPeriodShort, titleCaseBrand } from "@/lib/format";
import { MAX_COMPARE, seriesColor } from "@/lib/design/tokens";

export function Registrations() {
  const t = useTranslations("reg");
  const tt = useTranslations("trend");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update, shareUrl } = useDashboard();
  const reg = view.registrations;
  const series = useMemo(() => registrationSeries(data, reg.category), [data, reg.category]);
  const point = series.find((p) => p.period === reg.period) ?? null;
  const mix = useMemo(() => categoryMix(data, reg.period), [data, reg.period]);
  const mixMax = Math.max(1, ...mix.map((row) => row.first ?? 0));
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  const usedShare = point?.first && point.used != null ? (point.used / point.first) * 100 : null;
  const privateShare = point?.neu && point.privateNew != null ? (point.privateNew / point.neu) * 100 : null;
  const periodText = fmtPeriod(reg.period, locale);
  const trendSelection = useMemo(() => ({ category: reg.category, brands: [], from: null, period: reg.period }), [reg.category, reg.period]);

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {/* Month summary */}
      <section aria-label={t("summaryLabel")} className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3 text-[13.5px] text-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-paper-2 py-1 pl-2 pr-3 text-ink ring-1 ring-rule">
              <CategoryGlyph code={reg.category} className="h-4 w-8" />
              {tc(reg.category)}
            </span>
            <span className="tabular">{periodText}</span>
          </div>
          <div className="mt-5" />
          <Figure
            size="xl"
            label={t("first")}
            info={t("firstInfo")}
            value={<AnimatedNumber value={point?.first ?? null} format={format} />}
          />
          {point?.first != null && point.neu != null && point.used != null && (
            <div className="mt-5 max-w-[520px]">
              <div className="flex h-3 gap-[2px]" aria-hidden="true">
                <span className="rounded-l-[4px] bg-ink transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${point.newShare}%` }} />
                <span className="rounded-r-[4px] bg-[#9FB0A8] transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${usedShare}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4 border-b border-rule pb-5">
                <Stat label={t("new")} swatch="bg-ink" value={fmtNumber(point.neu, locale)} sub={fmtPercent(point.newShare, locale)} info={t("newInfo")} />
                <Stat label={t("used")} swatch="bg-[#9FB0A8]" value={fmtNumber(point.used, locale)} sub={fmtPercent(usedShare, locale)} info={t("usedInfo")} />
                <Stat label={t("private")} value={fmtNumber(point.privateNew, locale)} sub={t("privateSub", { share: fmtPercent(privateShare, locale) })} info={t("privateInfo")} />
              </dl>
            </div>
          )}
          <div className="mt-4">
            <SourceTag
              href={SOURCES.registrations}
              dataset={t("dataset")}
              period={fmtPeriodShort(reg.period, locale)}
              generatedAt={data.generatedAt}
            />
          </div>
        </div>

        <div className="lg:col-span-7 lg:border-l lg:border-rule lg:pl-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="t-title text-[17px]">{t("mixTitle", { period: fmtPeriodShort(reg.period, locale) })}</h3>
            <p className="text-[12.5px] text-muted">{t("mixHint")}</p>
          </div>
          <div className="mt-3 -mx-2">
            {mix.map((row) => (
              <BarRow
                key={row.category}
                label={tc(row.category)}
                glyph={<CategoryGlyph code={row.category} className="h-3.5 w-7 shrink-0 text-muted" />}
                value={fmtNumber(row.first, locale)}
                sub={row.neu != null && row.first ? t("newPct", { share: fmtPercent((row.neu / row.first) * 100, locale, 0) }) : undefined}
                ratio={(row.first ?? 0) / mixMax}
                active={row.category === reg.category}
                barClass="bg-[#9FB0A8] group-hover:bg-graphite"
                ariaLabel={t("selectCategory", { category: tc(row.category), value: fmtNumber(row.first, locale) })}
                onClick={() => update((current) => ({ ...current, category: row.category, brands: [] }))}
              />
            ))}
          </div>
        </div>
      </section>

      {/* History across imported months */}
      <Block
        id="history"
        title={t("historyTitle", {
          count: series.length,
          from: series[0]?.period.slice(0, 4) ?? "",
          to: series[series.length - 1]?.period.slice(0, 4) ?? "",
        })}
        description={t("historyDescription", { category: tc(reg.category).toLowerCase() })}
        info={t("historyInfo")}
      >
        {point?.first != null && (
          <div className="mb-6">
            <TrendAnalysis
              kind="registrations"
              toolbar={<p className="text-[13px] text-muted">{tt("monthHint", { period: periodText })}</p>}
              data={data}
              selection={trendSelection}
              selectionKey={`registrations|${reg.category}|${reg.period}`}
              categoryLabel={tc(reg.category)}
              shareUrl={shareUrl}
            />
          </div>
        )}
        {series.length > 8 ? (
          <HistoryChart
            points={series}
            selected={reg.period}
            onSelect={(to) => update((current) => ({ ...current, to }))}
            formatValue={format}
            formatPeriod={(p) => fmtPeriod(p, locale)}
            labels={{
              neu: t("new"),
              used: t("used"),
              total: t("first"),
              newShare: t("newShare"),
              chart: t("historyChart"),
              missing: t("notImported"),
            }}
            readout={point && <MonthReadout point={point} selected previousYear={series.find((p) => p.period === shiftYear(point.period, -1)) ?? null} />}
          />
        ) : (
        <MonthColumns
          points={series}
          selected={reg.period}
          onSelect={(to) => update((current) => ({ ...current, to }))}
          locale={locale}
          formatValue={format}
          formatPeriod={(p) => fmtPeriodShort(p, locale)}
          labels={{
            neu: t("new"),
            used: t("used"),
            chart: t("historyChart"),
            select: (period, value) => t("selectMonth", { period, value }),
            gap: (distance) => t("gapTitle", { distance }),
          }}
          renderReadout={(p) => <MonthReadout point={p} selected={p.period === reg.period} />}
        />
        )}
      </Block>

      {/* Brands + fuel */}
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <BrandBlock />
        </div>
        <div className="lg:col-span-5">
          <FuelBlock />
        </div>
      </div>

      <Compare />
      <Models />
    </div>
  );
}

function Stat({ label, value, sub, swatch, info }: { label: string; value: string; sub?: string; swatch?: string; info?: string }) {
  return (
    <div className="min-w-0" title={info}>
      <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
        {swatch && <span className={`h-2 w-2 shrink-0 rounded-[2px] ${swatch}`} aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1">
        <span className="tabular block text-[19px] font-semibold text-ink md:text-[21px]">{value}</span>
        {sub && <span className="tabular block text-[12.5px] text-muted">{sub}</span>}
      </dd>
    </div>
  );
}

function shiftYear(period: string, delta: number) {
  return `${Number(period.slice(0, 4)) + delta}${period.slice(4)}`;
}

function MonthReadout({
  point,
  selected,
  previousYear,
}: {
  point: RegistrationPoint;
  selected: boolean;
  previousYear?: RegistrationPoint | null;
}) {
  const t = useTranslations("reg");
  const locale = useLocale();
  const usedShare = point.first && point.used != null ? (point.used / point.first) * 100 : null;
  const yoy =
    previousYear?.first && point.first != null ? ((point.first - previousYear.first) / previousYear.first) * 100 : null;
  return (
    <div>
      <p className="text-[13px] text-muted">{selected ? t("readoutSelected") : t("readoutHover")}</p>
      <p className="t-title mt-1 text-[22px]">{fmtPeriod(point.period, locale)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-1 xl:grid-cols-2">
        <ReadoutRow label={t("first")} value={fmtNumber(point.first, locale)} strong />
        <ReadoutRow label={t("newShare")} value={fmtPercent(point.newShare, locale)} />
        <ReadoutRow label={t("new")} value={fmtNumber(point.neu, locale)} />
        <ReadoutRow label={t("used")} value={fmtNumber(point.used, locale)} sub={fmtPercent(usedShare, locale)} />
      </dl>
      {previousYear === undefined ? (
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted">{t("seasonNote")}</p>
      ) : previousYear?.first != null && yoy != null ? (
        <p className="mt-5 border-t border-rule pt-4 text-[13px] leading-relaxed text-graphite">
          {t("yoy", {
            period: fmtPeriod(previousYear.period, locale),
            value: fmtNumber(previousYear.first, locale),
            change: `${yoy > 0 ? "+" : yoy < 0 ? "−" : "±"}${fmtPercent(Math.abs(yoy), locale)}`,
          })}
        </p>
      ) : (
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted">{t("yoyMissing")}</p>
      )}
    </div>
  );
}

function ReadoutRow({ label, value, sub, strong = false }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={`tabular mt-0.5 text-ink ${strong ? "text-[26px] font-semibold tracking-[-0.02em]" : "text-[17px] font-semibold"}`}>
        {value}
        {sub && <span className="ml-2 text-[12.5px] font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  );
}

function BrandBlock() {
  const t = useTranslations("reg");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const reg = view.registrations;
  const [table, setTable] = useState(false);
  const periods = brandPeriodsOf(data, reg.category);
  const ranking = useMemo(() => brandRanking(data, reg.category, reg.period), [data, reg.category, reg.period]);
  const universe = useMemo(() => brandUniverse(data, reg.category), [data, reg.category]);
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);

  const items: RankItem[] = useMemo(() => {
    const byslug = new Map(ranking.map((row) => [row.slug, row]));
    return universe.map((brand) => {
      const row = byslug.get(brand.slug);
      const compareIndex = reg.brands.indexOf(brand.slug);
      return {
        id: brand.slug,
        name: titleCaseBrand(brand.name),
        value: row?.value ?? null,
        color: compareIndex >= 0 ? seriesColor(compareIndex) : undefined,
        tip: row
          ? [
              { label: t("rank"), value: `#${row.rank}` },
              { label: t("brandShare"), value: fmtPercent(row.share, locale) },
            ]
          : [],
      };
    });
  }, [universe, ranking, reg.brands, t, locale]);

  const onSelect = useCallback(
    (slug: string) =>
      update((current) => {
        const brands = reg.brands.includes(slug) ? reg.brands.filter((b) => b !== slug) : [...reg.brands, slug].slice(0, MAX_COMPARE);
        return { ...current, brands };
      }),
    [update, reg.brands],
  );

  if (!reg.hasBrands) {
    return (
      <Block title={t("brandsTitle")}>
        <Empty
          title={t("brandsUnavailable", { category: tc(reg.category) })}
          action={
            <SmallButton onClick={() => update((current) => ({ ...current, category: "passenger_car", brands: [] }))}>
              {t("switchToCars")}
            </SmallButton>
          }
        >
          {t("brandsUnavailableBody")}
        </Empty>
      </Block>
    );
  }

  return (
    <Block
      id="brands"
      title={t("brandsTitle")}
      description={t("brandsDescription", { period: fmtPeriodShort(reg.period, locale) })}
      info={t("brandsInfo")}
      actions={<ViewToggle table={table} onChange={setTable} />}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SourceTag href={SOURCES.registrations} dataset={t("brandsDataset")} period={fmtPeriodShort(reg.period, locale)} generatedAt={data.generatedAt} />
          <p className="text-[12.5px] text-muted">{t("brandsHint", { max: MAX_COMPARE })}</p>
        </div>
      }
    >
      {!periods.includes(reg.period) || ranking.length === 0 ? (
        <Empty title={t("noBrandMonth")} />
      ) : table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-[14px]">
            <caption className="sr-only">{t("brandsTitle")}</caption>
            <thead>
              <tr className="text-left text-[12.5px] text-muted">
                <th scope="col" className="py-2 font-medium">#</th>
                <th scope="col" className="py-2 font-medium">{t("brand")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("count")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("brandShare")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.slug} className="border-t border-rule">
                  <td className="tabular py-2.5 text-muted">{row.rank}</td>
                  <td className="py-2.5 font-medium">{titleCaseBrand(row.name)}</td>
                  <td className="tabular py-2.5 text-right font-semibold">{fmtNumber(row.value, locale)}</td>
                  <td className="tabular py-2.5 text-right text-muted">{fmtPercent(row.share, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <RankChart
          items={items}
          visible={ranking.length}
          label={t("count")}
          formatValue={format}
          onSelect={onSelect}
          selected={reg.brands}
          tipFoot={t("tipFoot")}
        />
      )}
    </Block>
  );
}

function FuelBlock() {
  const t = useTranslations("reg");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, query, update } = useDashboard();
  const reg = view.registrations;
  const periods = fuelPeriodsOf(data, reg.category);
  const rows = useMemo(() => fuelMix(data, reg.category, reg.period), [data, reg.category, reg.period]);
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  const formatShare = useCallback((value: number | null) => fmtPercent(value, locale), [locale]);
  const fuelLabel = useCallback((code: string) => localizedLabel(FUEL_LABELS, code, locale, code), [locale]);
  const highlight = query.fuel && rows.some((row) => row.code === query.fuel) ? query.fuel : undefined;
  const lead = highlight ? rows.find((row) => row.code === highlight) : rows[0];

  return (
    <Block
      id="fuel"
      title={t("fuelTitle")}
      description={t("fuelDescription", { category: tc(reg.category).toLowerCase() })}
      info={t("fuelInfo")}
      footer={
        rows.length > 0 && (
          <SourceTag href={SOURCES.registrations} dataset={t("fuelDataset")} period={fmtPeriodShort(reg.period, locale)} generatedAt={data.generatedAt} />
        )
      }
    >
      {rows.length === 0 ? (
        <Empty
          title={t("fuelUnavailable", { period: fmtPeriodShort(reg.period, locale) })}
          action={
            periods.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nearestItems(periods, reg.period).map((period) => (
                  <SmallButton key={period} onClick={() => update((current) => ({ ...current, to: period }))}>
                    {fmtPeriodShort(period, locale)}
                  </SmallButton>
                ))}
              </div>
            )
          }
        >
          {periods.length ? t("fuelUnavailableBody") : t("fuelNone")}
        </Empty>
      ) : (
        <>
          {lead && (
            <p className="mb-4 text-[14px] leading-relaxed text-graphite">
              {t("fuelLead", { fuel: fuelLabel(lead.code).toLowerCase(), share: fmtPercent(lead.share, locale) })}
            </p>
          )}
          <div className="mb-3 flex items-center gap-5 text-[12.5px] text-muted">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-ink" aria-hidden="true" />
              {t("new")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#9FB0A8]" aria-hidden="true" />
              {t("used")}
            </span>
          </div>
          <FuelChart
            rows={rows}
            fuelLabel={fuelLabel}
            labels={{ neu: t("new"), used: t("used"), total: t("first"), share: t("fuelShare"), chart: t("fuelTitle") }}
            formatValue={format}
            formatShare={formatShare}
            highlight={highlight}
            onSelect={(code) => update((current) => ({ ...current, fuel: current.fuel === code ? undefined : code }))}
          />
        </>
      )}
    </Block>
  );
}
