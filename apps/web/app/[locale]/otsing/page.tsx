import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/pages/page-shell";
import { Breadcrumbs, PageIntro, pageX } from "@/components/pages/parts";
import { SearchApp } from "@/components/search/search-app";
import { loadBundle } from "@/lib/data/load";
import { fmtDate, fmtNumber } from "@/lib/format";
import { ogImagePath, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  const index = (await loadBundle()).registerIndex;
  return pageMetadata({
    locale,
    path: "/otsing",
    title: t("metaTitle"),
    description: index ? t("metaDescription", { count: fmtNumber(index.vehicles, locale), date: fmtDate(index.snapshot, locale) }) : t("title"),
    image: ogImagePath(locale, "site", "home"),
  });
}

export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const tn = await getTranslations("nav");
  const index = (await loadBundle()).registerIndex;

  return (
    <PageShell>
      <Breadcrumbs locale={locale} items={[{ label: tn("search") }]} />
      <PageIntro
        plate={t("plate")}
        title={t("title")}
        lede={index ? t("lede", { date: fmtDate(index.snapshot, locale), count: fmtNumber(index.vehicles, locale) }) : t("unavailable")}
      />
      {index && <SearchApp snapshot={index.snapshot} />}
      {index && (
        <div className={`${pageX} space-y-1.5 pb-16 text-[13px] text-muted`}>
          <p>{t("source", { date: fmtDate(index.snapshot, locale) })}</p>
          <p>{t("privacy")}</p>
        </div>
      )}
    </PageShell>
  );
}
