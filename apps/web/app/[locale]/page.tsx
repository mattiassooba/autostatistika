import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardProvider } from "@/components/dashboard-context";
import { Explorer } from "@/components/explorer/explorer";
import { Hero } from "@/components/hero/hero";
import { Insights } from "@/components/insights";
import { Methodology } from "@/components/methodology";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadBundle } from "@/lib/data/load";
import { brandSlugs } from "@/lib/data/pages";
import { resolveView } from "@/lib/data/resolve";
import { buildExplorerData, requiredSlices, type SlicePayload } from "@/lib/data/slices";
import { getCore, getSlice } from "@/lib/data/store";
import { registrationPeriodsOf } from "@/lib/data/views";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { parseQuery } from "@/lib/url-state";

type Source = { id: string; name: string; official_url: string; dataset_kind: string };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pre-rendered at build time with the default view; DashboardProvider applies
  // a shared link's query in the browser.
  const query = parseQuery({});
  const core = await getCore();

  // Render the default view with its slices already in place, so the first
  // paint never waits on a client fetch.
  const coreData = buildExplorerData(core, []);
  const keys = requiredSlices(resolveView(coreData, query), core.catalog);
  const initialSlices = (await Promise.all(keys.map((key) => getSlice(key)))).filter(Boolean) as SlicePayload[];

  const periods = registrationPeriodsOf(coreData);
  const bundle = await loadBundle();
  const sources = ((bundle as unknown as { sources?: Source[] }).sources ?? []) as Source[];

  // schema.org Dataset, for Google Dataset Search and rich results.
  const t = await getTranslations({ locale, namespace: "meta" });
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t("title"),
    description: t("description"),
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    isAccessibleForFree: true,
    temporalCoverage: periods.length ? `${periods[0]}/${periods.at(-1)}` : undefined,
    spatialCoverage: { "@type": "Place", name: locale === "et" ? "Eesti" : "Estonia" },
    dateModified: core.generatedAt,
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isBasedOn: sources.map((source) => source.official_url),
  };

  return (
    <DashboardProvider core={core} initialSlices={initialSlices} initialQuery={query}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main id="main">
        <Hero
          span={[periods[0]?.slice(0, 4) ?? "", periods.at(-1)?.slice(0, 4) ?? ""]}
          brandPages={brandSlugs(bundle)}
        />
        <Explorer />
        <Insights />
        <Methodology data={coreData} sources={sources} />
      </main>
      <SiteFooter generatedAt={core.generatedAt} disclaimer={core.disclaimer} />
    </DashboardProvider>
  );
}
