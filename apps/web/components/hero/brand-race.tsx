"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, CursorClick } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { CategoryGlyph } from "../ui/glyphs";
import { Segmented } from "../ui/segmented";
import { CoverageTimeline } from "../ui/timeline";
import { TimeScrubber } from "../ui/time-scrubber";
import { brandCategoriesOf, brandPeriodsOf, brandRanking } from "@/lib/data/views";
import { fmtNumber, fmtPercent, fmtMonthName, fmtPeriod, fmtPeriodShort, periodYear, titleCaseBrand } from "@/lib/format";
import { motion as tokens } from "@/lib/design/tokens";

const ROWS = 10;
const STEP_MS = 2600;
const DENSE_STEP_MS = 950;
const DENSE = 8;

/**
 * Signature interaction 1: brand ranking across the imported months.
 * Rows re-order with layout animation, bars and values morph, and brands that
 * fall out of the source's top list leave instead of dropping to zero.
 */
export function BrandRace() {
  const { data, update, ensureSlices, hasSlices } = useDashboard();
  const t = useTranslations("heroRace");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const categories = brandCategoriesOf(data);
  const [category, setCategory] = useState(categories.includes("passenger_car") ? "passenger_car" : categories[0]);
  const periods = useMemo(() => brandPeriodsOf(data, category), [data, category]);
  const [period, setPeriod] = useState(periods[periods.length - 1]);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { amount: 0.25 });

  const activePeriod = periods.includes(period) ? period : periods[periods.length - 1];
  const ranking = useMemo(() => brandRanking(data, category, activePeriod), [data, category, activePeriod]);
  const rows = ranking.slice(0, ROWS);
  // Few months: one scale for all of them, so volume changes stay visible.
  // Many months: scale to the month's leader, like any ranking race; the
  // exact value sits beside every bar.
  const globalMax = useMemo(
    () => Math.max(1, ...periods.flatMap((p) => brandRanking(data, category, p).map((row) => row.value))),
    [data, category, periods],
  );
  const max = periods.length > DENSE ? Math.max(1, rows[0]?.value ?? 1) : globalMax;
  const focused = rows.find((row) => row.slug === focus) ?? null;

  const step = useCallback(() => {
    setPeriod((current) => {
      const index = periods.indexOf(current);
      if (index >= periods.length - 1) {
        setPlaying(false);
        return current;
      }
      return periods[index + 1];
    });
  }, [periods]);

  useEffect(() => {
    if (!playing || !visible) return;
    const base = periods.length > DENSE ? DENSE_STEP_MS : STEP_MS;
    const id = window.setInterval(step, reduce ? base * 1.4 : base);
    return () => window.clearInterval(id);
  }, [playing, visible, step, reduce, periods.length]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (periods.indexOf(activePeriod) >= periods.length - 1) setPeriod(periods[0]);
    setPlaying(true);
  }

  function compare(slug: string) {
    update(
      { tab: "registreerimised", category, to: activePeriod, brands: [slug] },
      { scrollTo: "compare" },
    );
  }

  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);

  return (
    <div ref={root} className="on-dark relative flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-[30ch]">
          <h2 className="t-title text-[19px] text-paper md:text-[21px]">{t("title")}</h2>
          <p className="mt-1.5 text-[13.5px] leading-snug text-paper/55">{t("subtitle")}</p>
        </div>
        <Segmented
          tone="dark"
          size="sm"
          label={t("categoryLabel")}
          value={category}
          onChange={(value) => {
            const apply = () => {
              setCategory(value);
              setFocus(null);
              const next = brandPeriodsOf(data, value);
              setPeriod(next.includes(activePeriod) ? activePeriod : next[next.length - 1]);
            };
            if (hasSlices([`brands:${value}`])) apply();
            else ensureSlices([`brands:${value}`]).then(apply).catch(() => undefined);
          }}
          options={categories.map((code) => ({
            value: code,
            label: tc(code),
            icon: <CategoryGlyph code={code} className="h-3.5 w-7" />,
          }))}
        />
      </div>

      {/* Period, set large */}
      <div className="relative mt-5 flex items-end justify-between gap-4 border-b border-white/10 pb-3" aria-live="polite">
        <div className="relative h-[clamp(52px,6vw,84px)] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={activePeriod}
              initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
              transition={{ duration: 0.55, ease: tokens.easeOut }}
              className="t-display flex items-baseline gap-3 text-[clamp(52px,6vw,84px)] leading-none text-paper"
            >
              <span className="tabular">{periodYear(activePeriod)}</span>
              <span className="text-[0.26em] font-semibold tracking-normal text-lime" style={{ fontVariationSettings: '"wdth" 100' }}>
                {fmtMonthName(activePeriod, locale)}
              </span>
            </motion.p>
          </AnimatePresence>
          <span className="sr-only">{fmtPeriod(activePeriod, locale)}</span>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          aria-label={playing ? t("pause") : t("play")}
          className="press group mb-1 inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-paper/8 pl-1.5 pr-4 text-[13px] font-medium text-paper ring-1 ring-white/12 transition-colors hover:bg-paper/12"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-ink">
            {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </span>
          {playing ? t("pause") : t("play")}
        </button>
      </div>

      {/* Ranking */}
      <ol className="relative mt-2 flex-1" aria-label={t("listLabel", { period: fmtPeriod(activePeriod, locale) })}>
        <AnimatePresence mode="popLayout" initial={false}>
          {rows.map((row) => {
            const isFocus = focus === row.slug;
            const dim = focus != null && !isFocus;
            const leader = row.rank === 1;
            return (
              <motion.li
                key={row.slug}
                layout={reduce ? false : "position"}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: dim ? 0.38 : 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                transition={{ layout: { duration: tokens.rank, ease: tokens.easeOut }, opacity: { duration: 0.2 }, y: { duration: 0.45, ease: tokens.easeOut } }}
              >
                <button
                  type="button"
                  onClick={() => compare(row.slug)}
                  onPointerEnter={() => setFocus(row.slug)}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus(row.slug)}
                  onBlur={() => setFocus(null)}
                  aria-label={t("rowLabel", {
                    rank: row.rank,
                    brand: titleCaseBrand(row.name),
                    value: fmtNumber(row.value, locale),
                    share: fmtPercent(row.share, locale),
                  })}
                  className="group grid w-full cursor-pointer grid-cols-[1.75rem_minmax(6.5rem,9.5rem)_1fr_4.25rem] items-center gap-x-3 rounded-[8px] py-[5px] pl-1 pr-1 text-left transition-colors hover:bg-white/[0.04] md:grid-cols-[2rem_minmax(7rem,10rem)_1fr_5rem]"
                >
                  <span className={`tabular text-[12px] ${leader || isFocus ? "text-lime" : "text-paper/40"}`} style={{ fontFamily: "var(--font-mono)" }}>
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span className="truncate text-[14.5px] font-medium text-paper" style={{ fontVariationSettings: '"wdth" 104' }}>
                    {titleCaseBrand(row.name)}
                  </span>
                  <span className="relative h-[10px] overflow-hidden rounded-r-[4px]">
                    <motion.span
                      className={`absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] ${
                        isFocus ? "bg-lime" : leader ? "bg-lime" : "bg-mist/70 group-hover:bg-mist"
                      }`}
                      initial={false}
                      animate={{ scaleX: row.value / max }}
                      transition={{ duration: reduce ? 0 : tokens.rank, ease: tokens.easeOut }}
                    />
                  </span>
                  <span className="text-right">
                    <AnimatedNumber value={row.value} format={format} className="tabular text-[14px] font-semibold text-paper" />
                  </span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      {/* Readout: details for the focused brand, or how to interact */}
      <div className="mt-1 flex min-h-[40px] items-center gap-2 text-[13px] text-paper/60" aria-live="polite">
        {focused ? (
          <p>
            <span className="font-semibold text-paper">{titleCaseBrand(focused.name)}</span>{" "}
            {t("readout", {
              share: fmtPercent(focused.share, locale),
              rank: focused.rank,
              period: fmtPeriodShort(activePeriod, locale),
            })}{" "}
            <span className="text-lime">{t("clickToCompare")}</span>
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
            <CursorClick size={15} className="text-paper/50" aria-hidden="true" />
            {t("hint", { count: ranking.length })}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-2 border-t border-white/10 pt-4">
        {periods.length > DENSE ? (
          <TimeScrubber
            stops={periods}
            value={activePeriod}
            onChange={(value) => {
              setPlaying(false);
              setPeriod(value);
            }}
            label={t("timelineLabel")}
            formatValue={(stop) => fmtPeriod(stop, locale)}
          />
        ) : (
          <CoverageTimeline
            tone="dark"
            locale={locale}
            stops={periods}
            value={activePeriod}
            onChange={(value) => {
              setPlaying(false);
              setPeriod(value);
            }}
            label={t("timelineLabel")}
            gapTitle={(from, to, distance) => t("gapTitle", { distance })}
            formatStop={(stop) => ({ top: fmtPeriodShort(stop, locale), bottom: "" })}
          />
        )}
        <p className="mt-3 flex items-center gap-2 text-[12px] text-paper/45">
          <span className="hatch inline-block h-2.5 w-6 rounded-[2px] text-paper/35" aria-hidden="true" />
          {periods.length > DENSE ? t("gapNoteDense", { count: periods.length }) : t("gapNote")}
        </p>
      </div>
    </div>
  );
}
