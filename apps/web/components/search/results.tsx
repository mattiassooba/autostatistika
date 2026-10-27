"use client";

import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motion as tokens } from "@/lib/design/tokens";
import { CaretDown, CircleNotch, DownloadSimple, Scales, X } from "@phosphor-icons/react";
import { AnimatedNumber } from "../ui/animated-number";
import { BrandLogo } from "../ui/brand-logo";
import { VehicleBlueprint } from "../hero/vehicle-blueprint";
import { BarRow, Empty } from "../explorer/parts";
import { fmtBytes, UNITS, type CompareItems, type ResultMessage } from "./search-app";
import type { Facet, Range, SortKey, TextFilter, Variant, VariantDetail } from "@/lib/search/engine";
import type { Manifest } from "@/lib/search/load";
import { valueLabel } from "@/lib/search/labels";
import { MAX_COMPARE, type CompareRef, type SearchState } from "@/lib/search/url";
import { BREAKDOWN_LABELS, UNKNOWN_LABEL } from "@/lib/data/labels";
import { fmtNumber, fmtPercent } from "@/lib/format";

type SearchHook = {
  result: ResultMessage | null;
  loading: { files: number; bytes: number } | null;
  busy: boolean;
  needsMakes: number | null;
  failed: boolean;
  detail: { id: number; data: VariantDetail | null } | null;
  requestDetail: (state: SearchState, variant: Variant | null) => void;
};

const SORTS: Array<{ key: string; sort: SortKey; dir: 1 | -1; label: string }> = [
  { key: "vehicles", sort: "vehicles", dir: -1, label: "sortVehicles" },
  { key: "newest", sort: "year", dir: -1, label: "sortNewest" },
  { key: "oldest", sort: "year", dir: 1, label: "sortOldest" },
  { key: "power", sort: "power", dir: -1, label: "sortPower" },
  { key: "name", sort: "name", dir: 1, label: "sortName" },
];

export function SearchResults({
  state,
  manifest,
  search,
  makeNames,
  onMore,
  onLoadAll,
  onSort,
  onPick,
  onYears,
  compare,
  compareItems,
  onToggleCompare,
  onClearCompare,
  onExport,
  exporting,
}: {
  state: SearchState;
  manifest: Manifest | null;
  search: SearchHook;
  makeNames: Map<string, string>;
  onMore: () => void;
  onLoadAll: () => void;
  onSort: (sort: SortKey, dir: 1 | -1) => void;
  onPick: (dimension: TextFilter | "make" | "model", value: string) => void;
  onYears: (range: Range | undefined) => void;
  compare: CompareRef[];
  compareItems: CompareItems;
  onToggleCompare: (variant: Variant) => void;
  onClearCompare: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const message = search.result;
  const r = message?.result;
  const status = new Map((r?.facets.status ?? []).map((row) => [row.value, row.vehicles]));
  const sortKey = SORTS.find((s) => s.sort === state.sort && s.dir === state.dir)?.key ?? "vehicles";
  const label = (dimension: string, value: string) => valueLabel(dimension, value, locale, t("notStated"));

  return (
    <section aria-labelledby="results-title" className="mt-10 border-t border-ink pt-6" aria-busy={search.busy}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h2 id="results-title" className="text-[13.5px] text-muted">
            {t("resultLabel")}
          </h2>
          <p className="sr-only" aria-live="polite">
            {r && !search.busy ? `${fmtNumber(r.vehicles, locale)} ${t("vehicles", { count: r.vehicles })}, ${t("variants", { count: r.variantsTotal })}` : ""}
          </p>
          <p className="mt-1 flex items-baseline gap-3" aria-hidden="true">
            <span className="t-figure tabular text-[clamp(2.8rem,6vw,4.6rem)] leading-none text-ink">
              <AnimatedNumber value={r?.vehicles ?? null} format={(value) => fmtNumber(value, locale)} />
            </span>
            <span className="text-[17px] text-graphite">{t("vehicles", { count: r?.vehicles ?? 0 })}</span>
          </p>
          {r && r.vehicles > 0 && (
            <p className="mt-2 text-[14px] text-graphite">
              {t("variants", { count: r.variantsTotal })} ·{" "}
              {t("statusSplit", { registered: fmtNumber(status.get("REGISTREERITUD") ?? 0, locale), suspended: fmtNumber(status.get("PEATATUD") ?? 0, locale) })}
            </p>
          )}
          {r && r.missingForRange > 0 && <p className="mt-1.5 text-[13px] text-muted">{t("missing", { count: fmtNumber(r.missingForRange, locale) })}</p>}
        </div>
        <p className="flex h-6 items-center gap-2 text-[13px] text-muted" aria-live="polite">
          {(search.busy || !manifest) && <CircleNotch size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {!manifest ? t("loadingData") : search.loading ? t("loadingFiles", { files: search.loading.files, size: fmtBytes(search.loading.bytes, locale) }) : null}
        </p>
      </div>

      {search.failed && (
        <div role="alert" className="mt-6 rounded-[12px] bg-ink px-4 py-3 text-[14px] text-paper">
          {t("error")}
        </div>
      )}

      {search.needsMakes != null && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-lime-wash px-4 py-3.5 ring-1 ring-lime-deep">
          <p className="max-w-[70ch] text-[14px] text-ink">{t("needsMakes", { size: fmtBytes(search.needsMakes, locale) })}</p>
          <button type="button" onClick={onLoadAll} className="press h-10 cursor-pointer rounded-full bg-ink px-4 text-[14px] font-medium text-paper">
            {t("loadAll")}
          </button>
        </div>
      )}

      {r && r.vehicles === 0 && !search.busy && search.needsMakes == null && (
        <div className="mt-8">
          <Empty title={t("noResults")}>{t("noResultsBody")}</Empty>
        </div>
      )}

      {r && r.vehicles > 0 && (
        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="t-title text-[19px]">{t("variantsTitle")}</h3>
                <p className="mt-1 text-[13px] text-muted">{t("variantsNote")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExport}
                disabled={exporting}
                title={t("csvNote")}
                className="press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50 disabled:cursor-wait disabled:opacity-60"
              >
                {exporting ? <CircleNotch size={15} className="animate-spin motion-reduce:animate-none" /> : <DownloadSimple size={15} />}
                {t("csv")}
              </button>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                {t("sort")}
                <select
                  value={sortKey}
                  onChange={(event) => {
                    const choice = SORTS.find((s) => s.key === event.target.value)!;
                    onSort(choice.sort, choice.dir);
                  }}
                  className="h-10 cursor-pointer rounded-full bg-paper px-3 text-[14px] text-ink ring-1 ring-rule-strong hover:ring-ink/50 focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {t(s.label)}
                    </option>
                  ))}
                </select>
              </label>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-muted">{t("csvNote")}</p>
            {compare.length > 0 && <CompareTable items={compareItems} pending={compare.length} makeNames={makeNames} onRemove={onToggleCompare} onClear={onClearCompare} />}
            <ol className="mt-4 divide-y divide-rule border-y border-rule">
              {r.variants.map((variant, index) => (
                <VariantRow
                  key={variant.id}
                  index={index}
                  variant={variant}
                  name={makeNames.get(variant.make) ?? variant.make}
                  open={search.detail?.id === variant.id}
                  detail={search.detail?.id === variant.id ? search.detail.data : null}
                  onToggle={() => search.requestDetail(state, search.detail?.id === variant.id ? null : variant)}
                  compared={compare.some((ref) => ref.id === variant.id)}
                  compareFull={compare.length >= MAX_COMPARE}
                  onCompare={() => onToggleCompare(variant)}
                />
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
              <span>{t("shown", { shown: fmtNumber(r.variants.length, locale), total: fmtNumber(r.variantsTotal, locale) })}</span>
              {r.variants.length < r.variantsTotal && (
                <button
                  type="button"
                  onClick={onMore}
                  className="press h-10 cursor-pointer rounded-full px-4 text-[14px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50"
                >
                  {t("showMore", { count: Math.min(25, r.variantsTotal - r.variants.length) })}
                </button>
              )}
            </div>
          </div>

          <aside className="min-w-0 lg:col-span-4" aria-label={t("statsTitle")}>
            <h3 className="t-title text-[19px]">{t("statsTitle")}</h3>
            {!state.makes.length && r.facets.make && (
              <Breakdown title={t("byMake")} rows={r.facets.make.slice(0, 10)} total={r.vehicles} name={(v) => makeNames.get(v) ?? v} onPick={(v) => onPick("make", v)} logos />
            )}
            {state.makes.length > 0 && r.facets.model && (
              <Breakdown title={t("byModel")} rows={r.facets.model.slice(0, 10)} total={r.vehicles} name={(v) => v || t("notStated")} onPick={(v) => onPick("model", v)} />
            )}
            {r.facets.engine && <Breakdown title={t("byEngine")} rows={r.facets.engine} total={r.vehicles} name={(v) => label("engine", v)} onPick={(v) => onPick("engine", v)} />}
            <Breakdown
              title={t("byPower")}
              rows={r.powerBands.map((row) => ({ value: row.band, vehicles: row.vehicles }))}
              total={r.vehicles}
              name={(v) => (v === "unknown" ? UNKNOWN_LABEL[locale === "en" ? "en" : "et"] : (BREAKDOWN_LABELS.power_band[v]?.[locale === "en" ? "en" : "et"] ?? v))}
              keepOrder
            />
            <Years years={r.years} total={r.vehicles} onPick={onYears} />
            {r.facets.county && <Breakdown title={t("byCounty")} rows={r.facets.county} total={r.vehicles} name={(v) => label("county", v)} onPick={(v) => onPick("county", v)} />}
          </aside>
        </div>
      )}
    </section>
  );
}

function Breakdown({
  title,
  rows,
  total,
  name,
  onPick,
  logos = false,
  keepOrder = false,
}: {
  title: string;
  rows: Facet;
  total: number;
  name: (value: string) => string;
  onPick?: (value: string) => void;
  logos?: boolean;
  keepOrder?: boolean;
}) {
  const locale = useLocale();
  const list = keepOrder ? rows : [...rows].sort((a, b) => b.vehicles - a.vehicles);
  const max = Math.max(1, ...list.map((row) => row.vehicles));
  return (
    <div className="mt-8">
      <h4 className="mb-2 text-[13.5px] font-semibold text-ink">{title}</h4>
      <div className="-mx-2">
        {list.map((row) => (
          <BarRow
            key={row.value}
            label={name(row.value)}
            glyph={logos ? <BrandLogo slug={row.value} name={name(row.value)} tone="light" className="h-6 w-6 shrink-0 text-[8.5px] text-ink" /> : undefined}
            value={fmtNumber(row.vehicles, locale)}
            sub={fmtPercent((row.vehicles / total) * 100, locale)}
            ratio={row.vehicles / max}
            barClass="bg-[#9FB0A8] group-hover:bg-graphite"
            ariaLabel={`${name(row.value)}: ${fmtNumber(row.vehicles, locale)}`}
            onClick={onPick && row.value ? () => onPick(row.value) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Years({ years, total, onPick }: { years: Array<{ year: number; vehicles: number }>; total: number; onPick: (range: Range | undefined) => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  if (!years.length) return null;
  const first = years[0].year;
  const last = years[years.length - 1].year;
  const byYear = new Map(years.map((row) => [row.year, row.vehicles]));
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...years.map((row) => row.vehicles));
  const known = years.reduce((sum, row) => sum + row.vehicles, 0);
  return (
    <div className="mt-8">
      <h4 className="mb-2 text-[13.5px] font-semibold text-ink">{t("byYear")}</h4>
      <div className="flex h-24 items-end gap-px" role="group" aria-label={t("byYear")}>
        {span.map((year) => {
          const n = byYear.get(year) ?? 0;
          return (
            <button
              key={year}
              type="button"
              onClick={() => onPick([year, year])}
              aria-label={`${year}: ${fmtNumber(n, locale)}`}
              title={`${year}: ${fmtNumber(n, locale)}`}
              className="group flex h-full min-w-[2px] flex-1 cursor-pointer items-end"
            >
              <span className="block w-full rounded-t-[1px] bg-[#9FB0A8] transition-colors group-hover:bg-ink" style={{ height: n ? `${Math.max(3, (n / max) * 100)}%` : "0" }} />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted tabular">
        <span>{first}</span>
        <span>{last}</span>
      </div>
      {known < total && <p className="mt-1 text-[11.5px] text-muted">{fmtPercent(((total - known) / total) * 100, locale)} · {t("notStated")}</p>}
    </div>
  );
}

function VariantRow({
  index,
  variant,
  name,
  open,
  detail,
  onToggle,
  compared,
  compareFull,
  onCompare,
}: {
  index: number;
  variant: Variant;
  name: string;
  open: boolean;
  detail: VariantDetail | null;
  onToggle: () => void;
  compared: boolean;
  compareFull: boolean;
  onCompare: () => void;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const label = (dimension: string, value: string) => valueLabel(dimension, value, locale, t("notStated"));
  const facts = [
    variant.year ?? t("notStated"),
    label("engine", variant.engine),
    variant.power != null ? `${fmtNumber(variant.power, locale)} ${t("unit.kw")}` : null,
    variant.gearbox ? label("gearbox", variant.gearbox) : null,
    variant.body ? label("body", variant.body) : null,
  ].filter(Boolean);
  const id = `variant-${variant.id}`;
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      // Rows added by "show more" or a new search arrive in a short, capped wave.
      transition={{ duration: tokens.ui, ease: tokens.easeOut, delay: reduce ? 0 : Math.min(index % 25, 12) * 0.018 }}
    >
      <div className={`flex items-center transition-colors ${open ? "bg-paper-2" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className={`group grid min-w-0 flex-1 cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)_auto_1.25rem] items-center gap-x-3 px-1 py-3.5 text-left transition-colors hover:bg-paper-2 ${open ? "bg-paper-2" : ""}`}
      >
        <BrandLogo slug={variant.make} name={name} tone="light" className="h-9 w-9 text-[10px] text-ink" />
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-semibold text-ink">
            {name} {variant.model}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-graphite">{facts.join(" · ")}</span>
        </span>
        <span className="text-right">
          <span className="tabular block text-[17px] font-semibold text-ink">{fmtNumber(variant.vehicles, locale)}</span>
          <span className="block text-[11.5px] text-muted">{t("vehicles", { count: variant.vehicles })}</span>
        </span>
        <CaretDown size={14} weight="bold" className={`text-muted transition-transform group-hover:text-ink ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCompare}
        aria-pressed={compared}
        disabled={!compared && compareFull}
        title={!compared && compareFull ? t("compareMax", { max: MAX_COMPARE }) : undefined}
        aria-label={`${compared ? t("comparing") : t("compare")}: ${name} ${variant.model}`}
        className={`press ml-1 mr-1 inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          compared ? "bg-ink text-paper ring-ink" : "bg-paper text-graphite ring-rule-strong hover:text-ink hover:ring-ink/50"
        }`}
      >
        <Scales size={14} />
        <span className="hidden sm:inline">{compared ? t("comparing") : t("compare")}</span>
      </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="detail"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: tokens.ui, ease: tokens.easeOut }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-6 pt-2">
              {detail ? <DetailPanel detail={detail} /> : <CircleNotch size={16} className="m-3 animate-spin text-muted motion-reduce:animate-none" aria-label={t("loadingData")} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const GROUPS: Array<{ title: string; numbers: string[]; texts: string[] }> = [
  { title: "groupDimensions", numbers: ["length", "width", "height", "doors", "seats", "axles", "wheels", "drive_axles"], texts: ["category", "body_code"] },
  { title: "groupMass", numbers: ["mass_max", "mass_reg", "mass_empty", "tow_braked", "tow_unbraked", "train_mass", "hitch_load"], texts: [] },
  { title: "groupEngine", numbers: ["power", "engine_cc", "top_speed"], texts: ["fuel_combination", "fuel_main", "fuel_extra", "hybrid"] },
  { title: "groupEnvironment", numbers: ["co2_wltp", "co2_nedc", "cons_wltp", "cons_nedc", "ev_range", "noise"], texts: ["euro"] },
];
// Text values in the detail that share another dimension's labels.
const DETAIL_LABELS: Record<string, string> = { fuel_main: "engine", fuel_extra: "engine" };

function rangeText(entry: { min: number; max: number }, unit: string, locale: string): string {
  const decimals = new Intl.NumberFormat(locale === "en" ? "en-GB" : "et-EE", { maximumFractionDigits: 1 });
  const value = entry.min === entry.max ? decimals.format(entry.min) : `${decimals.format(entry.min)}–${decimals.format(entry.max)}`;
  return unit ? `${value} ${unit}` : value;
}

const COMPARE_NUMBERS = ["power", "engine_cc", "top_speed", "length", "width", "height", "mass_empty", "mass_max", "tow_braked", "co2_wltp", "co2_nedc", "cons_wltp", "cons_nedc", "ev_range", "seats", "doors"];
const COMPARE_TEXTS = ["euro", "fuel_combination", "hybrid"];

function CompareTable({
  items,
  pending,
  makeNames,
  onRemove,
  onClear,
}: {
  items: CompareItems;
  pending: number;
  makeNames: Map<string, string>;
  onRemove: (variant: Variant) => void;
  onClear: () => void;
}) {
  const t = useTranslations("search");
  const tl = useTranslations("search.detail");
  const locale = useLocale();
  const label = (dimension: string, value: string) => valueLabel(dimension, value, locale, t("notStated"));
  const shown = items.filter((item): item is NonNullable<CompareItems[number]> => item != null);
  const rows = [
    ...COMPARE_NUMBERS.filter((key) => shown.some((item) => item.detail.numbers[key])).map((key) => ({
      key,
      label: tl(key),
      cell: (item: (typeof shown)[number]) => {
        const entry = item.detail.numbers[key];
        if (!entry) return { text: "—", known: 0 };
        return { text: rangeText(entry, UNITS[key] ? t(`unit.${UNITS[key]}`) : "", locale), known: entry.known };
      },
    })),
    ...COMPARE_TEXTS.filter((key) => shown.some((item) => item.detail.texts[key]?.some((row) => row.value))).map((key) => ({
      key,
      label: tl(key),
      cell: (item: (typeof shown)[number]) => {
        const values = item.detail.texts[key]?.filter((row) => row.value) ?? [];
        return { text: values.length ? values.slice(0, 2).map((row) => label(key, row.value)).join(", ") : "—", known: values.reduce((sum, row) => sum + row.vehicles, 0) };
      },
    })),
  ];
  return (
    <section id="compare" aria-labelledby="compare-title" className="mt-6 rounded-[16px] bg-paper-2 p-4 ring-1 ring-rule">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="compare-title" className="t-title text-[17px]">
          {t("compareTitle")}
        </h3>
        <button type="button" onClick={onClear} className="press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-graphite ring-1 ring-rule-strong hover:text-ink">
          <X size={12} weight="bold" />
          {t("compareClear")}
        </button>
      </div>
      {shown.length < 2 ? (
        <p className="mt-2 text-[13.5px] text-graphite">{shown.length < pending ? t("loadingData") : t("compareHint")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-ink text-left align-bottom">
                <th scope="col" className="sticky left-0 bg-paper-2 py-2 pr-4 font-normal text-muted">
                  <span className="sr-only">{t("compareTitle")}</span>
                </th>
                {shown.map(({ variant }) => {
                  const name = makeNames.get(variant.make) ?? variant.make;
                  return (
                    <th key={variant.id} scope="col" className="min-w-[9.5rem] py-2 pr-4 font-normal">
                      <span className="flex items-start gap-2">
                        <BrandLogo slug={variant.make} name={name} tone="light" className="h-7 w-7 shrink-0 text-[9px] text-ink" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink">
                            {name} {variant.model}
                          </span>
                          <span className="block text-[12px] text-muted">
                            {[variant.year, label("engine", variant.engine), variant.gearbox ? label("gearbox", variant.gearbox) : null].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(variant)}
                          aria-label={t("remove", { label: `${name} ${variant.model}` })}
                          className="ml-auto cursor-pointer rounded-full p-1 text-muted hover:bg-paper hover:text-ink"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule">
                <th scope="row" className="sticky left-0 bg-paper-2 py-1.5 pr-4 text-left font-normal text-graphite">
                  {t("csvVehicles")}
                </th>
                {shown.map(({ variant }) => (
                  <td key={variant.id} className="tabular py-1.5 pr-4 font-semibold text-ink">
                    {fmtNumber(variant.vehicles, locale)}
                  </td>
                ))}
              </tr>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-rule">
                  <th scope="row" className="sticky left-0 bg-paper-2 py-1.5 pr-4 text-left font-normal text-graphite">
                    {row.label}
                  </th>
                  {shown.map((item) => {
                    const cell = row.cell(item);
                    return (
                      <td key={item.variant.id} className="py-1.5 pr-4">
                        <span className="tabular text-ink">{cell.text}</span>
                        {cell.known > 0 && cell.known < item.variant.vehicles && (
                          <span className="block text-[11px] text-muted">{t("known", { known: fmtNumber(cell.known, locale), total: fmtNumber(item.variant.vehicles, locale) })}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted">{t("compareNote")}</p>
    </section>
  );
}

function DetailPanel({ detail }: { detail: VariantDetail }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const tl = useTranslations("search.detail");
  const label = (dimension: string, value: string) => valueLabel(dimension, value, locale, t("notStated"));
  const span = (key: string) => (detail.numbers[key] ? rangeText(detail.numbers[key], t("unit.mm"), locale) : undefined);
  // The drawing is a generic passenger car: only M1/M1G variants get it.
  const categories = detail.texts.category?.filter((row) => row.value) ?? [];
  const car = categories.length > 0 && categories.every((row) => row.value.startsWith("M1"));
  const drawing = car && (detail.numbers.length || detail.numbers.height);
  return (
    <div>
      {drawing && (
        <figure className="mb-7 rounded-[14px] bg-paper px-4 pb-3 pt-4 ring-1 ring-rule">
          <VehicleBlueprint still labels={{ length: span("length"), height: span("height") }} className="mx-auto block w-full max-w-[620px]" />
          <figcaption className="mt-2 flex flex-wrap justify-between gap-x-4 text-[12px] text-muted">
            <span>{span("width") ? `${tl("width")} ${span("width")}` : ""}</span>
            <span>{t("notToScale")}</span>
          </figcaption>
        </figure>
      )}
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((group) => {
          const rows = [
            ...group.numbers.flatMap((key) => {
              const entry = detail.numbers[key];
              if (!entry) return [];
              return [{ key, label: tl(key), value: rangeText(entry, UNITS[key] ? t(`unit.${UNITS[key]}`) : "", locale), known: entry.known }];
            }),
            ...group.texts.flatMap((key) => {
              const values = detail.texts[key]?.filter((row) => row.value);
              if (!values?.length) return [];
              return [{ key, label: tl(key), value: values.slice(0, 3).map((row) => label(DETAIL_LABELS[key] ?? key, row.value)).join(", "), known: values.reduce((s, r) => s + r.vehicles, 0) }];
            }),
          ];
          if (!rows.length) return null;
          return (
            <dl key={group.title}>
              <dt className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">{t(group.title)}</dt>
              {rows.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5 text-[14px]">
                  <span className="text-graphite">{row.label}</span>
                  <span className="text-right">
                    <span className="tabular font-medium text-ink">{row.value}</span>
                    {row.known < detail.vehicles && <span className="ml-2 text-[11.5px] text-muted">{t("known", { known: fmtNumber(row.known, locale), total: fmtNumber(detail.vehicles, locale) })}</span>}
                  </span>
                </div>
              ))}
            </dl>
          );
        })}
        <dl>
          <dt className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">{t("groupDistribution")}</dt>
          {(["colour", "county", "status", "owner"] as const).map((key) => {
            const values = detail.texts[key];
            if (!values?.length) return null;
            return (
              <div key={key} className="border-b border-rule py-1.5 text-[14px]">
                <span className="text-graphite">{t(key)}</span>
                <span className="mt-0.5 block text-ink">
                  {values
                    .slice(0, 4)
                    .map((row) => `${label(key, row.value)} ${fmtNumber(row.vehicles, locale)}`)
                    .join(" · ")}
                  {values.length > 4 ? " …" : ""}
                </span>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="mt-4 text-[12px] text-muted">{t("detailNote")}</p>
    </div>
  );
}

