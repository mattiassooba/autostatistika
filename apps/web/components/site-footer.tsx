import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadBundle } from "@/lib/data/load";
import { brandSummaries, monthPeriods } from "@/lib/data/pages";
import { fmtDate, fmtPeriod } from "@/lib/format";
import { PlateMark } from "./brand/plate-mark";

const linkClass = "text-paper/80 underline decoration-white/0 underline-offset-4 transition-colors hover:text-paper hover:decoration-lime";

export async function SiteFooter({ generatedAt, disclaimer }: { generatedAt: string; disclaimer: { et: string; en: string } }) {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const tp = await getTranslations("pages.footer");
  const locale = await getLocale();

  // Every page links into the brand and month pages, so crawlers reach them from the home page.
  const bundle = await loadBundle();
  const brands = brandSummaries(bundle)
    .filter((brand) => brand.last12 != null)
    .sort((a, b) => (b.last12 ?? 0) - (a.last12 ?? 0))
    .slice(0, 8);
  const months = monthPeriods(bundle).slice(-6).reverse();

  return (
    <footer className="on-dark bg-ink text-paper">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-14 sm:px-8 md:grid-cols-12 lg:px-12">
        <div className="md:col-span-12 lg:col-span-4">
          <PlateMark tone="dark" label="Autostatistika.ee" className="h-11 md:h-[52px]" />
          <p className="mt-4 max-w-[48ch] text-[14.5px] leading-relaxed text-paper/60">{disclaimer[locale === "en" ? "en" : "et"]}</p>
        </div>
        <nav aria-label={tn("label")} className="md:col-span-3 lg:col-span-2">
          <ul className="flex flex-col gap-2.5 text-[14.5px]">
            {[
              ["/#explorer", tn("explore")],
              ["/margid", tn("brands")],
              ["/kuu", tn("months")],
              ["/#insights", tn("insights")],
              ["/#methodology", tn("methodology")],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className={linkClass}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={tp("brands")} className="md:col-span-3 lg:col-span-2">
          <p className="t-meta text-paper/45">{tp("brands")}</p>
          <ul className="mt-3 flex flex-col gap-2.5 text-[14.5px]">
            {brands.map((brand) => (
              <li key={brand.slug}>
                <Link href={`/margid/${brand.slug}`} className={linkClass}>
                  {brand.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/margid" className={`${linkClass} text-lime`}>
                {tp("allBrands")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={tp("months")} className="md:col-span-3 lg:col-span-2">
          <p className="t-meta text-paper/45">{tp("months")}</p>
          <ul className="mt-3 flex flex-col gap-2.5 text-[14.5px]">
            {months.map((period) => (
              <li key={period}>
                <Link href={`/kuu/${period}`} className={linkClass}>
                  {fmtPeriod(period, locale)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/kuu" className={`${linkClass} text-lime`}>
                {tp("allMonths")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-[13.5px] leading-relaxed text-paper/55 md:col-span-3 lg:col-span-2">
          <p>{t("attribution")}</p>
          <p className="t-meta mt-3 text-paper/45">{t("processed", { date: fmtDate(generatedAt, locale) })}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1600px] px-4 py-5 text-[12.5px] text-paper/40 sm:px-8 lg:px-12">{t("note")}</p>
      </div>
    </footer>
  );
}
