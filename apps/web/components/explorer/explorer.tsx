"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useDashboard } from "../dashboard-context";
import { DatasetGlyph } from "../ui/glyphs";
import { Controls } from "./controls";
import { Registrations } from "./registrations";
import { Fleet } from "./fleet";
import { Inspections } from "./inspections";
import { motion as tokens } from "@/lib/design/tokens";

export function Explorer() {
  const t = useTranslations("explorer");
  const tt = useTranslations("tabs");
  const th = useTranslations("tabHints");
  const { query, view, pending, error, retry } = useDashboard();
  const te = useTranslations("explorer");
  const reduce = useReducedMotion();

  return (
    <section id="explorer" aria-labelledby="explorer-title" className="relative mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 md:pt-24 lg:px-12">
      <header className="grid gap-6 pb-8 md:pb-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h2 id="explorer-title" className="t-headline text-[clamp(2.4rem,5vw,4.2rem)]">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-graphite">{t("lede")}</p>
          <p className="mt-3 flex items-start gap-2 text-[13.5px] leading-snug text-muted md:hidden">
            <DatasetGlyph tab={query.tab} className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            {th(query.tab)}
          </p>
        </div>
        <dl className="hidden grid-cols-3 gap-4 border-t border-rule pt-4 md:grid lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {(["registreerimised", "soidukipark", "ulevaatused"] as const).map((tab) => (
            <div key={tab} className={`min-w-0 transition-opacity duration-300 ${query.tab === tab ? "opacity-100" : "opacity-55"}`}>
              <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <DatasetGlyph tab={tab} className="h-4 w-4 shrink-0" />
                <span className="truncate">{tt(tab)}</span>
              </dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-muted">{th(tab)}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Controls />

      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-ink px-4 py-3 text-[14px] text-paper">
          <span>{te("loadError")}</span>
          <button type="button" onClick={retry} className="press h-9 cursor-pointer rounded-full bg-lime px-4 font-medium text-ink">
            {te("retry")}
          </button>
        </div>
      )}

      <motion.div
        key={view.tab}
        id={`panel-${view.tab}`}
        role="tabpanel"
        aria-label={tt(view.tab)}
        aria-busy={pending}
        style={{ transitionDelay: pending ? "120ms" : "0ms" }}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: tokens.tab, ease: tokens.easeOut }}
        className={`pt-10 transition-opacity duration-300 md:pt-14 ${pending ? "pointer-events-none opacity-50" : "opacity-100"}`}
      >
        {view.tab === "registreerimised" && <Registrations />}
        {view.tab === "soidukipark" && <Fleet />}
        {view.tab === "ulevaatused" && <Inspections />}
      </motion.div>
    </section>
  );
}
