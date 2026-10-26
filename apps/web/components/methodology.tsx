import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./ui/reveal";
import { DatasetGlyph } from "./ui/glyphs";
import type { ExplorerData } from "@/lib/data/types";
import { fleetDatesOf, inspectionPeriodsOf, registrationPeriodsOf } from "@/lib/data/views";
import { fmtDate, fmtPeriodShort, toYearFraction } from "@/lib/format";

const START = 2005.5;
const END = 2027.2;
const pos = (value: string) => ((toYearFraction(value) - START) / (END - START)) * 100;
const monthOf = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;

/** Merge consecutive months into runs; isolated months stay single marks. */
function runs(stops: string[]) {
  const sorted = [...stops].sort();
  const out: Array<{ from: string; to: string; count: number }> = [];
  for (const stop of sorted) {
    const last = out[out.length - 1];
    if (last && monthOf(stop) - monthOf(last.to) <= 1) {
      last.to = stop;
      last.count += 1;
    } else out.push({ from: stop, to: stop, count: 1 });
  }
  return out;
}

/**
 * Methodology as a designed reference, not a footer dump: a coverage strip
 * showing exactly which months and snapshots exist, the definitions that
 * protect the numbers, and the official sources.
 */
export async function Methodology({ data, sources }: { data: ExplorerData; sources: Array<{ id: string; name: string; official_url: string; dataset_kind: string }> }) {
  const t = await getTranslations("method");
  const tt = await getTranslations("tabs");
  const locale = await getLocale();
  const rows = [
    { tab: "registreerimised", stops: registrationPeriodsOf(data), label: (s: string) => fmtPeriodShort(s, locale), shape: "dot" },
    { tab: "soidukipark", stops: fleetDatesOf(data), label: (s: string) => fmtDate(s, locale), shape: "diamond" },
    { tab: "ulevaatused", stops: inspectionPeriodsOf(data), label: (s: string) => fmtPeriodShort(s, locale), shape: "dot" },
  ];
  const years = [2006, 2010, 2014, 2018, 2022, 2026];
  const principles = ["flows", "newUsed", "yearColumns", "repeat", "register", "missing", "shares"] as const;

  return (
    <section id="methodology" aria-labelledby="method-title" className="mx-auto max-w-[1600px] px-4 py-20 sm:px-8 md:py-28 lg:px-12">
      <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <h2 id="method-title" className="t-headline text-[clamp(2.4rem,5vw,4.2rem)] lg:col-span-7">
          {t("title")}
        </h2>
        <p className="max-w-[48ch] text-[16px] leading-relaxed text-graphite lg:col-span-5">{t("lede")}</p>
      </Reveal>

      {/* Coverage strip */}
      <Reveal className="mt-14 border-t border-ink pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="t-title text-[19px]">{t("coverageTitle")}</h3>
          <p className="text-[13px] text-muted">{t("coverageHint")}</p>
        </div>
        <div className="mt-8 overflow-x-auto pb-2">
          <div className="min-w-[640px]">
            {rows.map((row) => (
              <div key={row.tab} className="grid grid-cols-[10.5rem_1fr_5rem] items-center gap-4 border-b border-rule py-4 last:border-b-0">
                <p className="flex items-center gap-2 text-[14px] font-medium">
                  <DatasetGlyph tab={row.tab} className="h-4 w-4 shrink-0" />
                  {tt(row.tab)}
                </p>
                <div className="relative h-8">
                  <span className="hatch absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-[2px] text-graphite/20" aria-hidden="true" />
                  {runs(row.stops).map((run) =>
                    run.count === 1 ? (
                      <span
                        key={run.from}
                        title={row.label(run.from)}
                        className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${pos(run.from)}%` }}
                      >
                        <span
                          className={`block h-3.5 w-3.5 bg-ink ring-[3px] ring-paper ${row.shape === "diamond" ? "rotate-45 rounded-[2px]" : "rounded-full"}`}
                        />
                        <span className="sr-only">{row.label(run.from)}</span>
                      </span>
                    ) : (
                      <span
                        key={run.from}
                        title={`${row.label(run.from)} – ${row.label(run.to)}`}
                        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[3px] bg-ink ring-[3px] ring-paper"
                        style={{ left: `${pos(run.from)}%`, width: `max(0.75rem, ${pos(run.to) - pos(run.from)}%)` }}
                      >
                        <span className="sr-only">{`${row.label(run.from)} – ${row.label(run.to)}`}</span>
                      </span>
                    ),
                  )}
                </div>
                <p className="tabular text-right text-[13px] text-muted">{t(`count.${row.tab}`, { count: row.stops.length })}</p>
              </div>
            ))}
            <div className="grid grid-cols-[10.5rem_1fr_5rem] gap-4 pt-2">
              <span />
              <div className="relative h-5">
                {years.map((year) => (
                  <span key={year} className="tabular absolute -translate-x-1/2 text-[11.5px] text-muted" style={{ left: `${pos(`${year}-01`)}%` }}>
                    {year}
                  </span>
                ))}
              </div>
              <span />
            </div>
          </div>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-muted">
          <span className="flex items-center gap-2">
            <span className="block h-2.5 w-2.5 rounded-full bg-ink" aria-hidden="true" />
            {t("legendMonth")}
          </span>
          <span className="flex items-center gap-2">
            <span className="block h-2.5 w-2.5 rotate-45 rounded-[1px] bg-ink" aria-hidden="true" />
            {t("legendSnapshot")}
          </span>
          <span className="flex items-center gap-2">
            <span className="hatch block h-2.5 w-6 rounded-[2px] text-graphite/40" aria-hidden="true" />
            {t("legendGap")}
          </span>
        </p>
      </Reveal>

      <div className="mt-20 grid gap-14 lg:grid-cols-12 lg:gap-12">
        {/* Principles */}
        <Reveal className="min-w-0 lg:col-span-7">
          <h3 className="t-title border-t border-ink pt-5 text-[19px]">{t("principlesTitle")}</h3>
          <div className="mt-2">
            {principles.map((key) => (
              <details key={key} className="group border-b border-rule">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="t-title text-[16.5px]">{t(`p.${key}.title`)}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-rule-strong transition-transform duration-300 group-open:rotate-45 group-open:bg-ink group-open:text-paper group-open:ring-ink">
                    <Plus size={13} weight="bold" />
                  </span>
                </summary>
                <p className="max-w-[64ch] pb-5 text-[15px] leading-relaxed text-graphite">{t(`p.${key}.body`)}</p>
              </details>
            ))}
          </div>
        </Reveal>

        {/* Sources and independence */}
        <Reveal className="min-w-0 lg:col-span-5" delay={100}>
          <h3 className="t-title border-t border-ink pt-5 text-[19px]">{t("sourcesTitle")}</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.official_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-4 rounded-[14px] bg-paper-2 p-4 ring-1 ring-rule transition-colors hover:bg-paper hover:ring-ink/40"
                >
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-muted">{t.has(`kind.${source.dataset_kind}`) ? t(`kind.${source.dataset_kind}`) : source.dataset_kind}</span>
                    <span className="mt-0.5 block text-[15px] font-medium text-ink">{source.name}</span>
                    <span className="t-meta mt-1 block truncate text-muted">{source.official_url.replace(/^https:\/\//, "")}</span>
                  </span>
                  <ArrowUpRight size={16} weight="bold" className="mt-1 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-[14px] bg-ink p-5 text-paper">
            <p className="flex items-center gap-2 text-[13px] text-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
              {t("independentLabel")}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-paper/85">{data.disclaimer[locale === "en" ? "en" : "et"]}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-paper/55">{t("licence")}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
