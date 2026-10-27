import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitch } from "./language-switch";
import { PlateMark } from "./brand/plate-mark";

/** `intro` plays the mark's entrance: the home page only, beside the hero's. */
export function SiteHeader({ intro = false }: { intro?: boolean }) {
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
        {/* Phones: 30 px tall, or less when the screen leaves less room beside
            the language switch (136 px of gutters, gap and switch). */}
        <Link href="/" className="pm-hover shrink-0 rounded-[6px]" aria-label="Autostatistika.ee">
          <PlateMark size="sm" intro={intro} className="h-[min(30px,calc((100vw_-_136px)/6.69))] sm:h-[34px]" />
        </Link>
        <nav aria-label={t("label")} className="flex items-center gap-1 sm:gap-2">
          {[
            ["/#explorer", t("explore"), "md:inline-flex"],
            ["/otsing", t("search"), "md:inline-flex"],
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
