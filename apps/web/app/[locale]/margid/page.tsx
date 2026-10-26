import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/pages/page-shell";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Breadcrumbs, PageIntro, Section, SourceNote, fmtChange } from "@/components/pages/parts";
import { loadBundle } from "@/lib/data/load";
import { brandSummaries, latestPeriod, monthPeriods, shiftPeriod } from "@/lib/data/pages";
import { fmtNumber, fmtPeriod, fmtPeriodShort } from "@/lib/format";
import { ogImagePath, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.brandIndex" });
  const bundle = await loadBundle();
  return pageMetadata({
    locale,
    path: "/margid",
    title: t("metaTitle"),
    description: t("metaDescription", { count: brandSummaries(bundle).length, period: fmtPeriod(latestPeriod(bundle), locale) }),
    image: ogImagePath(locale, "site", "margid"),
  });
}

export default async function BrandIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.brandIndex");
  const tp = await getTranslations("pages");
  const bundle = await loadBundle();
  const latest = latestPeriod(bundle);
  const brands = brandSummaries(bundle);
  const cars = brands
    .filter((brand) => brand.last12 != null || brand.carRank != null)
    .sort((a, b) => (b.last12 ?? -1) - (a.last12 ?? -1) || (a.carRank ?? 99) - (b.carRank ?? 99) || a.name.localeCompare(b.name));
  const trucks = brands.filter((brand) => brand.truckRank != null).sort((a, b) => (a.truckRank ?? 99) - (b.truckRank ?? 99));
  const truckOnly = brands.filter((brand) => brand.truckRank == null && brand.last12 == null && brand.carRank == null);

  return (
    <PageShell>
      <Breadcrumbs locale={locale} items={[{ label: tp("brandsNav") }]} />
      <PageIntro
        plate={t("plate")}
        title={t("title")}
        lede={t("lede", { from: fmtPeriodShort(monthPeriods(bundle)[0], locale), to: fmtPeriodShort(latest, locale) })}
      />

      <Section
        id="cars"
        title={t("carsTitle")}
        note={t("carsNote", {
          from: fmtPeriodShort(shiftPeriod(latest, -11), locale),
          to: fmtPeriodShort(latest, locale),
          period: fmtPeriod(latest, locale),
        })}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[14.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[13px] text-muted">
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t("brand")}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-normal">
                  {t("last12")}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-normal">
                  {t("prev12")}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-normal">
                  {tp("change")}
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-normal">
                  {t("rank", { period: fmtPeriodShort(latest, locale) })}
                </th>
              </tr>
            </thead>
            <tbody>
              {cars.map((brand) => (
                <tr key={brand.slug} className="border-b border-rule">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    <span className="flex items-center gap-3">
                      <BrandLogo slug={brand.slug} name={brand.name} tone="light" className="h-8 w-8 text-[10.5px] text-ink" />
                      <Link href={`/margid/${brand.slug}`} className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                        {brand.name}
                      </Link>
                    </span>
                  </th>
                  <td className="tabular py-2.5 pl-4 text-right font-medium">{fmtNumber(brand.last12, locale)}</td>
                  <td className="tabular py-2.5 pl-4 text-right text-muted">{fmtNumber(brand.prev12, locale)}</td>
                  <td className="tabular py-2.5 pl-4 text-right text-muted">{fmtChange(brand.last12, brand.prev12, locale) ?? "—"}</td>
                  <td className="tabular py-2.5 pl-4 text-right">{brand.carRank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {trucks.length > 0 && (
        <Section id="trucks" title={t("trucksTitle")} note={t("trucksNote", { period: fmtPeriod(latest, locale) })}>
          <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...trucks, ...truckOnly].map((brand) => (
              <li key={brand.slug} className="flex items-center justify-between border-b border-rule py-2 text-[15px]">
                <span className="flex items-center gap-3">
                  <BrandLogo slug={brand.slug} name={brand.name} tone="light" className="h-8 w-8 text-[10.5px] text-ink" />
                  <Link href={`/margid/${brand.slug}`} className="font-medium underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                    {brand.name}
                  </Link>
                </span>
                <span className="t-meta tabular text-muted">{brand.truckRank != null ? `#${brand.truckRank}` : ""}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <SourceNote />
    </PageShell>
  );
}
