import { getLocale, getTranslations } from "next-intl/server";
import { fmtDate } from "@/lib/format";

export async function SiteFooter({ generatedAt, disclaimer }: { generatedAt: string; disclaimer: { et: string; en: string } }) {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const locale = await getLocale();
  return (
    <footer className="on-dark bg-ink text-paper">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-14 sm:px-8 md:grid-cols-12 lg:px-12">
        <div className="md:col-span-6">
          <p className="t-display text-[clamp(2.6rem,6vw,4.8rem)] text-paper">Autostatistika</p>
          <p className="mt-4 max-w-[48ch] text-[14.5px] leading-relaxed text-paper/60">{disclaimer[locale === "en" ? "en" : "et"]}</p>
        </div>
        <nav aria-label={tn("label")} className="md:col-span-3">
          <ul className="flex flex-col gap-2.5 text-[14.5px]">
            {[
              ["#explorer", tn("explore")],
              ["#insights", tn("insights")],
              ["#methodology", tn("methodology")],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-paper/80 underline decoration-white/0 underline-offset-4 transition-colors hover:text-paper hover:decoration-lime">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-[13.5px] leading-relaxed text-paper/55 md:col-span-3">
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
