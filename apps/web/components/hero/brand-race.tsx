"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, CursorClick, Pause, Play } from "@phosphor-icons/react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { BrandLogo } from "../ui/brand-logo";
import { CategoryGlyph } from "../ui/glyphs";
import { Segmented } from "../ui/segmented";
import { CoverageTimeline } from "../ui/timeline";
import { TimeScrubber } from "../ui/time-scrubber";
import { BrandDuel } from "./brand-duel";
import { useHero } from "./hero-state";
import { shiftPeriod } from "@/lib/data/pages";
import { brandRanking, type BrandRank } from "@/lib/data/views";
import { MAX_COMPARE, motion as tokens } from "@/lib/design/tokens";
import { fmtMonthName, fmtNumber, fmtPercent, fmtPeriod, fmtPeriodShort, periodYear, titleCaseBrand } from "@/lib/format";

const ROWS = 10;
const STEP_MS = 2600;
const DENSE_STEP_MS = 950;
const DENSE = 8;
const STAGGER = 0.065;

/**
 * The hero's ranking of brands by first registrations for the selected month.
 * Enters once (rows rise, bars grow, counts tick up), re-orders with layout
 * animation when the month changes, explains a row on hover or focus, and
 * lets people pick up to four brands for a side-by-side comparison.
 */
export function BrandRace() {
  const { data } = useDashboard();
  const { categories, category, pendingCategory, selectCategory, periods, period, setPeriod, selected, toggleBrand } = useHero();
  const t = useTranslations("heroRace");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hoverSlug, setHover] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { amount: 0.25 });
  const seen = useInView(root, { amount: 0.15, once: true });
  const [entered, setEntered] = useState(false);
  const revealed = seen || Boolean(reduce);

  // The staggered entrance runs once; afterwards changes animate without delay.
  useEffect(() => {
    if (!revealed || entered) return;
    const id = window.setTimeout(() => setEntered(true), reduce ? 0 : 1500);
    return () => window.clearTimeout(id);
  }, [revealed, entered, reduce]);

  const ranking = useMemo(() => brandRanking(data, category, period), [data, category, period]);
  const rows = ranking.slice(0, ROWS);
  // A row removed while hovered never fires pointerleave, and after a re-rank a
  // different brand sits under the pointer: hover is cleared on every change
  // and only counts for a row that is actually shown.
  useEffect(() => setHover(null), [period, category]);
  const hover = hoverSlug && rows.some((row) => row.slug === hoverSlug) ? hoverSlug : null;
  const previousPeriod = shiftPeriod(period, -1);
  const previous = useMemo(
    () => (periods.includes(previousPeriod) ? brandRanking(data, category, previousPeriod) : null),
    [data, category, periods, previousPeriod],
  );
  // Few months: one scale for all of them, so volume changes stay visible.
  // Many months: scale to the month's leader; the exact value sits beside every bar.
  const globalMax = useMemo(
    () => Math.max(1, ...periods.flatMap((p) => brandRanking(data, category, p).map((row) => row.value))),
    [data, category, periods],
  );
  const max = periods.length > DENSE ? Math.max(1, rows[0]?.value ?? 1) : globalMax;
  const index = periods.indexOf(period);

  const step = useCallback(() => {
    const at = periods.indexOf(period);
    if (at >= periods.length - 1) {
      setPlaying(false);
      return;
    }
    setPeriod(periods[at + 1]);
  }, [periods, period, setPeriod]);

  useEffect(() => {
    if (!playing || !visible) return;
    const base = periods.length > DENSE ? DENSE_STEP_MS : STEP_MS;
    const id = window.setTimeout(step, reduce ? base * 1.4 : base);
    return () => window.clearTimeout(id);
  }, [playing, visible, step, reduce, periods.length]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (index >= periods.length - 1) setPeriod(periods[0]);
    setPlaying(true);
  }

  function go(next: string | undefined) {
    if (!next) return;
    setPlaying(false);
    setPeriod(next);
  }

  // Tooltip position, measured from the hovered row.
  const [tip, setTip] = useState<TipPosition | null>(null);
  useLayoutEffect(() => {
    const row = hover ? list.current?.querySelector<HTMLElement>(`li[data-slug="${hover}"]`) : null;
    const box = list.current;
    if (!row || !box) {
      setTip(null);
      return;
    }
    const bar = row.querySelector<HTMLElement>("[data-bar]");
    const rowBox = row.getBoundingClientRect();
    const listBox = box.getBoundingClientRect();
    const left = bar ? bar.getBoundingClientRect().left - listBox.left : 0;
    const below = rowBox.bottom - listBox.top + 6;
    const above = below + 150 > listBox.height;
    const x = Math.max(0, Math.min(left, listBox.width - 252));
    setTip(above ? { bottom: listBox.bottom - rowBox.top + 6, left: x, above } : { top: below, left: x, above });
  }, [hover, period, category, rows.length]);

  // Brands that entered the top list since the last month shown fade in.
  const shown = useRef<Set<string>>(new Set());
  const fresh = entered ? new Set(rows.map((row) => row.slug).filter((slug) => !shown.current.has(slug))) : new Set<string>();
  useEffect(() => {
    shown.current = new Set(rows.map((row) => row.slug));
  });

  const hovered = rows.find((row) => row.slug === hover) ?? null;
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);
  const busy = pendingCategory != null;

  return (
    <div ref={root} className="on-dark relative flex h-full flex-col">
      {/* Heading and vehicle type */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-[46ch]">
          <h2 className="t-title text-[19px] text-paper md:text-[21px] xl:whitespace-nowrap">{t("title")}</h2>
          <p className="mt-1 max-w-[44ch] text-[13.5px] leading-snug text-paper/55">{t("subtitle")}</p>
        </div>
        <Segmented
          tone="dark"
          size="sm"
          label={t("categoryLabel")}
          value={pendingCategory ?? category}
          onChange={(value) => {
            setPlaying(false);
            setHover(null);
            selectCategory(value);
          }}
          options={categories.map((code) => ({
            value: code,
            label: tc(code),
            icon: <CategoryGlyph code={code} className="h-3.5 w-7" />,
          }))}
        />
      </div>

      {/* The month, set large, with step and play controls */}
      <div className="relative mt-4 flex items-end justify-between gap-4 border-b border-white/10 pb-2.5">
        <div className="relative h-[clamp(44px,5vw,80px)] min-w-0 overflow-hidden" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={period}
              initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
              transition={{ duration: 0.5, ease: tokens.easeOut }}
              className="t-display flex items-baseline gap-2 text-[clamp(44px,5vw,80px)] leading-none text-paper sm:gap-3"
            >
              <span className="tabular">{periodYear(period)}</span>
              <span className="text-[0.26em] font-semibold tracking-normal text-lime" style={{ fontVariationSettings: '"wdth" 100' }}>
                {fmtMonthName(period, locale)}
              </span>
            </motion.p>
          </AnimatePresence>
          <span className="sr-only">{fmtPeriod(period, locale)}</span>
        </div>
        <div className="mb-1 flex shrink-0 items-center gap-1 sm:gap-1.5">
          <StepButton label={t("previousMonth")} disabled={index <= 0} onClick={() => go(periods[index - 1])}>
            <CaretLeft size={15} weight="bold" />
          </StepButton>
          <StepButton label={t("nextMonth")} disabled={index >= periods.length - 1} onClick={() => go(periods[index + 1])}>
            <CaretRight size={15} weight="bold" />
          </StepButton>
          <button
            type="button"
            onClick={togglePlay}
            aria-pressed={playing}
            aria-label={playing ? t("pause") : t("play")}
            className="press group ml-0.5 inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-paper/8 pl-1 pr-1 sm:ml-1 sm:h-11 sm:pl-1.5 sm:pr-4 text-[13px] font-medium text-paper ring-1 ring-white/12 transition-colors hover:bg-paper/12"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-ink transition-transform duration-200 group-hover:scale-105">
              {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            </span>
            <span className="hidden sm:inline">{playing ? t("pause") : t("play")}</span>
          </button>
        </div>
      </div>

      {/* Ranking */}
      <div ref={list} className="relative mt-2 flex flex-1 flex-col" aria-busy={busy}>
        <ol
          className={`flex flex-1 flex-col transition-opacity duration-200 ${busy ? "opacity-50" : ""}`}
          aria-label={t("listLabel", { period: fmtPeriod(period, locale) })}
        >
          
            {rows.map((row, position) => {
              const isHover = hover === row.slug;
              const isSelected = selected.includes(row.slug);
              const active = isHover || isSelected;
              const dim = (hover != null || selected.length > 0) && !active;
              const accent = row.rank === 1 || active;
              const name = titleCaseBrand(row.name);
              const delay = entered ? 0 : 0.15 + position * STAGGER;
              return (
                <motion.li
                  key={row.slug}
                  data-slug={row.slug}
                  // Rows only move here; brands leaving the top list go at once and
                  // newcomers fade in (CSS). An exit fade could be interrupted by a
                  // fast scrub and leave a returning row invisible.
                  layout={reduce ? false : "position"}
                  transition={{ layout: { duration: tokens.rank, ease: tokens.easeOut } }}
                  className="flex min-h-[52px] flex-1 sm:max-h-[58px] sm:min-h-[42px]"
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={t("rowLabel", {
                      rank: row.rank,
                      brand: name,
                      value: fmtNumber(row.value, locale),
                      share: fmtPercent(row.share, locale),
                    })}
                    aria-describedby={isHover ? "race-tip" : undefined}
                    onClick={() => toggleBrand(row.slug)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setHover(row.slug);
                    }}
                    onPointerLeave={() => setHover((current) => (current === row.slug ? null : current))}
                    onFocus={(event) => {
                      if (event.currentTarget.matches(":focus-visible")) setHover(row.slug);
                    }}
                    onBlur={() => setHover((current) => (current === row.slug ? null : current))}
                    // Dimming and entrance live on the button, in CSS: motion owns the
                    // row's position and exit, and its opacity state does not survive
                    // React moving rows when the ranking changes.
                    style={!entered ? { ["--i" as string]: position } : undefined}
                    className={`${dim ? "opacity-[0.42]" : ""} ${!entered ? "race-enter" : fresh.has(row.slug) ? "race-in" : ""} group grid w-full cursor-pointer content-center grid-cols-[1.4rem_2rem_1fr_auto] items-center gap-x-2.5 gap-y-1.5 rounded-[10px] py-[5px] pl-1 pr-2 text-left transition-[background-color,opacity] duration-200 sm:grid-cols-[1.6rem_1.9rem_minmax(6rem,9rem)_1fr_4rem] sm:gap-x-3 sm:gap-y-0 sm:py-[4px] sm:pl-1.5 md:grid-cols-[1.9rem_2.15rem_minmax(7rem,10.5rem)_1fr_4.75rem] ${
                      isSelected ? "bg-white/[0.07] ring-1 ring-lime/35" : "hover:bg-white/[0.045]"
                    }`}
                  >
                    <span className={`tabular row-span-2 text-[12px] transition-colors sm:row-span-1 ${accent ? "text-lime" : "text-paper/40"}`} style={{ fontFamily: "var(--font-mono)" }}>
                      {String(row.rank).padStart(2, "0")}
                    </span>
                    <BrandLogo
                      slug={row.slug}
                      name={name}
                      className={`row-span-2 h-[30px] w-[30px] text-[10.5px] transition-[transform,color] duration-200 ease-out sm:row-span-1 group-hover:scale-[1.06] md:h-[34px] md:w-[34px] md:text-[11.5px] ${
                        active ? "scale-[1.06] text-paper" : "text-paper/85"
                      }`}
                    />
                    <span
                      className={`col-start-3 row-start-1 truncate text-[14.5px] transition-colors duration-200 md:text-[15.5px] ${active ? "font-semibold text-white" : "font-medium text-paper"}`}
                      style={{ fontVariationSettings: '"wdth" 104' }}
                    >
                      {name}
                    </span>
                    <span
                      data-bar
                      className="relative col-span-2 col-start-3 row-start-2 h-[8px] overflow-hidden rounded-r-[4px] bg-white/[0.035] sm:col-span-1 sm:col-start-4 sm:row-start-1 sm:h-[10px]"
                    >
                      <motion.span
                        className={`absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] transition-colors duration-200 ${
                          accent ? "bg-lime" : "bg-mist/65 group-hover:bg-mist"
                        }`}
                        initial={false}
                        animate={{ scaleX: revealed ? row.value / max : 0 }}
                        transition={{ duration: reduce ? 0 : 0.85, ease: tokens.easeOut, delay: reduce ? 0 : delay }}
                      />
                    </span>
                    <span className="col-start-4 row-start-1 text-right sm:col-start-5">
                      <AnimatedNumber value={row.value} format={format} reveal className="tabular text-[14px] font-semibold text-paper md:text-[15px]" />
                    </span>
                  </button>
                </motion.li>
              );
            })}
        </ol>
        {rows.length === 0 && <p className="py-10 text-[14px] text-paper/60">{t("noRanking")}</p>}

        <AnimatePresence>
          {hovered && tip && (
            <BrandTip
              key={hovered.slug}
              row={hovered}
              period={period}
              previousPeriod={previous ? previousPeriod : null}
              previous={previous?.find((entry) => entry.slug === hovered.slug) ?? null}
              selected={selected.includes(hovered.slug)}
              full={selected.length >= MAX_COMPARE}
              position={tip}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Comparison of picked brands, or how to use the ranking */}
      <div className="mt-2">
        {selected.length > 0 ? (
          <BrandDuel />
        ) : (
          <p className="flex min-h-[34px] items-center gap-2 text-[13px] text-paper/60">
            <CursorClick size={15} className="shrink-0 text-lime" aria-hidden="true" />
            {t("hint", { count: ranking.length, max: MAX_COMPARE })}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-3 border-t border-white/10 pt-4">
        {periods.length > DENSE ? (
          <TimeScrubber
            stops={periods}
            value={period}
            onChange={(value) => go(value)}
            label={t("timelineLabel")}
            formatValue={(stop) => fmtPeriod(stop, locale)}
            formatShort={(stop) => fmtPeriodShort(stop, locale)}
          />
        ) : (
          <CoverageTimeline
            tone="dark"
            locale={locale}
            stops={periods}
            value={period}
            onChange={(value) => go(value)}
            label={t("timelineLabel")}
            gapTitle={(from, to, distance) => t("gapTitle", { distance })}
            formatStop={(stop) => ({ top: fmtPeriodShort(stop, locale), bottom: "" })}
          />
        )}
        <p className="mt-3 flex items-center gap-2 text-[12px] text-paper/45">
          <span className="hatch inline-block h-2.5 w-6 shrink-0 rounded-[2px] text-paper/35" aria-hidden="true" />
          {periods.length > DENSE ? t("gapNoteDense", { count: periods.length }) : t("gapNote")}
        </p>
      </div>
    </div>
  );
}

type TipPosition = { top?: number; bottom?: number; left: number; above: boolean };

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-paper/75 sm:h-11 sm:w-11 ring-1 ring-white/12 transition-colors hover:bg-white/8 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Figures for the hovered or focused row. Only real values: no previous month, no comparison line. */
function BrandTip({
  row,
  period,
  previousPeriod,
  previous,
  selected,
  full,
  position,
}: {
  row: BrandRank;
  period: string;
  previousPeriod: string | null;
  previous: BrandRank | null;
  selected: boolean;
  full: boolean;
  position: TipPosition;
}) {
  const t = useTranslations("heroRace");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const name = titleCaseBrand(row.name);
  const change = previous ? ((row.value - previous.value) / previous.value) * 100 : null;
  return (
    <motion.div
      id="race-tip"
      role="tooltip"
      initial={reduce ? false : { opacity: 0, y: position.above ? 4 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.16, ease: tokens.easeOut }}
      className="pointer-events-none absolute z-20 w-[15.75rem] rounded-[10px] bg-paper px-3.5 pb-3 pt-3 text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]"
      style={{ top: position.top, bottom: position.bottom, left: position.left }}
    >
      <p className="flex items-center gap-2">
        <BrandLogo slug={row.slug} name={name} tone="light" className="h-6 w-6 text-[9px] text-ink" />
        <span className="font-semibold">{name}</span>
        <span className="ml-auto text-[12px] text-muted">{fmtPeriodShort(period, locale)}</span>
      </p>
      <dl className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-muted">{t("tipFirst")}</dt>
        <dd className="tabular text-right font-semibold">{fmtNumber(row.value, locale)}</dd>
        <dt className="text-muted">{t("tipShare")}</dt>
        <dd className="tabular text-right">{fmtPercent(row.share, locale)}</dd>
        <dt className="text-muted">{t("tipRank")}</dt>
        <dd className="tabular text-right">
          {row.rank}
          {previous && previous.rank !== row.rank && <span className="ml-1 text-muted">({t("tipWas", { rank: previous.rank })})</span>}
        </dd>
        {previousPeriod && (
          <>
            <dt className="text-muted">{fmtPeriodShort(previousPeriod, locale)}</dt>
            <dd className="tabular text-right">
              {previous ? (
                <>
                  {fmtNumber(previous.value, locale)}
                  {change != null && (
                    <span className="ml-1 text-muted">
                      ({change > 0 ? "+" : change < 0 ? "−" : "±"}
                      {fmtPercent(Math.abs(change), locale)})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted">{t("tipNotRanked")}</span>
              )}
            </dd>
          </>
        )}
      </dl>
      <p className="mt-2.5 border-t border-rule pt-2 text-[12px] text-muted">
        {selected ? t("tipRemove") : full ? t("tipFull", { max: MAX_COMPARE }) : t("tipPick")}
      </p>
    </motion.div>
  );
}
