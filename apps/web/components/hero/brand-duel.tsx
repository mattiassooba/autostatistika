"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { ArrowRight, ArrowUpRight, X } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { useDashboard } from "../dashboard-context";
import { BrandLogo } from "../ui/brand-logo";
import { useHero } from "./hero-state";
import { brandHistory } from "@/lib/data/views";
import { motion as tokens, series } from "@/lib/design/tokens";
import { fmtNumber, fmtPercent, fmtPeriodShort, titleCaseBrand } from "@/lib/format";

const WINDOW = 36;
const W = 600;
const H = 112;
// Line patterns keep the brands apart without relying on colour.
const DASHES = ["", "7 5", "2 4", "10 4 2 4"];

/**
 * Picked brands side by side: a small line chart of their first registrations
 * over the 36 ranked months up to the selected one (breaks where a brand was
 * outside the source's top list), and the selected month's figures.
 */
export function BrandDuel() {
  const { data, update } = useDashboard();
  const { category, period, periods, selected, clearBrands, toggleBrand, brandPages } = useHero();
  const t = useTranslations("heroRace");
  const locale = useLocale();
  const reduce = useReducedMotion();

  const end = periods.indexOf(period);
  const months = periods.slice(Math.max(0, end - WINDOW + 1), end + 1);
  const histories = useMemo(() => brandHistory(data, category, selected), [data, category, selected]);
  const inWindow = histories.map((history) => ({
    ...history,
    points: history.points.filter((point) => months.includes(point.period)),
    now: history.points.find((point) => point.period === period) ?? null,
  }));
  const max = Math.max(1, ...inWindow.flatMap((history) => history.points.map((point) => point.value ?? 0)));
  const x = (index: number) => (months.length > 1 ? (index / (months.length - 1)) * W : W / 2);
  const y = (value: number) => H - 6 - (value / max) * (H - 14);

  function line(points: Array<{ value: number | null }>): string {
    let d = "";
    let open = false;
    points.forEach((point, index) => {
      if (point.value == null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`;
      open = true;
    });
    return d;
  }

  function compare() {
    update({ tab: "registreerimised", category, to: period, brands: selected }, { scrollTo: "compare" });
  }

  return (
    <motion.section
      aria-labelledby="duel-title"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: tokens.easeOut }}
      className="rounded-[12px] bg-white/[0.035] p-4 ring-1 ring-white/10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="duel-title" className="t-title text-[16px] text-paper">
          {selected.length > 1 ? t("duelTitle") : t("pickedTitle")}
        </h3>
        <p className="text-[12.5px] text-paper/50">
          {t("duelRange", { from: fmtPeriodShort(months[0], locale), to: fmtPeriodShort(period, locale) })}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[96px] w-full" role="img" aria-label={t("duelChart")}>
        <path d={`M0 ${H - 6}H${W}`} stroke="currentColor" className="text-white/15" vectorEffect="non-scaling-stroke" />
        {inWindow.map((history, index) => (
          <motion.path
            key={history.slug}
            d={line(history.points)}
            fill="none"
            stroke={series.dark[index % series.dark.length]}
            strokeWidth="2"
            strokeDasharray={DASHES[index % DASHES.length] || undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        ))}
      </svg>

      <ul className="mt-3 divide-y divide-white/8">
        {inWindow.map((history, index) => {
          const name = titleCaseBrand(history.name);
          return (
            <li key={history.slug} className="flex items-center gap-3 py-2 text-[13.5px]">
              <svg viewBox="0 0 24 8" className="h-2 w-6 shrink-0" aria-hidden="true">
                <path
                  d="M1 4H23"
                  stroke={series.dark[index % series.dark.length]}
                  strokeWidth="2.5"
                  strokeDasharray={DASHES[index % DASHES.length] ? DASHES[index % DASHES.length].replace(/\d+/g, (n) => String(Math.max(1, +n / 2))) : undefined}
                  strokeLinecap="round"
                />
              </svg>
              <BrandLogo slug={history.slug} name={name} className="h-6 w-6 text-[9px] text-paper/90" />
              <span className="min-w-0 flex-1 truncate font-medium text-paper">
                {brandPages.has(history.slug) ? (
                  <Link
                    href={`/margid/${history.slug}`}
                    className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-4 hover:decoration-lime"
                  >
                    {name}
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </Link>
                ) : (
                  name
                )}
              </span>
              {history.now?.value != null ? (
                <span className="tabular text-right text-paper/70">
                  <span className="font-semibold text-paper">{fmtNumber(history.now.value, locale)}</span>{" "}
                  {fmtPercent(history.now.share, locale)} · #{history.now.rank}
                </span>
              ) : (
                <span className="text-right text-paper/45">{t("notRankedThisMonth")}</span>
              )}
              <button
                type="button"
                onClick={() => toggleBrand(history.slug)}
                aria-label={t("removeBrand", { brand: name })}
                className="press -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-paper/50 transition-colors hover:bg-white/8 hover:text-paper"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={compare}
          className="press group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-lime pl-4 pr-3 text-[13.5px] font-semibold text-ink transition-colors hover:bg-[#e1f6a6]"
        >
          {t("compareHistory")}
          <ArrowRight size={14} weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={clearBrands}
          className="press inline-flex h-10 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium text-paper/60 transition-colors hover:bg-white/6 hover:text-paper"
        >
          {t("clearBrands")}
        </button>
      </div>
    </motion.section>
  );
}
