import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/pages/page-shell";
import {
  Breadcrumbs,
  ButtonLink,
  PageIntro,
  RankedBars,
  Section,
  SourceNote,
  Stat,
  StatGrid,
  fmtChange,
  pageX,
} from "@/components/pages/parts";
import { loadBundle } from "@/lib/data/load";
import { BREAKDOWN_LABELS, FUEL_LABELS, UNKNOWN_LABEL, localizedLabel } from "@/lib/data/labels";
import { brandSlugs, monthDetail, monthPeriods, type MonthDetail } from "@/lib/data/pages";
import { fmtNumber, fmtPercent, fmtPeriod } from "@/lib/format";
import { ogImagePath, pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

type Params = { locale: string; period: string };

export async function generateStaticParams(): Promise<Array<{ period: string }>> {
  return monthPeriods(await loadBundle()).map((period) => ({ period }));
}

async function load(period: string): Promise<MonthDetail> {
  const detail = monthDetail(await loadBundle(), period);
  if (!detail) notFound();
  return detail;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, period } = await params;
  const d = await load(period);
  const t = await getTranslations({ locale, namespace: "pages.month" });
  const label = fmtPeriod(period, locale);
  const cars = d.categories.find((row) => row.code === "passenger_car");
  let title = t("metaTitleFallback", { period: label });
  let description = t("descriptionFallback", { period: label });
  if (cars?.first != null) {
    title = t("metaTitle", { period: label, count: fmtNumber(cars.first, locale) });
    description =
      (cars.neu != null
        ? t("description", {
            period: label,
            first: fmtNumber(cars.first, locale),
            neu: fmtNumber(cars.neu, locale),
            share: fmtPercent((cars.neu / cars.first) * 100, locale),
          })
        : t("descriptionFallback", { period: label })) +
      (cars.firstYearAgo != null
        ? t("descriptionYoy", { prev: fmtNumber(cars.firstYearAgo, locale), change: fmtChange(cars.first, cars.firstYearAgo, locale) ?? "—" })
        : "") +
      t("descriptionTail");
  }
  return pageMetadata({ locale, path: `/kuu/${period}`, title, description, image: ogImagePath(locale, "month", period) });
}

export default async function MonthPage({ params }: { params: Promise<Params> }) {
  const { locale, period } = await params;
  setRequestLocale(locale);
  const d = await load(period);
  const t = await getTranslations("pages.month");
  const tp = await getTranslations("pages");
  const tc = await getTranslations("categories");
  const pages = new Set(brandSlugs(await loadBundle()));
  const linkFor = (slug: string) => (pages.has(slug) ? `/margid/${slug}` : null);
  const label = fmtPeriod(period, locale);
  const cars = d.categories.find((row) => row.code === "passenger_car");
  const yoy = (value: number | null | undefined, previous: number | null | undefined) =>
    previous != null ? t("vsYearAgo", { value: fmtNumber(previous, locale), change: fmtChange(value, previous, locale) ?? "—" }) : undefined;

  return (
    <PageShell>
      <Breadcrumbs
        locale={locale}
        items={[{ label: tp("monthsNav"), href: "/kuu" }, { label: period.slice(0, 4), href: `/kuu#y${period.slice(0, 4)}` }, { label }]}
      />
      <PageIntro plate={t("plate")} title={t("title", { period: label })} lede={t("typesNote")}>
        <MonthNav d={d} locale={locale} labels={{ prev: t("prev"), next: t("next") }} />
      </PageIntro>

      {cars && (
        <StatGrid>
          <Stat label={t("statFirst")} value={fmtNumber(cars.first, locale)} sub={yoy(cars.first, cars.firstYearAgo)} />
          {cars.neu != null && (
            <Stat
              label={t("statNew")}
              value={fmtNumber(cars.neu, locale)}
              sub={cars.first ? t("shareOf", { share: fmtPercent((cars.neu / cars.first) * 100, locale) }) : undefined}
            />
          )}
          {cars.used != null && (
            <Stat
              label={t("statUsed")}
              value={fmtNumber(cars.used, locale)}
              sub={cars.first ? t("shareOf", { share: fmtPercent((cars.used / cars.first) * 100, locale) }) : undefined}
            />
          )}
        </StatGrid>
      )}

      <Section id="types" title={t("typesTitle")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[14.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[13px] text-muted">
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t("type")}
                </th>
                {[t("first"), t("neu"), t("used"), tp("yearAgo"), tp("change")].map((heading) => (
                  <th key={heading} scope="col" className="py-2 pl-4 text-right font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.categories.map((row) => (
                <tr key={row.code} className="border-b border-rule">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {tc(row.code)}
                  </th>
                  <td className="tabular py-2 pl-4 text-right font-medium">{fmtNumber(row.first, locale)}</td>
                  <td className="tabular py-2 pl-4 text-right">{fmtNumber(row.neu, locale)}</td>
                  <td className="tabular py-2 pl-4 text-right">{fmtNumber(row.used, locale)}</td>
                  <td className="tabular py-2 pl-4 text-right text-muted">{fmtNumber(row.firstYearAgo, locale)}</td>
                  <td className="tabular py-2 pl-4 text-right text-muted">{fmtChange(row.first, row.firstYearAgo, locale) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="brands" title={t("carBrandsTitle")} note={t("carBrandsNote")}>
        {d.carBrands.length ? (
          <RankedBars
            locale={locale}
            linkFor={linkFor}
            logos
            valueLabel={t("count")}
            rows={d.carBrands.map((row) => ({ key: row.slug, rank: row.rank, name: row.name, value: row.value, share: row.share, slug: row.slug }))}
          />
        ) : (
          <p className="text-[15px] text-muted">{t("noRanking")}</p>
        )}
      </Section>

      {d.modelBrands && (
        <Section id="new-brands" title={t("newBrandsTitle")} note={t("newBrandsNote")}>
          <RankedBars
            locale={locale}
            linkFor={linkFor}
            logos
            valueLabel={t("count")}
            rows={d.modelBrands.map((row, index) => ({
              key: row.slug,
              rank: index + 1,
              name: row.name,
              value: row.value,
              share: row.share,
              slug: row.slug,
            }))}
          />
        </Section>
      )}

      <Section id="models" title={t("modelsTitle")} note={d.models ? t("modelsNote") : undefined}>
        {d.models ? (
          <RankedBars
            locale={locale}
            linkFor={linkFor}
            logos
            valueLabel={t("count")}
            rows={d.models.map((row, index) => ({
              key: `${row.slug}|${row.model}`,
              rank: index + 1,
              name: row.brand,
              detail: row.model,
              value: row.value,
              slug: row.slug,
            }))}
          />
        ) : (
          <p className="max-w-[72ch] text-[15px] text-muted">{t("modelsUnavailable")}</p>
        )}
      </Section>

      {d.fuels.length > 0 && (
        <Section id="fuels" title={t("fuelsTitle")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-ink text-left text-[13px] text-muted">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("fuel")}
                  </th>
                  <th scope="col" className="py-2 pl-4 text-right font-normal">
                    {t("first")}
                  </th>
                  <th scope="col" className="py-2 pl-4 text-right font-normal">
                    {t("neu")}
                  </th>
                  <th scope="col" className="py-2 pl-4 text-right font-normal">
                    {t("share")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.fuels.map((row) => (
                  <tr key={row.code} className="border-b border-rule">
                    <th scope="row" className="py-2 pr-4 text-left font-medium">
                      {localizedLabel(FUEL_LABELS, row.code, locale, row.source)}
                    </th>
                    <td className="tabular py-2 pl-4 text-right font-medium">{fmtNumber(row.first, locale)}</td>
                    <td className="tabular py-2 pl-4 text-right">{fmtNumber(row.neu, locale)}</td>
                    <td className="tabular py-2 pl-4 text-right text-muted">
                      {row.first != null && cars?.first ? fmtPercent((row.first / cars.first) * 100, locale) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {d.newCarSplits.length > 0 && (
        <Section id="new-cars" title={t("splitTitle")} note={t("splitNote")}>
          <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
            {d.newCarSplits.map((split) => (
              <div key={split.dimension} className="min-w-0">
                <h3 className="t-title mb-3 text-[17px]">{t(`split.${split.dimension}`)}</h3>
                <RankedBars
                  locale={locale}
                  valueLabel={t("neu")}
                  rows={split.rows.map((row) => ({
                    key: row.code,
                    name:
                      row.code === "unknown"
                        ? UNKNOWN_LABEL[locale === "en" ? "en" : "et"]
                        : localizedLabel(BREAKDOWN_LABELS[split.dimension] ?? {}, row.code, locale, row.code.replace(/_/g, " ")),
                    value: row.value,
                    share: row.share,
                  }))}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.truckBrands.length > 0 && (
        <Section id="trucks" title={t("truckBrandsTitle")}>
          <RankedBars
            locale={locale}
            linkFor={linkFor}
            logos
            valueLabel={t("count")}
            rows={d.truckBrands.map((row) => ({ key: row.slug, rank: row.rank, name: row.name, value: row.value, share: row.share, slug: row.slug }))}
          />
        </Section>
      )}

      <div className={`${pageX} flex flex-wrap gap-3 py-10`}>
        <ButtonLink href={`/?tab=registreerimised&to=${period}#explorer`}>
          {tp("openExplorer")} <ArrowRight size={16} aria-hidden />
        </ButtonLink>
        {d.yearAgo && (
          <ButtonLink href={`/kuu/${d.yearAgo}`} tone="light">
            {t("sameMonthLastYear")}: {fmtPeriod(d.yearAgo, locale)}
          </ButtonLink>
        )}
        <ButtonLink href="/kuu" tone="light">
          {t("allMonths")}
        </ButtonLink>
      </div>

      <SourceNote />
    </PageShell>
  );
}

function MonthNav({ d, locale, labels }: { d: MonthDetail; locale: string; labels: { prev: string; next: string } }) {
  return (
    <nav className="mt-8 flex flex-wrap gap-3 text-[14.5px]" aria-label={`${labels.prev} / ${labels.next}`}>
      {d.prev && (
        <Link
          href={`/kuu/${d.prev}`}
          rel="prev"
          className="press inline-flex h-10 items-center gap-2 rounded-full bg-paper-2 px-4 font-medium ring-1 ring-rule-strong transition-colors hover:bg-paper-3"
        >
          <ArrowLeft size={15} aria-hidden />
          <span className="sr-only">{labels.prev}: </span>
          {fmtPeriod(d.prev, locale)}
        </Link>
      )}
      {d.next && (
        <Link
          href={`/kuu/${d.next}`}
          rel="next"
          className="press inline-flex h-10 items-center gap-2 rounded-full bg-paper-2 px-4 font-medium ring-1 ring-rule-strong transition-colors hover:bg-paper-3"
        >
          <span className="sr-only">{labels.next}: </span>
          {fmtPeriod(d.next, locale)}
          <ArrowRight size={15} aria-hidden />
        </Link>
      )}
    </nav>
  );
}
