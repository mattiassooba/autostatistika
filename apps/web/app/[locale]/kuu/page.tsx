import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/pages/page-shell";
import { Breadcrumbs, PageIntro, Section, SourceNote } from "@/components/pages/parts";
import { loadBundle } from "@/lib/data/load";
import { monthIndex, monthPeriods } from "@/lib/data/pages";
import { fmtMonthName, fmtNumber, fmtPeriodShort } from "@/lib/format";
import { ogImagePath, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.monthIndex" });
  const periods = monthPeriods(await loadBundle());
  const from = fmtPeriodShort(periods[0], locale);
  return pageMetadata({
    locale,
    path: "/kuu",
    title: t("metaTitle", { from: periods[0].slice(0, 4), to: periods[periods.length - 1].slice(0, 4) }),
    description: t("metaDescription", { from }),
    image: ogImagePath(locale, "site", "kuu"),
  });
}

export default async function MonthIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.monthIndex");
  const tp = await getTranslations("pages");
  const bundle = await loadBundle();
  const periods = monthPeriods(bundle);
  const years = monthIndex(bundle);

  return (
    <PageShell>
      <Breadcrumbs locale={locale} items={[{ label: tp("monthsNav") }]} />
      <PageIntro
        plate={t("plate")}
        title={t("title")}
        lede={t("lede", { from: fmtPeriodShort(periods[0], locale), to: fmtPeriodShort(periods[periods.length - 1], locale) })}
      />
      <Section id="years" title={t("yearTotal")}>
        <ol className="divide-y divide-rule border-b border-rule">
          {years.map((year) => {
            const have = new Set(year.months);
            return (
              <li key={year.year} id={`y${year.year}`} className="grid gap-3 py-4 md:grid-cols-[6rem_minmax(0,1fr)_10rem] md:items-center">
                <h3 className="t-title tabular text-[22px]">{year.year}</h3>
                <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
                  {Array.from({ length: 12 }, (_, i) => `${year.year}-${String(i + 1).padStart(2, "0")}`).map((period) => (
                    <li key={period}>
                      {have.has(period) ? (
                        <Link
                          href={`/kuu/${period}`}
                          className="press flex h-9 items-center justify-center rounded-[6px] bg-paper-2 text-[13.5px] font-medium ring-1 ring-rule transition-colors hover:bg-lime hover:ring-ink/40"
                        >
                          {fmtMonthName(period, locale).slice(0, 3)}
                        </Link>
                      ) : (
                        <span className="hatch flex h-9 items-center justify-center rounded-[6px] text-[13.5px] text-mist" aria-hidden>
                          {fmtMonthName(period, locale).slice(0, 3)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="tabular text-right text-[15px] font-medium md:text-[17px]">
                  {year.carsFirst != null ? fmtNumber(year.carsFirst, locale) : <span className="text-[13px] font-normal text-muted">{t("partialYear")}</span>}
                </p>
              </li>
            );
          })}
        </ol>
      </Section>
      <SourceNote />
    </PageShell>
  );
}
