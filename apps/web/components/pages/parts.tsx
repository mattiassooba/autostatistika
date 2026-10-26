import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "../ui/brand-logo";
import { Plate } from "../ui/plate";
import { SITE_URL } from "@/lib/site";
import { fmtNumber, fmtPercent } from "@/lib/format";

// Building blocks for the static brand and month pages: server components,
// no client JavaScript beyond the shared header.

export const pageX = "mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12";

export async function Breadcrumbs({ locale, items }: { locale: string; items: Array<{ label: string; href?: string }> }) {
  const t = await getTranslations("pages");
  const trail = [{ label: t("home"), href: "/" }, ...items];
  const structured = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}` } : {}),
    })),
  };
  return (
    <nav aria-label={t("breadcrumb")} className={`${pageX} pt-6`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {trail.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && <CaretRight size={11} aria-hidden className="text-mist" />}
            {item.href ? (
              <Link href={item.href} className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-graphite">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageIntro({
  plate,
  title,
  lede,
  mark,
  children,
}: {
  plate: string;
  title: string;
  lede: string;
  /** A brand's mark, set beside the title on brand pages. */
  mark?: { slug: string; name: string };
  children?: ReactNode;
}) {
  return (
    <header className={`${pageX} pb-10 pt-8 md:pb-14 md:pt-10`}>
      <div className="enter-fade" style={{ ["--i" as string]: 0 }}>
        <Plate>{plate}</Plate>
      </div>
      <div className="enter-rise mt-5 flex items-center gap-4 md:gap-6" style={{ ["--i" as string]: 1 }}>
        {mark && (
          <BrandLogo
            slug={mark.slug}
            name={mark.name}
            tone="light"
            className="h-16 w-16 text-[19px] text-ink md:h-[5.5rem] md:w-[5.5rem] md:text-[24px]"
          />
        )}
        <h1 className="t-display min-w-0 max-w-[18ch] text-[clamp(2.4rem,8vw,5.6rem)] text-ink">{title}</h1>
      </div>
      <p className="enter-rise mt-5 max-w-[60ch] text-[17px] leading-[1.55] text-graphite" style={{ ["--i" as string]: 2 }}>
        {lede}
      </p>
      {children}
    </header>
  );
}

export function Section({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`${pageX} py-10 md:py-14`}>
      <div className="border-t border-ink pt-5">
        <h2 id={id ? `${id}-title` : undefined} className="t-headline text-[clamp(1.6rem,3.4vw,2.4rem)]">
          {title}
        </h2>
        {note && <p className="mt-3 max-w-[72ch] text-[14px] leading-relaxed text-muted">{note}</p>}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={`${pageX} grid gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-3`}>{children}</div>;
}

export function Stat({ label, value, sub, info }: { label: string; value: string; sub?: string; info?: string }) {
  return (
    <div className="border-t border-ink py-5 sm:pr-8">
      <p className="text-[13.5px] text-muted">{label}</p>
      <p className="t-figure tabular mt-3 text-[clamp(2.6rem,6vw,3.8rem)] text-ink">{value}</p>
      {sub && <p className="mt-3 text-[14px] text-graphite">{sub}</p>}
      {info && <p className="mt-1.5 text-[12.5px] text-muted">{info}</p>}
    </div>
  );
}

/** Signed change between two values, e.g. "+12,4 %"; null when either side is missing. */
export function fmtChange(current: number | null | undefined, previous: number | null | undefined, locale: string): string | null {
  if (current == null || previous == null || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const text = fmtPercent(Math.abs(change), locale);
  return `${change > 0 ? "+" : change < 0 ? "−" : "±"}${text}`;
}

/** Columns in plain HTML (labels stay readable at any width). Null values leave a gap. */
export function Columns({
  items,
  locale,
  labelEvery = 1,
  showValues = false,
  height = 220,
}: {
  items: Array<{ key: string; label: string; value: number | null; partial?: boolean; title: string }>;
  locale: string;
  labelEvery?: number;
  showValues?: boolean;
  height?: number;
}) {
  const max = Math.max(1, ...items.map((item) => item.value ?? 0));
  return (
    <div>
      <ol className="flex items-end gap-[3px] sm:gap-1.5" style={{ height }}>
        {items.map((item) => (
          <li key={item.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={item.title}>
            <span className="sr-only">{item.title}</span>
            {showValues && item.value != null && (
              <span className="t-meta tabular mb-1 hidden text-center text-muted md:block" aria-hidden>
                {fmtNumber(item.value, locale)}
              </span>
            )}
            {item.value != null ? (
              <span
                aria-hidden
                className={`block rounded-t-[3px] ${item.partial ? "hatch bg-paper-3 ring-1 ring-inset ring-ink/25" : "bg-ink"}`}
                style={{ height: `${Math.max(1.5, (item.value / max) * 100)}%` }}
              />
            ) : (
              <span aria-hidden className="block h-[2px] bg-rule" />
            )}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex gap-[3px] border-t border-ink pt-2 sm:gap-1.5" aria-hidden>
        {items.map((item, index) => (
          <span key={item.key} className="t-meta min-w-0 flex-1 overflow-visible whitespace-nowrap text-muted">
            {index % labelEvery === 0 ? item.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked rows with a proportional bar; names link when a page exists. */
export function RankedBars({
  rows,
  locale,
  linkFor,
  valueLabel,
  logos = false,
}: {
  rows: Array<{ key: string; rank?: number; name: string; detail?: string; value: number; share?: number | null; slug?: string }>;
  locale: string;
  linkFor?: (slug: string) => string | null;
  valueLabel: string;
  /** Show each row's brand mark before its name. */
  logos?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ol className="divide-y divide-rule border-b border-rule">
      {rows.map((row) => {
        const href = row.slug && linkFor ? linkFor(row.slug) : null;
        const name = href ? (
          <Link href={href} className="font-medium underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink">
            {row.name}
          </Link>
        ) : (
          <span className="font-medium">{row.name}</span>
        );
        return (
          <li key={row.key} className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 sm:grid-cols-[2.4rem_minmax(9rem,16rem)_minmax(0,1fr)_6rem_5rem]">
            <span className="t-meta tabular text-muted">{row.rank != null ? String(row.rank).padStart(2, "0") : ""}</span>
            <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
              {logos && row.slug && <BrandLogo slug={row.slug} name={row.name} tone="light" className="h-7 w-7 text-[9.5px] text-ink" />}
              <span className="min-w-0 truncate">
                {name}
                {row.detail && <span className="ml-1.5 text-muted">{row.detail}</span>}
              </span>
            </span>
            <span aria-hidden className="hidden h-2.5 rounded-full bg-paper-3 sm:block">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${(row.value / max) * 100}%` }} />
            </span>
            <span className="tabular text-right text-[15px] font-medium" aria-label={`${valueLabel}: ${fmtNumber(row.value, locale)}`}>
              {fmtNumber(row.value, locale)}
            </span>
            <span className="tabular hidden text-right text-[13.5px] text-muted sm:block">
              {row.share != null ? fmtPercent(row.share, locale) : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ButtonLink({ href, children, tone = "dark" }: { href: string; children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      className={`press inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-medium transition-colors ${
        tone === "dark" ? "bg-ink text-paper hover:bg-graphite" : "bg-paper-2 text-ink ring-1 ring-rule-strong hover:bg-paper-3"
      }`}
    >
      {children}
    </Link>
  );
}

export async function SourceNote() {
  const t = await getTranslations("pages");
  return (
    <p className={`${pageX} pb-16 text-[13px] text-muted`}>
      {t("source")}{" "}
      <Link href="/#methodology" className="underline underline-offset-4 hover:text-ink">
        {t("methodLink")}
      </Link>
    </p>
  );
}
