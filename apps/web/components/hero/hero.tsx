import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { BrandRace } from "./brand-race";
import { Blueprint } from "./blueprint";
import { Plate } from "../ui/plate";
import { fmtNumber, fmtPercent, fmtPeriod, fmtPeriodNumeric } from "@/lib/format";
import type { RegistrationPoint } from "@/lib/data/views";

/**
 * Split hero. Left: editorial statement and the latest verified month as one
 * composed figure (total, and how it splits into new and used). Right: the
 * interactive brand ranking on graphite.
 */
export async function Hero({ latest, span }: { latest: RegistrationPoint | null; span: [string, string] }) {
  const t = await getTranslations("hero");
  const locale = await getLocale();
  const first = latest?.first ?? null;
  const neu = latest?.neu ?? null;
  const used = latest?.used ?? null;
  const newPct = first && neu != null ? (neu / first) * 100 : null;
  const usedPct = first && used != null ? (used / first) * 100 : null;

  return (
    <section aria-labelledby="hero-title" className="relative border-b border-rule">
      <div className="grid lg:min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        {/* Editorial column */}
        <div className="relative isolate flex flex-col justify-between overflow-hidden px-4 pb-10 pt-10 sm:px-8 md:pt-12 lg:px-12 lg:pb-10 xl:px-16">
          <Blueprint className="pointer-events-none absolute -right-16 top-[200px] -z-10 hidden w-[420px] text-graphite/[0.2] md:block lg:top-[230px] lg:w-[min(30vw,460px)] xl:-right-6" />

          <div>
            <div className="enter-fade" style={{ ["--i" as string]: 0 }}>
              <Plate>{t("plate", { from: span[0], to: span[1] })}</Plate>
            </div>
            <h1
              id="hero-title"
              className="t-display enter-rise mt-6 text-[clamp(2.5rem,12.4vw,6rem)] text-ink lg:text-[clamp(3.4rem,5.7vw,6.8rem)]"
              style={{ ["--i" as string]: 1 }}
            >
              {(t.raw("headlineLines") as string[]).map((line, index) => (
                <span key={index} className="block whitespace-nowrap">
                  {line}
                  {" "}
                </span>
              ))}
            </h1>
            <p
              className="enter-rise mt-6 max-w-[44ch] text-[17px] leading-[1.55] text-graphite md:text-lg"
              style={{ ["--i" as string]: 2 }}
            >
              {t("lede")}
            </p>
          </div>

          <div className="mt-10 lg:mt-8">
            {/* The latest month as one composed figure */}
            <figure className="enter-rise max-w-[560px]" style={{ ["--i" as string]: 3 }}>
              <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13.5px] text-muted">
                <span>{t("leadLabel")}</span>
                <span className="tabular">{fmtPeriod(latest?.period, locale)}</span>
              </figcaption>
              <p className="t-figure mt-2 text-[clamp(3.4rem,6vw,5.2rem)] text-ink">{fmtNumber(first, locale)}</p>
              {first != null && neu != null && used != null && (
                <div className="mt-4">
                  <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={t("splitLabel", { neu: fmtNumber(neu, locale), used: fmtNumber(used, locale) })}>
                    <span className="h-full rounded-l-[4px] bg-ink" style={{ width: `${newPct}%` }} />
                    <span className="h-full rounded-r-[4px] bg-[#9FB0A8]" style={{ width: `${usedPct}%` }} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-4 text-[13.5px]">
                    <div>
                      <dt className="flex items-center gap-2 text-muted">
                        <span className="h-2 w-2 rounded-[2px] bg-ink" aria-hidden="true" />
                        {t("new")}
                      </dt>
                      <dd className="mt-0.5 text-ink">
                        <span className="tabular text-[17px] font-semibold">{fmtNumber(neu, locale)}</span>{" "}
                        <span className="text-muted">{fmtPercent(newPct, locale)}</span>
                      </dd>
                    </div>
                    <div className="text-right sm:text-left">
                      <dt className="flex items-center justify-end gap-2 text-muted sm:justify-start">
                        <span className="h-2 w-2 rounded-[2px] bg-[#9FB0A8]" aria-hidden="true" />
                        {t("used")}
                      </dt>
                      <dd className="mt-0.5 text-ink">
                        <span className="tabular text-[17px] font-semibold">{fmtNumber(used, locale)}</span>{" "}
                        <span className="text-muted">{fmtPercent(usedPct, locale)}</span>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </figure>

            <div className="enter-rise mt-8 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ ["--i" as string]: 4 }}>
              <a
                href="#explorer"
                className="press group inline-flex h-[52px] items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-[15px] font-medium text-paper transition-colors hover:bg-graphite"
              >
                {t("cta")}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-ink transition-transform duration-300 group-hover:translate-y-0.5">
                  <ArrowDown size={16} weight="bold" />
                </span>
              </a>
              <a
                href="#methodology"
                className="text-[15px] font-medium text-ink underline decoration-rule-strong decoration-2 underline-offset-[6px] transition-colors hover:decoration-ink"
              >
                {t("method")}
              </a>
            </div>
            <p className="t-meta enter-fade mt-6 text-muted" style={{ ["--i" as string]: 5 }}>
              {t("source", { period: fmtPeriodNumeric(latest?.period) })}
            </p>
          </div>
        </div>

        {/* Data column */}
        <div className="grid-dark relative overflow-hidden bg-ink px-4 pb-7 pt-8 text-paper sm:px-8 md:pt-10 lg:px-10 xl:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_100%_0%,rgba(213,240,139,0.07),transparent_55%)]"
            aria-hidden="true"
          />
          <div className="enter-fade relative h-full" style={{ ["--i" as string]: 2 }}>
            <BrandRace />
          </div>
        </div>
      </div>
    </section>
  );
}
