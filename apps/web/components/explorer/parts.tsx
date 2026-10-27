"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ArrowUpRight, Table, ChartBar } from "@phosphor-icons/react";
import { Popover, InfoTip } from "../ui/popover";
import { fmtDate } from "@/lib/format";

export const SOURCES = {
  registrations: "https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika",
  fleet: "https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika",
  register: "https://andmed.eesti.ee/datasets/soidukite-staatused-eestis",
  inspections: "https://www.transpordiamet.ee/tehnoulevaatuste-statistika",
} as const;

/** A titled block in the explorer. Hairline rule and type create hierarchy, not boxes. */
export function Block({
  id,
  title,
  description,
  info,
  actions,
  children,
  footer,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  info?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <section id={id} className={`min-w-0 scroll-mt-[calc(var(--header-h)+92px)] border-t border-ink pt-4 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[62ch]">
          <div className="flex items-center gap-2">
            <h3 className="t-title text-[19px] text-ink md:text-[21px]">{title}</h3>
            {info && <InfoTip label={t("aboutChart")}>{info}</InfoTip>}
          </div>
          {description && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{description}</p>}
        </div>
        {/* max-w-full, not shrink-0: wider than a phone screen, the controls wrap instead of pushing the page sideways */}
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="mt-5">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

export function Figure({
  label,
  value,
  sub,
  size = "md",
  info,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  size?: "xl" | "lg" | "md";
  info?: ReactNode;
}) {
  const t = useTranslations("common");
  const sizes = {
    xl: "text-[clamp(3.4rem,6.4vw,5.6rem)]",
    lg: "text-[clamp(2.4rem,3.6vw,3.25rem)]",
    md: "text-[clamp(1.9rem,2.6vw,2.4rem)]",
  };
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[13.5px] text-muted">
        <span>{label}</span>
        {info && <InfoTip label={t("definition")}>{info}</InfoTip>}
      </div>
      <p className={`t-figure mt-2 text-ink ${sizes[size]}`}>{value}</p>
      {sub && <div className="mt-2 text-[13.5px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

/** Compact, consistent source pattern with an expandable provenance panel. */
export function SourceTag({
  href,
  dataset,
  period,
  generatedAt,
  note,
  licence,
}: {
  href: string;
  dataset: string;
  period: string;
  generatedAt: string;
  note?: ReactNode;
  licence?: string;
}) {
  const t = useTranslations("source");
  const locale = useLocale();
  return (
    <Popover
      label={t("label")}
      side="top"
      width="w-[22rem]"
      trigger={({ open, toggle, id, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          className="t-meta group inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left text-muted transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-rule-strong transition-colors group-hover:ring-ink/40">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          </span>
          {t("short", { dataset, period })}
        </button>
      )}
    >
      <div className="px-4 py-3.5 text-[13px] leading-relaxed text-graphite">
        <p className="t-title text-[14px] text-ink">{t("label")}</p>
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">{t("publisherLabel")}</dt>
          <dd>{t("publisher")}</dd>
          <dt className="text-muted">{t("dataset")}</dt>
          <dd>{dataset}</dd>
          <dt className="text-muted">{t("period")}</dt>
          <dd className="tabular">{period}</dd>
          <dt className="text-muted">{t("processed")}</dt>
          <dd className="tabular">{fmtDate(generatedAt, locale)}</dd>
          {licence && (
            <>
              <dt className="text-muted">{t("licence")}</dt>
              <dd>{licence}</dd>
            </>
          )}
        </dl>
        {note && <p className="mt-3 border-t border-rule pt-3 text-muted">{note}</p>}
        <p className="mt-3 border-t border-rule pt-3 text-muted">{t("limitation")}</p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 font-medium text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
        >
          {t("link")}
          <ArrowUpRight size={13} weight="bold" />
        </a>
      </div>
    </Popover>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative flex min-h-[220px] flex-col items-start justify-center overflow-hidden rounded-[14px] bg-paper-2 px-6 py-8">
      <span className="hatch pointer-events-none absolute inset-0 text-graphite/[0.07]" aria-hidden="true" />
      <p className="t-title relative text-[17px] text-ink">{title}</p>
      {children && <div className="relative mt-2 max-w-[52ch] text-[14px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}

/** Chart ⇄ table toggle; every chart has a table twin. */
export function ViewToggle({ table, onChange }: { table: boolean; onChange: (table: boolean) => void }) {
  const t = useTranslations("common");
  return (
    <div className="inline-flex rounded-full bg-paper-2 p-0.5 ring-1 ring-rule" role="group" aria-label={t("viewAs")}>
      {[
        { value: false, label: t("chart"), icon: <ChartBar size={14} /> },
        { value: true, label: t("table"), icon: <Table size={14} /> },
      ].map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={table === option.value}
          aria-label={option.label}
          onClick={() => onChange(option.value)}
          className={`press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
            table === option.value ? "bg-paper text-ink shadow-[0_1px_2px_rgb(24_29_29/0.12)] ring-1 ring-rule" : "text-muted hover:text-ink"
          }`}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  active = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 transition-colors ${
        active ? "bg-ink text-paper ring-ink" : "bg-paper text-graphite ring-rule-strong hover:text-ink hover:ring-ink/50"
      }`}
    >
      {children}
    </button>
  );
}

/** Proportional bar row used by DOM rankings (counties, categories, stations). */
export function BarRow({
  label,
  value,
  sub,
  ratio,
  active = false,
  onClick,
  glyph,
  barClass = "bg-graphite",
  ariaLabel,
}: {
  label: ReactNode;
  value: string;
  sub?: string;
  ratio: number;
  active?: boolean;
  onClick?: () => void;
  glyph?: ReactNode;
  barClass?: string;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-[14px] text-ink">
        {glyph}
        <span className="truncate">{label}</span>
      </span>
      <span className="relative h-2.5 overflow-hidden" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,background-color] duration-700 ease-[var(--ease-out)] ${active ? "bg-ink" : barClass}`}
          style={{ width: `${Math.max(0.6, ratio * 100)}%` }}
        />
      </span>
      <span className="whitespace-nowrap text-right text-[13.5px]">
        <span className="tabular font-semibold text-ink">{value}</span>
        {sub && <span className="tabular ml-2 inline-block min-w-[3.6em] text-muted">{sub}</span>}
      </span>
    </>
  );
  const cls = `group grid w-full grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-x-3 rounded-[8px] px-2 py-[7px] text-left transition-colors sm:grid-cols-[minmax(0,11rem)_1fr_auto] ${
    active ? "bg-lime-wash" : ""
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} aria-label={ariaLabel} className={`${cls} cursor-pointer hover:bg-paper-2`}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}
