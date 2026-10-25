import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitch } from "./language-switch";

export function SiteHeader() {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-40 h-[var(--header-h)] border-b border-rule/80 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Autostatistika">
          <span className="flex h-7 items-stretch overflow-hidden rounded-[5px] ring-1 ring-ink">
            <span className="flex items-center bg-lime px-1.5 text-[9px] font-bold text-ink" style={{ fontVariationSettings: '"wdth" 112' }}>
              EE
            </span>
            <span className="flex items-center bg-ink px-1.5">
              <span className="block h-2 w-2 rounded-full bg-lime transition-transform duration-300 group-hover:scale-125" />
            </span>
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink" style={{ fontVariationSettings: '"wdth" 115' }}>
            Autostatistika
          </span>
        </Link>
        <nav aria-label={t("label")} className="flex items-center gap-1 sm:gap-2">
          {[
            ["/#explorer", t("explore"), "md:inline-flex"],
            ["/margid", t("brands"), "md:inline-flex"],
            ["/kuu", t("months"), "md:inline-flex"],
            ["/#insights", t("insights"), "lg:inline-flex"],
            ["/#methodology", t("methodology"), "lg:inline-flex"],
          ].map(([href, label, show]) => (
            <Link
              key={href}
              href={href}
              className={`hidden h-9 items-center rounded-full px-3.5 text-[14px] font-medium text-graphite transition-colors hover:bg-paper-2 hover:text-ink ${show}`}
            >
              {label}
            </Link>
          ))}
          <LanguageSwitch label={t("language")} />
        </nav>
      </div>
    </header>
  );
}
