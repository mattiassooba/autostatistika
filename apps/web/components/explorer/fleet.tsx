"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { CategoryGlyph } from "../ui/glyphs";
import { CountyTiles } from "../charts/county-tiles";
import { MiniColumns } from "../charts/mini-columns";
import { BarRow, Block, Empty, Figure, SmallButton, SourceTag, SOURCES } from "./parts";
import { localizedLabel, AGE_LABELS, STATUS_LABELS } from "@/lib/data/labels";
import {
  fleetAges,
  fleetBrandDatesOf,
  fleetBrands,
  fleetComposition,
  fleetHistory,
  fleetRegions,
  fleetValue,
  nearestItems,
  regionDatesOf,
} from "@/lib/data/views";
import { countyName, fmtDate, fmtNumber, fmtPercent, fmtPeriodList, titleCaseBrand } from "@/lib/format";
import { ordinal, textOn } from "@/lib/design/tokens";

export function Fleet() {
  const t = useTranslations("fleet");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const { date, category } = view.fleet;
  const stock = useMemo(() => (date && category ? fleetValue(data, date, category) : null), [data, date, category]);
  const history = useMemo(() => fleetHistory(data, category), [data, category]);
  const historyMax = Math.max(1, ...history.map((row) => row.value));
  const composition = useMemo(() => (date ? fleetComposition(data, date) : []), [data, date]);
  const compositionMax = Math.max(1, ...composition.map((row) => row.value));
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  const dateText = fmtDate(date, locale);

  if (!date) {
    return <Empty title={t("none")} />;
  }

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <section aria-label={t("summaryLabel")} className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3 text-[13.5px] text-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-paper-2 py-1 pl-2 pr-3 text-ink ring-1 ring-rule">
              <CategoryGlyph code={category} className="h-4 w-8" />
              {tc(category)}
            </span>
            <span className="tabular">{t("asOf", { date: dateText })}</span>
          </div>
          <div className="mt-5" />
          <Figure
            size="xl"
            label={stock?.mixedStatus ? t("stockMixed") : t("stock")}
            info={t("stockInfo")}
            value={<AnimatedNumber value={stock?.value ?? null} format={format} />}
          />
          {stock && stock.statuses.length > 1 && (
            <div className="mt-5 max-w-[520px]">
              <div className="flex h-3 gap-[2px]" aria-hidden="true">
                {stock.statuses.map((row, index) => (
                  <span
                    key={row.status}
                    className={`${index === 0 ? "rounded-l-[4px]" : ""} ${index === stock.statuses.length - 1 ? "rounded-r-[4px]" : ""}`}
                    style={{ width: `${(row.value / stock.value) * 100}%`, background: index === 0 ? "#181D1D" : "#9FB0A8" }}
                  />
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-4">
                {stock.statuses.map((row, index) => (
                  <div key={row.status}>
                    <dt className="flex items-center gap-2 text-[12.5px] text-muted">
                      <span className="h-2 w-2 rounded-[2px]" style={{ background: index === 0 ? "#181D1D" : "#9FB0A8" }} aria-hidden="true" />
                      {localizedLabel(STATUS_LABELS, row.status, locale)}
                    </dt>
                    <dd className="tabular mt-0.5 text-[19px] font-semibold">
                      {fmtNumber(row.value, locale)}{" "}
                      <span className="text-[12.5px] font-normal text-muted">{fmtPercent((row.value / stock.value) * 100, locale)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{t("statusNote")}</p>
            </div>
          )}
          <div className="mt-4">
            <SourceTag href={SOURCES.fleet} dataset={t("dataset")} period={dateText} generatedAt={data.generatedAt} />
          </div>
        </div>

        <div className="lg:col-span-7 lg:border-l lg:border-rule lg:pl-12">
          <h3 className="t-title text-[17px]">{t("historyTitle", { category: tc(category) })}</h3>
          <p className="mt-1 text-[13px] text-muted">{t("historyNote")}</p>
          {history.length > 6 ? (
            <div className="mt-4">
              <MiniColumns
                items={history.map((row) => ({ key: row.date, value: row.value }))}
                selected={date}
                onSelect={(snapshot) => update((current) => ({ ...current, snapshot, category }))}
                formatValue={format}
                formatLabel={(key) => fmtDate(key, locale)}
                label={t("historyTitle", { category: tc(category) })}
              />
            </div>
          ) : (
            <div className="-mx-2 mt-3">
              {history.map((row) => (
                <BarRow
                  key={row.date}
                  label={<span className="tabular">{fmtDate(row.date, locale)}</span>}
                  value={fmtNumber(row.value, locale)}
                  ratio={row.value / historyMax}
                  active={row.date === date}
                  barClass="bg-[#9FB0A8] group-hover:bg-graphite"
                  ariaLabel={t("selectDate", { date: fmtDate(row.date, locale) })}
                  onClick={() => update((current) => ({ ...current, snapshot: row.date, category }))}
                />
              ))}
            </div>
          )}
          {history.length < 2 && <p className="mt-3 text-[13px] text-muted">{t("historySingle")}</p>}

          <h3 className="t-title mt-10 text-[17px]">{t("compositionTitle", { date: dateText })}</h3>
          <p className="mt-1 text-[13px] text-muted">{t("compositionNote")}</p>
          <div className="-mx-2 mt-3">
            {composition.map((row) => (
              <BarRow
                key={row.category}
                label={tc(row.category)}
                glyph={<CategoryGlyph code={row.category} className="h-3.5 w-7 shrink-0 text-muted" />}
                value={fmtNumber(row.value, locale)}
                ratio={row.value / compositionMax}
                active={row.category === category}
                barClass="bg-[#9FB0A8] group-hover:bg-graphite"
                ariaLabel={tc(row.category)}
                onClick={() => update((current) => ({ ...current, category: row.category, snapshot: date }))}
              />
            ))}
          </div>
        </div>
      </section>

      <CountyBlock />
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <AgeBlock />
        </div>
        <div className="lg:col-span-6">
          <FleetBrandBlock />
        </div>
      </div>
    </div>
  );
}

function CountyBlock() {
  const t = useTranslations("fleet");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const { date, category } = view.fleet;
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => fleetRegions(data, date, category), [data, date, category]);
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  const formatShare = useCallback((value: number | null) => fmtPercent(value, locale), [locale]);
  const regionDates = regionDatesOf(data, category);
  const max = rows[0]?.value ?? 1;
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Block
      id="counties"
      title={t("countyTitle")}
      description={t("countyDescription", { category: tc(category).toLowerCase(), date: fmtDate(date, locale) })}
      info={t("countyInfo")}
      footer={
        rows.length > 0 && (
          <SourceTag href={SOURCES.fleet} dataset={t("countyDataset")} period={fmtDate(date, locale)} generatedAt={data.generatedAt} note={t("countyNote", { total: fmtNumber(total, locale) })} />
        )
      }
    >
      {rows.length === 0 ? (
        <Empty
          title={t("countyUnavailable")}
          action={
            regionDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nearestItems(regionDates, date).map((d) => (
                  <SmallButton key={d} onClick={() => update((current) => ({ ...current, snapshot: d, category }))}>
                    {fmtDate(d, locale)}
                  </SmallButton>
                ))}
              </div>
            )
          }
        >
          {regionDates.length ? t("countyUnavailableBody") : t("countyNone")}
        </Empty>
      ) : (
        <div className="grid gap-10 md:grid-cols-[minmax(0,460px)_1fr] md:gap-12">
          <CountyTiles
            rows={rows.map((row) => ({ code: row.code, name: countyName(row.name), value: row.value, share: row.share }))}
            formatValue={format}
            formatShare={formatShare}
            selected={selected}
            onSelect={setSelected}
            label={t("countyTitle")}
            legendLabel={t("countyLegend")}
          />
          <div className="-mx-2">
            {rows.map((row) => (
              <BarRow
                key={row.code}
                label={row.code === "unassigned" ? t("unassigned") : countyName(row.name)}
                value={fmtNumber(row.value, locale)}
                sub={fmtPercent(row.share, locale)}
                ratio={row.value / max}
                active={selected === row.code}
                barClass="bg-[#9FB0A8] group-hover:bg-graphite"
                ariaLabel={row.code === "unassigned" ? t("unassigned") : countyName(row.name)}
                onClick={() => setSelected(selected === row.code ? null : row.code)}
              />
            ))}
          </div>
        </div>
      )}
    </Block>
  );
}

function AgeBlock() {
  const t = useTranslations("fleet");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const { date, category } = view.fleet;
  // Every snapshot has an age split; compare the selected one with the first
  // and the latest instead of listing a row per month.
  const rows = useMemo(() => {
    const all = fleetAges(data, category);
    if (all.length <= 4) return all;
    const keep = new Set([all[0].date, date, all[all.length - 1].date]);
    const middle = all[Math.floor(all.length / 2)].date;
    if (keep.size < 3) keep.add(middle);
    return all.filter((row) => keep.has(row.date));
  }, [data, category, date]);

  return (
    <Block
      id="ages"
      title={t("ageTitle")}
      description={t("ageDescription", { category: tc(category).toLowerCase() })}
      info={t("ageInfo")}
      footer={rows.length > 0 && <SourceTag href={SOURCES.fleet} dataset={t("ageDataset")} period={fmtPeriodList(rows.map((r) => r.date), locale, (d) => fmtDate(d, locale))} generatedAt={data.generatedAt} />}
    >
      {rows.length === 0 ? (
        <Empty title={t("ageUnavailable", { category: tc(category) })}>{t("ageUnavailableBody")}</Empty>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
            {rows[0].bands.map((band, index) => (
              <span key={band.band} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ordinal[index] }} aria-hidden="true" />
                {localizedLabel(AGE_LABELS, band.band, locale, band.band)}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {rows.map((row) => {
              const active = row.date === date;
              return (
                <button
                  key={row.date}
                  type="button"
                  onClick={() => update((current) => ({ ...current, snapshot: row.date, category }))}
                  aria-pressed={active}
                  className="group cursor-pointer text-left"
                  aria-label={`${fmtDate(row.date, locale)}: ${row.bands
                    .map((b) => `${localizedLabel(AGE_LABELS, b.band, locale)} ${fmtPercent(b.share, locale)}`)
                    .join(", ")}`}
                >
                  <span className="flex items-baseline justify-between text-[13px]">
                    <span className={`tabular ${active ? "font-semibold text-ink" : "text-muted group-hover:text-ink"}`}>{fmtDate(row.date, locale)}</span>
                    <span className="tabular text-muted">{fmtNumber(row.total, locale)}</span>
                  </span>
                  <span
                    className="mt-1.5 flex h-9 gap-[2px] overflow-hidden rounded-[4px] transition-opacity duration-300"
                    style={{ opacity: active ? 1 : 0.5 }}
                  >
                    {row.bands.map((band, index) =>
                      band.share ? (
                        <span
                          key={band.band}
                          className="flex items-center overflow-hidden px-2 text-[11.5px] font-medium transition-[width] duration-700"
                          style={{ width: `${band.share}%`, background: ordinal[index], color: textOn(ordinal[index]) }}
                        >
                          {band.share >= 9 && <span className="tabular whitespace-nowrap">{fmtPercent(band.share, locale, 0)}</span>}
                        </span>
                      ) : null,
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{t("ageNote")}</p>
        </div>
      )}
    </Block>
  );
}

function FleetBrandBlock() {
  const t = useTranslations("fleet");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const { data, view, update } = useDashboard();
  const { date, category } = view.fleet;
  const brands = useMemo(() => fleetBrands(data, date, category), [data, date, category]);
  const [expanded, setExpanded] = useState(false);
  const available = nearestItems(fleetBrandDatesOf(data, category).filter((d) => d !== date), date);
  const visible = expanded ? brands.rows.slice(0, 30) : brands.rows.slice(0, 10);
  const max = brands.rows[0]?.value ?? 1;

  return (
    <Block
      id="fleet-brands"
      title={t("brandTitle")}
      description={
        brands.kind === "top"
          ? t("brandTopDescription", { count: brands.rows.length, category: tc(category).toLowerCase(), date: fmtDate(date, locale) })
          : t("brandDescription", { category: tc(category).toLowerCase(), date: fmtDate(date, locale) })
      }
      info={t("brandInfo")}
      footer={
        brands.kind !== "none" && brands.reconciles && (
          <SourceTag href={SOURCES.fleet} dataset={t("brandDataset")} period={fmtDate(date, locale)} generatedAt={data.generatedAt} />
        )
      }
    >
      {brands.kind === "none" || !brands.reconciles ? (
        <Empty
          title={brands.rows.length ? t("brandNotReconciled") : t("brandUnavailable")}
          action={
            available.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {available.map((d) => (
                  <SmallButton key={d} onClick={() => update((current) => ({ ...current, snapshot: d, category }))}>
                    {fmtDate(d, locale)}
                  </SmallButton>
                ))}
              </div>
            )
          }
        >
          {brands.rows.length
            ? t("brandNotReconciledBody", { sum: fmtNumber(brands.brandSum, locale), stock: fmtNumber(brands.stock, locale) })
            : t("brandUnavailableBody")}
        </Empty>
      ) : (
        <>
          {brands.kind === "top" && brands.stock != null && (
            <p className="mb-4 text-[13.5px] leading-relaxed text-graphite">
              {t("brandTopNote", {
                count: brands.rows.length,
                share: fmtPercent((brands.brandSum / brands.stock) * 100, locale),
                rest: fmtNumber(brands.stock - brands.brandSum, locale),
              })}
            </p>
          )}
          <div className="-mx-2">
            {visible.map((row) => (
              <BarRow
                key={row.slug}
                label={titleCaseBrand(row.name)}
                value={fmtNumber(row.value, locale)}
                sub={fmtPercent(row.share, locale)}
                ratio={row.value / max}
              />
            ))}
          </div>
          {brands.rows.length > 10 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="press mt-3 inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-[13.5px] font-medium ring-1 ring-rule-strong hover:ring-ink/50"
            >
              {expanded ? t("showLess") : t("showMore", { count: Math.min(30, brands.rows.length) })}
            </button>
          )}
        </>
      )}
    </Block>
  );
}
