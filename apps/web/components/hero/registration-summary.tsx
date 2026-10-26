"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { useDashboard } from "../dashboard-context";
import { AnimatedNumber } from "../ui/animated-number";
import { useHero } from "./hero-state";
import { shiftPeriod } from "@/lib/data/pages";
import { registrationSeries } from "@/lib/data/views";
import { motion as tokens } from "@/lib/design/tokens";
import { fmtNumber, fmtPercent, fmtPeriod, fmtPeriodNumeric } from "@/lib/format";

/**
 * The selected month as one composed figure: first registrations of the
 * selected vehicle type, how they split into new and used, and the same month
 * a year earlier when it exists. Follows the hero's month and vehicle type.
 */
export function RegistrationSummary() {
  const { data } = useDashboard();
  const { category, period } = useHero();
  const t = useTranslations("hero");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const format = useCallback((value: number) => fmtNumber(value, locale), [locale]);

  const series = registrationSeries(data, category);
  const point = series.find((entry) => entry.period === period) ?? null;
  const yearAgo = series.find((entry) => entry.period === shiftPeriod(period, -12))?.first ?? null;
  const first = point?.first ?? null;
  const neu = point?.neu ?? null;
  const used = point?.used ?? null;
  const newShare = first && neu != null ? (neu / first) * 100 : null;
  const usedShare = first && used != null ? (used / first) * 100 : null;
  const change = first != null && yearAgo ? ((first - yearAgo) / yearAgo) * 100 : null;
  const transition = { duration: reduce ? 0 : tokens.chart, ease: tokens.easeOut };

  return (
    <figure aria-live="polite">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13.5px] text-muted">
        <span>{t(`summaryLabel.${category === "truck" ? "truck" : "passenger_car"}`)}</span>
        <span className="tabular text-graphite">{fmtPeriod(period, locale)}</span>
      </figcaption>

      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="t-figure text-[clamp(3rem,4.6vw,4.3rem)] text-ink">
          <AnimatedNumber value={first} format={format} reveal className="tabular" />
        </p>
        {yearAgo != null && (
          <p className="pb-2 text-[13.5px] leading-snug text-muted sm:text-right">
            {t("yearAgo")} <span className="tabular font-medium text-graphite">{fmtNumber(yearAgo, locale)}</span>
            {change != null && (
              <span className="tabular ml-2 font-medium text-ink">
                {change > 0 ? "+" : change < 0 ? "−" : "±"}
                {fmtPercent(Math.abs(change), locale)}
              </span>
            )}
          </p>
        )}
      </div>

      {newShare != null && usedShare != null && neu != null && used != null && (
        <div className="mt-3">
          <div
            role="img"
            aria-label={t("splitLabel", { neu: fmtNumber(neu, locale), used: fmtNumber(used, locale) })}
            className="relative h-3.5 overflow-hidden rounded-[4px] bg-[#9FB0A8]"
          >
            <motion.span
              className="absolute inset-0 rounded-l-[4px] bg-lime shadow-[2px_0_0_var(--color-paper),inset_0_0_0_1px_rgb(24_29_29/0.14)]"
              initial={false}
              animate={{ x: `${newShare - 100}%` }}
              transition={transition}
            />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-[13.5px]">
            <div>
              <dt className="flex items-center gap-2 text-muted">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-lime ring-1 ring-ink/20" aria-hidden="true" />
                {t("new")}
              </dt>
              <dd className="mt-0.5 text-ink">
                <AnimatedNumber value={neu} format={format} className="tabular text-[18px] font-semibold" />{" "}
                <span className="tabular text-muted">{fmtPercent(newShare, locale)}</span>
              </dd>
            </div>
            <div className="text-right sm:text-left">
              <dt className="flex items-center justify-end gap-2 text-muted sm:justify-start">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[#9FB0A8]" aria-hidden="true" />
                {t("used")}
              </dt>
              <dd className="mt-0.5 text-ink">
                <AnimatedNumber value={used} format={format} className="tabular text-[18px] font-semibold" />{" "}
                <span className="tabular text-muted">{fmtPercent(usedShare, locale)}</span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </figure>
  );
}

/** Source line for the selected month: the leaflet the figures come from. */
export function HeroSource({ className = "" }: { className?: string }) {
  const { period } = useHero();
  const t = useTranslations("hero");
  return <p className={className}>{t("source", { period: fmtPeriodNumeric(period) })}</p>;
}
