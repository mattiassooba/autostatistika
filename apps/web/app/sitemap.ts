import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { loadBundle } from "@/lib/data/load";
import { brandSlugs, monthPeriods } from "@/lib/data/pages";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bundle = await loadBundle();
  const lastModified = bundle.generatedAt;
  const periods = monthPeriods(bundle);
  const recent = new Set(periods.slice(-13));
  const pages: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }> = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/margid", priority: 0.9, changeFrequency: "weekly" },
    { path: "/kuu", priority: 0.8, changeFrequency: "weekly" },
    ...(bundle.registerIndex ? [{ path: "/otsing", priority: 0.9, changeFrequency: "monthly" as const }] : []),
    ...brandSlugs(bundle).map((slug) => ({ path: `/margid/${slug}`, priority: 0.8, changeFrequency: "weekly" as const })),
    // Recent months can still be revised; older ones are settled.
    ...[...periods].reverse().map((period) => ({
      path: `/kuu/${period}`,
      priority: recent.has(period) ? 0.7 : 0.5,
      changeFrequency: recent.has(period) ? ("monthly" as const) : ("yearly" as const),
    })),
  ];
  return pages.flatMap(({ path, priority, changeFrequency }) => {
    const languages = Object.fromEntries(routing.locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]));
    return routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency,
      priority: locale === routing.defaultLocale ? priority : Math.round(priority * 80) / 100,
      alternates: { languages },
    }));
  });
}
