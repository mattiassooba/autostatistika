"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { Block, Empty, Figure, SourceTag, SOURCES } from "./parts";
import { InspectionTrend } from "../charts/inspection-trend";
import { inspectionOutcome, inspectionPopulationsAt, inspectionStations, type InspectionOutcome } from "@/lib/data/views";
import { fmtNumber, fmtPercent, fmtPeriod, fmtPeriodList, fmtPeriodShort } from "@/lib/format";

const PASS = "#181D1D";
const REPEAT = "#D06A2C";

export function Inspections() {
  const t = useTranslations("insp");
  const tp = useTranslations("populations");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const { period, population, periods } = view.inspections;
  const outcome = useMemo(() => inspectionOutcome(data, period, population), [data, period, population]);
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  // Outcome rows: every imported month when there are few, otherwise the
  // selected month for each group (the trend chart carries the history).
  const combos = useMemo(() => {
    const months = periods.length > 6 ? [period] : periods;
    return months.flatMap((p) => inspectionPopulationsAt(data, p).map((pop) => inspectionOutcome(data, p, pop)));
  }, [data, periods, period]);
  const trend = useMemo(
    () => periods.map((p) => inspectionOutcome(data, p, population)).filter((row) => row.total != null),
    [data, periods, population],
  );
  const formatShare = useCallback((value: number) => fmtPercent(value, locale), [locale]);

  if (!period) return <Empty title={t("none")} />;

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <section aria-label={t("summaryLabel")} className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3 text-[13.5px] text-muted">
            <span className="inline-flex items-center rounded-full bg-paper-2 px-3 py-1 text-ink ring-1 ring-rule">{tp(population)}</span>
            <span className="tabular">{fmtPeriod(period, locale)}</span>
          </div>
          <div className="mt-5" />
          <Figure size="xl" label={t("total")} info={t("totalInfo")} value={<AnimatedNumber value={outcome.total} format={format} />} />
          <div className="mt-4">
            <SourceTag href={SOURCES.inspections} dataset={t("dataset")} period={fmtPeriodShort(period, locale)} generatedAt={data.generatedAt} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-7 lg:border-l lg:border-rule lg:pl-12">
          <Gauge label={t("passShare")} value={outcome.passShare} detail={fmtNumber(outcome.pass, locale)} info={t("passInfo")} color={PASS} />
          <Gauge label={t("repeatShare")} value={outcome.repeatShare} detail={fmtNumber(outcome.repeat, locale)} info={t("repeatInfo")} color={REPEAT} />
          <Gauge label={t("periodicShare")} value={outcome.periodicShare} detail={fmtNumber(outcome.periodic, locale)} info={t("periodicInfo")} color="#6E827A" />
        </div>
      </section>

      {trend.length > 6 && (
        <Block
          id="inspection-trend"
          title={t("trendTitle", { population: tp(population).toLowerCase() })}
          description={t("trendDescription")}
          info={t("trendInfo")}
        >
          <InspectionTrend
            rows={trend}
            selected={period}
            onSelect={(to) => update((current) => ({ ...current, to }))}
            formatValue={format}
            formatShare={formatShare}
            formatPeriod={(p) => fmtPeriod(p, locale)}
            labels={{ total: t("total"), repeatShare: t("repeatShare"), chart: t("trendTitle", { population: tp(population) }), missing: t("notImported") }}
          />
        </Block>
      )}

      <Block
        id="outcomes"
        title={t("outcomeTitle")}
        description={t("outcomeDescription")}
        info={t("outcomeInfo")}
        footer={
          <SourceTag
            href={SOURCES.inspections}
            dataset={t("dataset")}
            period={fmtPeriodList(periods, locale, (p) => fmtPeriodShort(p, locale))}
            generatedAt={data.generatedAt}
            note={t("restNote")}
          />
        }
      >
        <div className="mb-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
          <Legend color={PASS} label={t("pass")} />
          <Legend color={REPEAT} label={t("repeat")} />
          <span className="flex items-center gap-2">
            <span className="hatch h-2.5 w-2.5 rounded-[2px] text-graphite/60" aria-hidden="true" />
            {t("rest")}
          </span>
        </div>
        <div className="flex flex-col gap-5">
          {combos.map((row) => (
            <OutcomeRow
              key={`${row.period}-${row.population}`}
              row={row}
              active={row.period === period && row.population === population}
              label={`${fmtPeriodShort(row.period, locale)}, ${tp(row.population).toLowerCase()}`}
              onSelect={() => update((current) => ({ ...current, to: row.period, population: row.population }))}
            />
          ))}
        </div>
        <p className="mt-6 flex max-w-[70ch] items-start gap-2.5 rounded-[12px] bg-paper-2 px-4 py-3 text-[13.5px] leading-relaxed text-graphite">
          <Warning size={17} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
          {t("caution")}
        </p>
      </Block>

      <StationsBlock outcome={outcome} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function Gauge({ label, value, detail, info, color }: { label: string; value: number | null; detail: string; info: string; color: string }) {
  const locale = useLocale();
  const format = useCallback((v: number) => fmtPercent(v, locale), [locale]);
  return (
    <div className="min-w-0">
      <Figure size="lg" label={label} info={info} value={<AnimatedNumber value={value} format={format} />} />
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-3" aria-hidden="true">
        <span className="block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${value ?? 0}%`, background: color }} />
      </div>
      <p className="tabular mt-2 text-[12.5px] text-muted">{detail}</p>
    </div>
  );
}

function OutcomeRow({ row, active, label, onSelect }: { row: InspectionOutcome; active: boolean; label: string; onSelect: () => void }) {
  const t = useTranslations("insp");
  const locale = useLocale();
  if (!row.total) return null;
  const segments = [
    { key: "pass", value: row.pass, share: row.passShare, color: PASS, label: t("pass") },
    { key: "repeat", value: row.repeat, share: row.repeatShare, color: REPEAT, label: t("repeat") },
    { key: "rest", value: row.rest, share: row.rest != null ? (row.rest / row.total) * 100 : null, color: null, label: t("rest") },
  ];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${label}: ${segments.map((s) => `${s.label} ${fmtPercent(s.share, locale)}`).join(", ")}`}
      className="group cursor-pointer text-left"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-4 text-[13.5px]">
        <span className={active ? "font-semibold text-ink" : "text-muted group-hover:text-ink"}>{label}</span>
        <span className="tabular text-muted">{t("events", { value: fmtNumber(row.total, locale) })}</span>
      </span>
      <span className="mt-2 flex h-11 gap-[2px] overflow-hidden rounded-[5px] transition-opacity duration-300" style={{ opacity: active ? 1 : 0.45 }}>
        {segments.map((segment) =>
          segment.share ? (
            <span
              key={segment.key}
              className={`flex items-center overflow-hidden px-3 text-[12.5px] font-medium transition-[width] duration-700 ease-[var(--ease-out)] ${
                segment.color ? "" : "hatch bg-paper-2 text-graphite/50"
              }`}
              style={{ width: `${segment.share}%`, background: segment.color ?? undefined, color: segment.color ? "#F7F7F3" : undefined }}
            >
              {segment.share >= 8 && (
                <span className="tabular whitespace-nowrap" style={{ color: segment.color ? "#F7F7F3" : "#181D1D" }}>
                  {fmtPercent(segment.share, locale)}
                </span>
              )}
            </span>
          ) : null,
        )}
      </span>
      <span className="tabular mt-1.5 flex flex-wrap gap-x-4 text-[12px] text-muted">
        {segments.map((segment) => (
          <span key={segment.key}>
            {segment.label} {fmtNumber(segment.value, locale)}
            {segment.share != null && segment.share < 8 && ` (${fmtPercent(segment.share, locale)})`}
          </span>
        ))}
      </span>
    </button>
  );
}

function StationsBlock({ outcome }: { outcome: InspectionOutcome }) {
  const t = useTranslations("insp");
  const locale = useLocale();
  const { data, view } = useDashboard();
  const { period, population } = view.inspections;
  const { rows, sum } = useMemo(() => inspectionStations(data, period, population), [data, period, population]);
  const [sort, setSort] = useState<"total" | "repeatShare">("total");
  const [expanded, setExpanded] = useState(false);
  const sorted = [...rows].sort((a, b) => (sort === "total" ? b.total - a.total : (b.repeatShare ?? -1) - (a.repeatShare ?? -1)));
  const max = Math.max(1, ...rows.map((row) => row.total));
  const coverage = outcome.total ? (sum / outcome.total) * 100 : null;

  return (
    <Block
      id="stations"
      title={t("stationsTitle")}
      description={t("stationsDescription", { period: fmtPeriodShort(period, locale) })}
      info={t("stationsInfo")}
      footer={rows.length > 0 && <SourceTag href={SOURCES.inspections} dataset={t("dataset")} period={fmtPeriodShort(period, locale)} generatedAt={data.generatedAt} />}
    >
      {rows.length === 0 ? (
        <Empty title={t("stationsNone")} />
      ) : (
        <>
          {coverage != null && coverage < 95 && (
            <p className="mb-5 flex max-w-[70ch] items-start gap-2.5 rounded-[12px] bg-lime-wash px-4 py-3 text-[13.5px] leading-relaxed text-ink ring-1 ring-lime-deep/50">
              <Warning size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t("stationsPartial", {
                count: rows.length,
                sum: fmtNumber(sum, locale),
                total: fmtNumber(outcome.total, locale),
                share: fmtPercent(coverage, locale),
              })}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[14px]">
              <caption className="sr-only">{t("stationsTitle")}</caption>
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th scope="col" className="py-2.5 font-medium">{t("station")}</th>
                  <th scope="col" aria-sort={sort === "total" ? "descending" : "none"} className="py-2.5 text-right font-medium">
                    <button type="button" onClick={() => setSort("total")} className={`cursor-pointer hover:text-ink ${sort === "total" ? "text-ink" : ""}`}>
                      {t("inspections")}
                    </button>
                  </th>
                  <th scope="col" className="hidden w-[24%] py-2.5 pl-4 md:table-cell">
                    <span className="sr-only">{t("bar")}</span>
                  </th>
                  <th scope="col" aria-sort={sort === "repeatShare" ? "descending" : "none"} className="py-2.5 pl-4 text-right font-medium">
                    <button type="button" onClick={() => setSort("repeatShare")} className={`cursor-pointer hover:text-ink ${sort === "repeatShare" ? "text-ink" : ""}`}>
                      {t("repeatShareShort")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? sorted : sorted.slice(0, 15)).map((row) => (
                  <tr key={row.code} className="group border-t border-rule transition-colors hover:bg-paper-2/70">
                    <td className="py-2.5 pr-3 font-medium">{row.name}</td>
                    <td className="tabular py-2.5 text-right font-semibold">{fmtNumber(row.total, locale)}</td>
                    <td className="hidden py-2.5 pl-4 md:table-cell" aria-hidden="true">
                      <span className="block h-2 overflow-hidden">
                        <span className="block h-full rounded-r-[4px] bg-graphite group-hover:bg-ink" style={{ width: `${(row.total / max) * 100}%` }} />
                      </span>
                    </td>
                    <td className="tabular py-2.5 pl-4 text-right text-muted">{fmtPercent(row.repeatShare, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 15 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="press mt-4 inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-[13.5px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50"
            >
              {expanded ? t("showLess") : t("showAll", { count: sorted.length })}
            </button>
          )}
        </>
      )}
    </Block>
  );
}
