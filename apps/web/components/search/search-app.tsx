"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, Check, LinkSimple, SlidersHorizontal, X } from "@phosphor-icons/react";
import { CategoryGlyph } from "../ui/glyphs";
import { Segmented } from "../ui/segmented";
import { MultiPick, RangeField } from "./fields";
import { SearchResults } from "./results";
import { NUMBER_FILTERS, TEXT_FILTERS, type NumberFilter, type Range, type TextFilter, type Variant } from "@/lib/search/engine";
import { loadManifest, registerBase, type Manifest } from "@/lib/search/load";
import { valueLabel } from "@/lib/search/labels";
import { activeCount, emptySearch, parseSearch, searchParams, type SearchState } from "@/lib/search/url";
import type { WorkerRequest, WorkerResponse } from "@/lib/search/worker";
import { fmtNumber, fmtPercent, titleCaseBrand } from "@/lib/format";
import { motion as tokens } from "@/lib/design/tokens";

const PAGE = 25;
const FAMILY_ORDER = ["passenger_car", "truck", "bus", "trailer", "motorcycle", "moped", "l_other", "offroad", "tractor", "tractor_trailer", "self_propelled", "unclassified"];
/** Filters shown in the main row; the rest open under "more filters". */
const MAIN_TEXT: TextFilter[] = ["engine", "gearbox", "body", "county"];
const MORE_TEXT: TextFilter[] = ["colour", "owner", "euro", "hybrid", "fuel_combination", "status_detail", "category"];
const MORE_RANGES: NumberFilter[] = ["engine_cc", "length", "width", "height", "mass_max", "mass_empty", "tow_braked", "top_speed", "co2_wltp", "co2_nedc", "cons_wltp", "cons_nedc", "ev_range", "seats", "doors", "axles", "year_ee"];
export const UNITS: Partial<Record<string, string>> = {
  power: "kw",
  engine_cc: "cc",
  length: "mm",
  width: "mm",
  height: "mm",
  mass_max: "kg",
  mass_reg: "kg",
  mass_empty: "kg",
  tow_braked: "kg",
  tow_unbraked: "kg",
  train_mass: "kg",
  hitch_load: "kg",
  top_speed: "kmh",
  co2_wltp: "gkm",
  co2_nedc: "gkm",
  cons_wltp: "l100",
  cons_nedc: "l100",
  ev_range: "km",
  noise: "db",
};

export type ResultMessage = Extract<WorkerResponse, { type: "result" }>;

export function fmtBytes(bytes: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === "en" ? "en-GB" : "et-EE", { maximumFractionDigits: 1 }).format(bytes / 1e6)} MB`;
}

function useSearchWorker(snapshot: string) {
  const base = registerBase(snapshot);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [result, setResult] = useState<ResultMessage | null>(null);
  const [loading, setLoading] = useState<{ files: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsMakes, setNeedsMakes] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [detail, setDetail] = useState<{ id: number; data: Extract<WorkerResponse, { type: "detail" }>["detail"] | null } | null>(null);
  const detailSeq = useRef(0);

  useEffect(() => {
    if (typeof DecompressionStream === "undefined" || typeof Worker === "undefined") {
      setUnsupported(true);
      return;
    }
    const w = new Worker(new URL("../../lib/search/worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "detail") {
        if (message.seq === detailSeq.current) setDetail((current) => (current ? { ...current, data: message.detail } : current));
        return;
      }
      if (message.seq !== seq.current) return;
      if (message.type === "loading") setLoading({ files: message.files, bytes: message.bytes });
      else if (message.type === "needs-makes") {
        setNeedsMakes(message.bytes);
        setBusy(false);
        setLoading(null);
      } else if (message.type === "result") {
        setResult(message);
        setNeedsMakes(null);
        setBusy(false);
        setLoading(null);
      } else if (message.type === "error") {
        setFailed(true);
        setBusy(false);
        setLoading(null);
      }
    };
    loadManifest(base)
      .then((m) => {
        setManifest(m);
        w.postMessage({ type: "init", base, manifest: m } satisfies WorkerRequest);
      })
      .catch(() => setFailed(true));
    return () => w.terminate();
  }, [base]);

  const run = useCallback((state: SearchState, limit: number, allMakes: boolean) => {
    if (!worker.current) return;
    seq.current += 1;
    setBusy(true);
    setFailed(false);
    worker.current.postMessage({ type: "search", seq: seq.current, state, limit, allMakes } satisfies WorkerRequest);
  }, []);

  const requestDetail = useCallback((state: SearchState, variant: Variant | null) => {
    if (!variant) {
      setDetail(null);
      return;
    }
    detailSeq.current += 1;
    setDetail({ id: variant.id, data: null });
    worker.current?.postMessage({ type: "detail", seq: detailSeq.current, state, variant } satisfies WorkerRequest);
  }, []);

  return { manifest, result, loading, busy, needsMakes, failed, unsupported, run, detail, requestDetail };
}

export function SearchApp({ snapshot }: { snapshot: string }) {
  const t = useTranslations("search");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const search = useSearchWorker(snapshot);
  const { manifest, result, run } = search;
  const [state, setState] = useState<SearchState>(emptySearch());
  const [ready, setReady] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [allMakes, setAllMakes] = useState(false);
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);

  // A shared link's query is applied in the browser (the page is static).
  useEffect(() => {
    const parsed = parseSearch(new URLSearchParams(window.location.search));
    setState(parsed);
    if (MORE_TEXT.some((key) => parsed.text[key]?.length) || MORE_RANGES.some((key) => parsed.ranges[key])) setMore(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const query = searchParams(state).toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [state, ready]);

  useEffect(() => {
    if (!ready || !manifest) return;
    const timer = window.setTimeout(() => run(state, limit, allMakes), 120);
    return () => window.clearTimeout(timer);
  }, [state, limit, allMakes, ready, manifest, run]);

  const { requestDetail } = search;
  const update = useCallback(
    (patch: (current: SearchState) => SearchState) => {
      setState((current) => patch(current));
      setLimit(PAGE);
      requestDetail(emptySearch(), null);
    },
    [requestDetail],
  );

  const makeNames = useMemo(() => new Map(manifest?.makes.map((make) => [make.slug, titleCaseBrand(make.name)]) ?? []), [manifest]);
  const familyFill = manifest?.fill[state.family] ?? {};
  const options = result?.options ?? {};
  const counts = result?.result.facets ?? {};
  const label = (dimension: string, value: string) => valueLabel(dimension, value, locale, t("notStated"));

  function textOptions(dimension: TextFilter | "model") {
    const current = new Map((counts[dimension] ?? []).map((row) => [row.value, row.vehicles]));
    const values = new Set([...(options[dimension] ?? []).map((row) => row.value), ...((dimension === "model" ? state.models : state.text[dimension]) ?? [])]);
    return [...values].map((value) => ({
      value,
      label: dimension === "model" ? value || t("notStated") : label(dimension, value),
      meta: fmtNumber(current.get(value) ?? 0, locale),
    }));
  }

  function setText(dimension: TextFilter, values: string[]) {
    update((current) => ({ ...current, text: { ...current.text, [dimension]: values.length ? values : undefined } }));
  }
  function setRange(dimension: NumberFilter, value: Range | undefined) {
    update((current) => ({ ...current, ranges: { ...current.ranges, [dimension]: value } }));
  }
  function summary(dimension: TextFilter | "model", values: string[]) {
    if (values.length > 1) return t("selected", { count: values.length });
    return dimension === "model" ? values[0] : label(dimension, values[0]);
  }

  const families = manifest ? FAMILY_ORDER.filter((family) => manifest.families[family]) : [];
  const makeOptions = useMemo(
    () =>
      (manifest?.makes ?? [])
        .filter((make) => make.families[state.family])
        .sort((a, b) => b.families[state.family] - a.families[state.family])
        .map((make) => ({ value: make.slug, label: titleCaseBrand(make.name), meta: fmtNumber(make.families[state.family], locale) })),
    [manifest, state.family, locale],
  );
  const statusValue = state.text.status?.length === 1 ? state.text.status[0] : "all";
  const active = activeCount(state);
  const moreActive = MORE_TEXT.reduce((sum, key) => sum + (state.text[key]?.length ? 1 : 0), 0) + MORE_RANGES.reduce((sum, key) => sum + (state.ranges[key] ? 1 : 0), 0);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed */
    }
  }

  if (search.unsupported) {
    return <p className="mx-auto max-w-[1600px] px-4 py-10 text-[15px] text-graphite sm:px-8 lg:px-12">{t("unsupported")}</p>;
  }

  const chips: Array<{ key: string; text: string; remove: () => void }> = [
    ...state.makes.map((slug) => ({ key: `make:${slug}`, text: makeNames.get(slug) ?? slug, remove: () => update((c) => ({ ...c, makes: c.makes.filter((m) => m !== slug), models: [] })) })),
    ...state.models.map((model) => ({ key: `model:${model}`, text: model, remove: () => update((c) => ({ ...c, models: c.models.filter((m) => m !== model) })) })),
    ...TEXT_FILTERS.flatMap((key) =>
      (state.text[key] ?? []).map((value) => ({ key: `${key}:${value}`, text: `${t(key)}: ${label(key, value)}`, remove: () => setText(key, (state.text[key] ?? []).filter((v) => v !== value)) })),
    ),
    ...NUMBER_FILTERS.flatMap((key) => {
      const range = state.ranges[key];
      if (!range) return [];
      const unit = UNITS[key] ? ` ${t(`unit.${UNITS[key]}`)}` : "";
      const text = `${t(key)}: ${range[0] != null ? fmtNumber(range[0], locale) : "…"}–${range[1] != null ? fmtNumber(range[1], locale) : "…"}${unit}`;
      return [{ key: `range:${key}`, text, remove: () => setRange(key, undefined) }];
    }),
  ];

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 sm:px-8 lg:px-12">
      {/* Family */}
      <div role="group" aria-label={t("family")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-none">
        {(families.length ? families : ["passenger_car"]).map((family) => {
          const selected = state.family === family;
          return (
            <button
              key={family}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setAllMakes(false);
                update(() => emptySearch(family));
              }}
              className={`press inline-flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full pl-3 pr-4 text-[14px] font-medium ring-1 transition-colors ${
                selected ? "bg-ink text-paper ring-ink" : "bg-paper text-graphite ring-rule-strong hover:text-ink hover:ring-ink/50"
              }`}
            >
              <CategoryGlyph code={family} className="h-4 w-8 shrink-0" />
              {tc(family)}
              {manifest && <span className={`tabular text-[12.5px] ${selected ? "text-paper/60" : "text-muted"}`}>{fmtNumber(manifest.families[family].vehicles, locale)}</span>}
            </button>
          );
        })}
      </div>

      {/* Main filters */}
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4 xl:grid-cols-6">
        <MultiPick
          label={t("make")}
          options={makeOptions}
          values={state.makes}
          onChange={(makes) => update((c) => ({ ...c, makes, models: c.models.length && makes.length ? c.models : [] }))}
          summary={state.makes.length > 1 ? t("selected", { count: state.makes.length }) : (makeNames.get(state.makes[0]) ?? "")}
          placeholder={t("search")}
          anyText={t("all")}
          emptyText={t("noOptions")}
        />
        <MultiPick
          label={t("model")}
          options={state.makes.length ? textOptions("model") : []}
          values={state.models}
          onChange={(models) => update((c) => ({ ...c, models }))}
          summary={summary("model", state.models)}
          placeholder={t("search")}
          anyText={t("all")}
          emptyText={t("noOptions")}
          disabledText={state.makes.length ? undefined : t("chooseMakeFirst")}
        />
        <RangeField label={t("year")} value={state.ranges.year} onChange={(v) => setRange("year", v)} minLabel={t("min")} maxLabel={t("max")} />
        <RangeField label={t("power")} unit={t("unit.kw")} value={state.ranges.power} onChange={(v) => setRange("power", v)} minLabel={t("min")} maxLabel={t("max")} />
        {MAIN_TEXT.map((key) => (
          <MultiPick
            key={key}
            label={t(key)}
            options={textOptions(key)}
            values={state.text[key] ?? []}
            onChange={(values) => setText(key, values)}
            summary={summary(key, state.text[key] ?? [])}
            placeholder={t("search")}
          anyText={t("all")}
            emptyText={t("noOptions")}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          label={t("status")}
          value={statusValue}
          onChange={(value) => setText("status", value === "all" ? [] : [value])}
          options={[
            { value: "all", label: t("all") },
            { value: "REGISTREERITUD", label: t("registered") },
            { value: "PEATATUD", label: t("suspended") },
          ]}
        />
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          aria-controls="more-filters"
          className={`press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-medium ring-1 transition-colors ${
            more ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-rule-strong hover:ring-ink/50"
          }`}
        >
          <SlidersHorizontal size={15} />
          {more ? t("fewer") : moreActive ? t("moreCount", { count: moreActive }) : t("more")}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {active > 0 && (
            <button
              type="button"
              onClick={() => update((c) => emptySearch(c.family))}
              className="press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-medium text-graphite ring-1 ring-rule-strong hover:text-ink hover:ring-ink/50"
            >
              <ArrowCounterClockwise size={15} />
              {t("reset")}
            </button>
          )}
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
        </div>
      </div>

      <AnimatePresence initial={false}>
        {more && (
          <motion.div
            id="more-filters"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: tokens.ui, ease: tokens.easeOut }}
            className="overflow-hidden"
          >
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 rounded-[16px] bg-paper-2 p-4 ring-1 ring-rule md:grid-cols-4 xl:grid-cols-6">
              {MORE_TEXT.map((key) => (
                <MultiPick
                  key={key}
                  label={t(key)}
                  options={textOptions(key)}
                  values={state.text[key] ?? []}
                  onChange={(values) => setText(key, values)}
                  summary={summary(key, state.text[key] ?? [])}
                  placeholder={t("search")}
                  anyText={t("all")}
                  emptyText={t("noOptions")}
                />
              ))}
              {MORE_RANGES.map((key) => (
                <RangeField
                  key={key}
                  label={t(key)}
                  unit={UNITS[key] ? t(`unit.${UNITS[key]}`) : undefined}
                  value={state.ranges[key]}
                  onChange={(v) => setRange(key, v)}
                  minLabel={t("min")}
                  maxLabel={t("max")}
                  note={familyFill[key] != null && familyFill[key] < 0.995 ? t("fill", { share: fmtPercent(familyFill[key] * 100, locale, 0) }) : undefined}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={t("remove", { label: chip.text })}
              className="press group inline-flex h-8 cursor-pointer items-center gap-2 rounded-full bg-paper pl-3 pr-2 text-[13px] font-medium text-ink ring-1 ring-rule-strong hover:ring-ink/50"
            >
              {chip.text}
              <X size={12} weight="bold" className="text-muted group-hover:text-ink" />
            </button>
          ))}
        </div>
      )}

      <SearchResults
        state={state}
        manifest={manifest}
        search={search}
        makeNames={makeNames}
        onMore={() => setLimit((value) => value + PAGE)}
        onLoadAll={() => setAllMakes(true)}
        onSort={(sort, dir) => update((c) => ({ ...c, sort, dir }))}
        onPick={(dimension, value) =>
          dimension === "make"
            ? update((c) => ({ ...c, makes: c.makes.includes(value) ? c.makes : [...c.makes, value] }))
            : dimension === "model"
              ? update((c) => ({ ...c, models: c.models.includes(value) ? c.models : [...c.models, value] }))
              : setText(dimension, (state.text[dimension] ?? []).includes(value) ? (state.text[dimension] ?? []) : [...(state.text[dimension] ?? []), value])
        }
        onYears={(range) => setRange("year", range)}
      />
    </div>
  );
}
