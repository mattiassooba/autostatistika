"use client";

import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MagnifyingGlass } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { Block, Empty, SmallButton, SourceTag, SOURCES } from "./parts";
import { modelPeriodsOf, modelRows, nearestItems, type ModelRowView } from "@/lib/data/views";
import { fmtNumber, fmtPercent, fmtPeriodShort, titleCaseBrand } from "@/lib/format";
import { seriesColor } from "@/lib/design/tokens";

type SortKey = "value" | "model" | "brandShare";
const PAGE = 12;

/** New passenger-car models for the month: a searchable, sortable analytical table. */
export function Models() {
  const t = useTranslations("models");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const reg = view.registrations;
  const [text, setText] = useState("");
  const query = useDeferredValue(text);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });
  const [onlyCompared, setOnlyCompared] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const periods = modelPeriodsOf(data, reg.category);
  const hasPeriod = periods.includes(reg.period);
  const all = useMemo(() => (hasPeriod ? modelRows(data, reg.category, reg.period) : []), [data, reg.category, reg.period, hasPeriod]);
  const max = all[0]?.value ?? 1;

  const filtered = useMemo(() => {
    const needle = query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    let rows = all;
    if (onlyCompared && reg.brands.length) rows = rows.filter((row) => reg.brands.includes(row.brandSlug));
    if (needle) {
      rows = rows.filter((row) =>
        `${row.brand} ${row.model}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .includes(needle),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      if (sort.key === "model") return sort.dir * `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      const av = (a[sort.key] as number | null) ?? -1;
      const bv = (b[sort.key] as number | null) ?? -1;
      return sort.dir * (av - bv) || b.value - a.value;
    });
    return sorted;
  }, [all, query, sort, onlyCompared, reg.brands]);

  if (!periods.length) return null;

  const visible = expanded ? filtered : filtered.slice(0, PAGE);
  const rankOf = new Map(all.map((row, index) => [row.key, index + 1]));

  function sortButton(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "model" ? 1 : -1 }))}
        className={`inline-flex cursor-pointer items-center gap-1 rounded transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        {active && (sort.dir === 1 ? <ArrowUp size={11} weight="bold" /> : <ArrowDown size={11} weight="bold" />)}
      </button>
    );
  }
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");

  return (
    <Block
      id="models"
      title={t("title")}
      description={t("description", { period: fmtPeriodShort(reg.period, locale) })}
      info={t("info")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">{t("search")}</span>
            <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("search")}
              className="h-9 w-48 rounded-full bg-paper-2 pl-8 pr-3 text-[13.5px] ring-1 ring-rule placeholder:text-muted focus:bg-paper focus:outline-none focus:ring-2 focus:ring-ink sm:w-56"
            />
          </label>
          {reg.brands.length > 0 && (
            <SmallButton active={onlyCompared} onClick={() => setOnlyCompared((v) => !v)}>
              {t("onlyCompared")}
            </SmallButton>
          )}
        </div>
      }
      footer={
        hasPeriod && (
          <SourceTag
            href={SOURCES.registrations}
            dataset={t("dataset")}
            period={fmtPeriodShort(reg.period, locale)}
            generatedAt={data.generatedAt}
          />
        )
      }
    >
      {!hasPeriod ? (
        <Empty
          title={t("emptyPeriod")}
          action={
            <div className="flex flex-wrap gap-2">
              {nearestItems(periods, reg.period).map((period) => (
                <SmallButton key={period} onClick={() => update((current) => ({ ...current, to: period }))}>
                  {fmtPeriodShort(period, locale)}
                </SmallButton>
              ))}
            </div>
          }
        >
          {t("emptyPeriodBody")}
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] border-collapse text-[14px]">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="text-[12.5px] text-muted">
                  <th scope="col" className="w-10 py-2.5 text-left font-medium">#</th>
                  <th scope="col" aria-sort={ariaSort("model")} className="py-2.5 text-left font-medium">
                    {sortButton("model", t("model"))}
                  </th>
                  <th scope="col" aria-sort={ariaSort("value")} className="py-2.5 text-right font-medium">
                    {sortButton("value", t("count"))}
                  </th>
                  <th scope="col" className="hidden w-[28%] py-2.5 pl-4 text-left font-medium md:table-cell">
                    <span className="sr-only">{t("bar")}</span>
                  </th>
                  <th scope="col" aria-sort={ariaSort("brandShare")} className="hidden py-2.5 pl-4 text-right font-medium sm:table-cell">
                    {sortButton("brandShare", t("brandShare"))}
                  </th>
                  <th scope="col" className="hidden py-2.5 pl-6 text-right font-medium lg:table-cell">{t("history")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <ModelTableRow
                    key={row.key}
                    row={row}
                    rank={rankOf.get(row.key) ?? 0}
                    max={max}
                    current={reg.period}
                    compareIndex={reg.brands.indexOf(row.brandSlug)}
                    locale={locale}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="py-6 text-[14px] text-muted">{t("noMatch")}</p>}
          {filtered.length > PAGE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="press mt-4 inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-[13.5px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50"
            >
              {expanded ? t("showLess") : t("showAll", { count: filtered.length })}
            </button>
          )}
        </>
      )}
    </Block>
  );
}

function ModelTableRow({
  row,
  rank,
  max,
  current,
  compareIndex,
  locale,
}: {
  row: ModelRowView;
  rank: number;
  max: number;
  current: string;
  compareIndex: number;
  locale: string;
}) {
  const t = useTranslations("models");
  const historyMax = Math.max(1, ...row.history.map((h) => h.value ?? 0));
  return (
    <tr className="group border-t border-rule transition-colors hover:bg-paper-2/70">
      <td className="tabular py-2.5 text-[12.5px] text-muted">{rank}</td>
      <td className="py-2.5 pr-3">
        <span className="flex items-center gap-2">
          {compareIndex >= 0 && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seriesColor(compareIndex) }} aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block text-[11.5px] text-muted">{titleCaseBrand(row.brand)}</span>
            <span className="block truncate font-medium text-ink">{row.model}</span>
          </span>
        </span>
      </td>
      <td className="tabular py-2.5 text-right font-semibold">{fmtNumber(row.value, locale)}</td>
      <td className="hidden py-2.5 pl-4 md:table-cell" aria-hidden="true">
        <span className="block h-2 overflow-hidden">
          <span className="block h-full rounded-r-[4px] bg-graphite transition-[width] duration-700 group-hover:bg-ink" style={{ width: `${(row.value / max) * 100}%` }} />
        </span>
      </td>
      <td className="tabular hidden py-2.5 pl-4 text-right text-muted sm:table-cell">{fmtPercent(row.brandShare, locale, 0)}</td>
      <td className="hidden py-2.5 pl-6 lg:table-cell">
        <span
          className="ml-auto flex h-6 w-[64px] items-end justify-end gap-[3px]"
          role="img"
          aria-label={row.history
            .map((h) => `${fmtPeriodShort(h.period, locale)}: ${h.value == null ? t("notListed") : fmtNumber(h.value, locale)}`)
            .join(", ")}
        >
          {row.history.map((h) => (
            <span key={h.period} className="flex h-full w-3.5 items-end" title={`${fmtPeriodShort(h.period, locale)}: ${h.value == null ? t("notListed") : fmtNumber(h.value, locale)}`}>
              {h.value == null ? (
                <span className="hatch block h-1.5 w-full rounded-[1px] text-graphite/35" />
              ) : (
                <span
                  className={`block w-full rounded-t-[2px] ${h.period === current ? "bg-ink" : "bg-[#9FB0A8]"}`}
                  style={{ height: `${Math.max(8, (h.value / historyMax) * 100)}%` }}
                />
              )}
            </span>
          ))}
        </span>
      </td>
    </tr>
  );
}
