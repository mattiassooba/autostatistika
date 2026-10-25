"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ArrowCounterClockwise, CaretDown, Check, LinkSimple, Plus, SlidersHorizontal, X } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { Segmented } from "../ui/segmented";
import { Popover } from "../ui/popover";
import { Sheet } from "../ui/sheet";
import { Combobox } from "../ui/combobox";
import { PeriodPicker } from "../ui/period-picker";
import { CategoryGlyph, DatasetGlyph } from "../ui/glyphs";
import type { TabId } from "@/lib/data/types";
import { brandUniverse, registrationSeries } from "@/lib/data/views";
import { fmtDate, fmtNumber, fmtPeriodShort, titleCaseBrand } from "@/lib/format";
import { MAX_COMPARE, motion as tokens, seriesColor } from "@/lib/design/tokens";

const TABS: TabId[] = ["registreerimised", "soidukipark", "ulevaatused"];

export function Controls() {
  const t = useTranslations("explorer");
  const tt = useTranslations("tabs");
  const { requestedView: view, query, update, reset } = useDashboard();
  const [sheet, setSheet] = useState(false);

  const activeCount =
    (query.category ? 1 : 0) + (query.to || query.snapshot ? 1 : 0) + view.registrations.brands.length + (query.population ? 1 : 0);

  return (
    <div className="sticky top-[var(--header-h)] z-30 -mx-4 border-b border-rule bg-paper/92 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scrollbar-none">
          <Segmented
            role="tablist"
            controls="panel"
            size="md"
            label={t("datasets")}
            value={query.tab}
            onChange={(tab) => update((current) => ({ ...current, tab }))}
            options={TABS.map((tab) => ({ value: tab, label: tt(tab), icon: <DatasetGlyph tab={tab} className="hidden h-[18px] w-[18px] sm:block" /> }))}
          />
        </div>

        <div className="hidden h-8 w-px bg-rule lg:block" aria-hidden="true" />

        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex">
          <Filters />
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="press inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14px] font-medium text-paper lg:hidden"
          >
            <SlidersHorizontal size={16} />
            {t("filters")}
            {activeCount > 0 && (
              <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-semibold text-ink">
                {activeCount}
              </span>
            )}
          </button>
          <ShareButton />
          <button
            type="button"
            onClick={reset}
            aria-label={t("reset")}
            title={t("reset")}
            className="press inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-graphite ring-1 ring-rule-strong transition-colors hover:text-ink hover:ring-ink/50"
          >
            <ArrowCounterClockwise size={16} />
          </button>
        </div>
      </div>
      <ActiveChips />
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t("filters")}
        closeLabel={t("close")}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="press h-12 cursor-pointer rounded-full px-5 text-[15px] font-medium text-graphite ring-1 ring-rule-strong"
            >
              {t("reset")}
            </button>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="press h-12 flex-1 cursor-pointer rounded-full bg-ink text-[15px] font-medium text-paper"
            >
              {t("showResults")}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-6 pb-2 pt-2">
          <Filters stacked />
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Filters({ stacked = false }: { stacked?: boolean }) {
  const { requestedView: view, query, update, data } = useDashboard();
  const t = useTranslations("filters");
  const tc = useTranslations("categories");
  const tp = useTranslations("populations");
  const locale = useLocale();

  if (query.tab === "soidukipark") {
    return (
      <>
        <Field label={t("snapshot")} stacked={stacked}>
          <TimeField
            items={view.fleet.dates}
            value={view.fleet.date}
            onChange={(snapshot) => update((current) => ({ ...current, snapshot }))}
            label={t("snapshot")}
            format={(date) => fmtDate(date, locale)}
            stacked={stacked}
          />
        </Field>
        <Field label={t("category")} stacked={stacked}>
          <CategoryPicker
            stacked={stacked}
            value={view.fleet.category}
            options={view.fleet.categories.map((code) => ({ code, label: tc(code) }))}
            onChange={(category) => update((current) => ({ ...current, category }))}
          />
        </Field>
        <Unavailable dims={["brand", "fuel", "model"]} stacked={stacked} />
      </>
    );
  }

  if (query.tab === "ulevaatused") {
    return (
      <>
        <Field label={t("period")} stacked={stacked}>
          <TimeField
            items={view.inspections.periods}
            value={view.inspections.period}
            onChange={(to) => update((current) => ({ ...current, to }))}
            label={t("period")}
            format={(period) => fmtPeriodShort(period, locale)}
            stacked={stacked}
          />
        </Field>
        <Field label={t("population")} stacked={stacked}>
          <Segmented
            size="sm"
            label={t("population")}
            value={view.inspections.population}
            onChange={(population) => update((current) => ({ ...current, population }))}
            options={["vehicles", "tractors"].map((code) => ({
              value: code,
              label: tp(code),
              disabled: !view.inspections.populations.includes(code),
            }))}
          />
        </Field>
        <Unavailable dims={["brand", "model", "county"]} stacked={stacked} />
      </>
    );
  }

  const reg = view.registrations;
  return (
    <>
      <Field label={t("category")} stacked={stacked}>
        <CategoryPicker
          stacked={stacked}
          value={reg.category}
          options={reg.categories.map((code) => {
            const point = registrationSeries(data, code).find((p) => p.period === reg.period);
            return { code, label: tc(code), meta: point?.first != null ? fmtNumber(point.first, locale) : undefined };
          })}
          onChange={(category) => update((current) => ({ ...current, category, brands: [] }))}
        />
      </Field>
      <Field label={t("period")} stacked={stacked}>
        <TimeField
          items={reg.periods}
          value={reg.period}
          onChange={(to) => update((current) => ({ ...current, to }))}
          label={t("period")}
          format={(period) => fmtPeriodShort(period, locale)}
          stacked={stacked}
        />
      </Field>
      {reg.hasBrands && (
        <Field label={t("compare")} stacked={stacked}>
          <CompareAdd stacked={stacked} />
        </Field>
      )}
      <Unavailable dims={reg.hasBrands ? ["county", "age"] : ["brand", "county", "age"]} stacked={stacked} />
    </>
  );
}

/** Few values: chips. Many: year × month picker with prev / next stepping. */
function TimeField({
  items,
  value,
  onChange,
  label,
  format,
  stacked,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  format: (value: string) => string;
  stacked: boolean;
}) {
  const t = useTranslations("filters");
  if (items.length <= 6) {
    return (
      <Segmented
        size="sm"
        label={label}
        value={value}
        onChange={onChange}
        options={items.map((item) => ({ value: item, label: format(item) }))}
      />
    );
  }
  return (
    <PeriodPicker
      items={items}
      value={value}
      onChange={onChange}
      label={label}
      formatValue={format}
      inline={stacked}
      prevLabel={t("previous")}
      nextLabel={t("next")}
    />
  );
}

function Field({ label, children, stacked }: { label: string; children: ReactNode; stacked: boolean }) {
  if (!stacked) return <div className="flex items-center" aria-label={label}>{children}</div>;
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-muted">{label}</p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">{children}</div>
    </div>
  );
}

function CategoryPicker({
  value,
  options,
  onChange,
  stacked,
}: {
  value: string;
  options: Array<{ code: string; label: string; meta?: string }>;
  onChange: (code: string) => void;
  stacked: boolean;
}) {
  const t = useTranslations("filters");
  const tc = useTranslations("categories");

  if (stacked) {
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("category")}>
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={option.code === value}
            onClick={() => onChange(option.code)}
            className={`press flex min-h-14 cursor-pointer flex-col items-start justify-center gap-1 rounded-[12px] px-3 py-2 text-left ring-1 transition-colors ${
              option.code === value ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-rule-strong"
            }`}
          >
            <CategoryGlyph code={option.code} className="h-4 w-8 opacity-80" />
            <span className="text-[13.5px] font-medium leading-tight">{option.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <Popover
      label={t("category")}
      width="w-72"
      trigger={({ open, toggle, id, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="dialog"
          className={`press inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-full pl-3 pr-3 text-[14px] font-medium ring-1 transition-colors ${
            open ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-rule-strong hover:ring-ink/50"
          }`}
        >
          <CategoryGlyph code={value} className="h-4 w-8" />
          <span className="max-w-[10rem] truncate">{tc(value)}</span>
          <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    >
      {(close) => (
        <ul role="listbox" aria-label={t("category")} className="max-h-[60vh] overflow-y-auto py-1">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                role="option"
                aria-selected={option.code === value}
                onClick={() => {
                  onChange(option.code);
                  close();
                }}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[14px] transition-colors hover:bg-paper-2 ${
                  option.code === value ? "bg-lime-wash" : ""
                }`}
              >
                <CategoryGlyph code={option.code} className="h-4 w-8 text-graphite" />
                <span className="flex-1">{option.label}</span>
                {option.meta && <span className="tabular text-[12.5px] text-muted">{option.meta}</span>}
                <span className="w-4">{option.code === value && <Check size={14} weight="bold" />}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

export function CompareAdd({ stacked = false, tone = "pill" }: { stacked?: boolean; tone?: "pill" | "inline" }) {
  const t = useTranslations("filters");
  const { data, requestedView: view, update } = useDashboard();
  const locale = useLocale();
  const reg = view.registrations;
  const universe = brandUniverse(data, reg.category);
  const atLimit = reg.brands.length >= MAX_COMPARE;
  const options = universe.map((brand) => {
    const index = reg.brands.indexOf(brand.slug);
    return {
      value: brand.slug,
      label: titleCaseBrand(brand.name),
      meta: t("monthsListed", { count: brand.months }),
      swatch: index >= 0 ? seriesColor(index) : undefined,
    };
  });
  const toggle = (slug: string) =>
    update((current) => {
      const brands = reg.brands.includes(slug) ? reg.brands.filter((b) => b !== slug) : [...reg.brands, slug].slice(0, MAX_COMPARE);
      return { ...current, category: reg.category, brands };
    });

  const combo = (
    <Combobox
      options={options}
      selected={reg.brands}
      onPick={toggle}
      placeholder={t("searchBrand")}
      label={t("compare")}
      emptyText={t("noBrand")}
      limitText={t("maxCompare", { max: MAX_COMPARE })}
      atLimit={atLimit}
    />
  );
  void locale;

  if (stacked) return <div className="w-full">{combo}</div>;

  return (
    <Popover
      label={t("compare")}
      width="w-80"
      trigger={({ open, toggle: toggleOpen, id, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="dialog"
          className={`press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full pl-2 pr-4 text-[14px] font-medium ring-1 transition-colors ${
            open ? "bg-ink text-paper ring-ink" : tone === "inline" ? "bg-lime text-ink ring-lime-deep hover:bg-lime-deep" : "bg-paper text-ink ring-rule-strong hover:ring-ink/50"
          }`}
        >
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${open ? "bg-lime text-ink" : tone === "inline" ? "bg-ink text-lime" : "bg-paper-2"}`}>
            <Plus size={13} weight="bold" />
          </span>
          {t("addBrand")}
          {reg.brands.length > 0 && <span className="tabular text-muted">{reg.brands.length}/{MAX_COMPARE}</span>}
        </button>
      )}
    >
      <div className="p-2">{combo}</div>
    </Popover>
  );
}

function Unavailable({ dims, stacked }: { dims: string[]; stacked: boolean }) {
  const t = useTranslations("filters");
  const td = useTranslations("dims");
  const list = dims.map((dim) => td(dim)).join(", ");
  if (stacked) {
    return <p className="rounded-[12px] bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-muted">{t("unavailable", { dims: list })}</p>;
  }
  return (
    <Popover
      label={t("unavailableTitle")}
      width="w-72"
      trigger={({ open, toggle, id, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          aria-label={t("unavailableShort")}
          title={t("unavailableShort")}
          className={`press inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[15px] font-semibold ring-1 transition-colors ${
            open ? "bg-ink text-paper ring-ink" : "text-muted ring-rule-strong hover:text-ink hover:ring-ink/50"
          }`}
        >
          ?
        </button>
      )}
    >
      <div className="px-3.5 py-3 text-[13px] leading-relaxed text-graphite">
        <p className="t-title text-[14px] text-ink">{t("unavailableTitle")}</p>
        <p className="mt-1.5">{t("unavailable", { dims: list })}</p>
      </div>
    </Popover>
  );
}

function ActiveChips() {
  const { data, requestedView: view, query, update } = useDashboard();
  const t = useTranslations("filters");
  if (query.tab !== "registreerimised" || !view.registrations.brands.length) return null;
  const names = new Map(data.registrations.brands.map((row) => [row.brand_slug, row.brand_source]));
  return (
    <div className="-mt-1 flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
      <span className="shrink-0 text-[12.5px] text-muted">{t("comparing")}</span>
      <AnimatePresence initial={false}>
        {view.registrations.brands.map((slug, index) => (
          <motion.button
            key={slug}
            layout
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: tokens.ui, ease: tokens.easeOut }}
            onClick={() => update((current) => ({ ...current, brands: view.registrations.brands.filter((b) => b !== slug) }))}
            aria-label={t("removeChip", { label: titleCaseBrand(names.get(slug) ?? slug) })}
            className="press group inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-paper pl-2.5 pr-2 text-[13px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesColor(index) }} aria-hidden="true" />
            {titleCaseBrand(names.get(slug) ?? slug)}
            <X size={12} weight="bold" className="text-muted group-hover:text-ink" />
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ShareButton() {
  const t = useTranslations("explorer");
  const { shareUrl } = useDashboard();
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = shareUrl();
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the share sheet */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-live="polite"
      className={`press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-medium ring-1 transition-colors ${
        copied ? "bg-lime text-ink ring-lime-deep" : "bg-paper text-ink ring-rule-strong hover:ring-ink/50"
      }`}
    >
      {copied ? <Check size={15} weight="bold" /> : <LinkSimple size={15} />}
      <span className="hidden sm:inline">{copied ? t("copied") : t("share")}</span>
    </button>
  );
}
