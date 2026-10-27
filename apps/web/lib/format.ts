// Locale-aware formatting. Estonian uses a non-breaking space for thousands
// and a decimal comma; English uses en-GB conventions.

export type Locale = "et" | "en";

const intlLocale = (locale: string) => (locale === "et" ? "et-EE" : "en-GB");

export function fmtNumber(value: number | null | undefined, locale: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(intlLocale(locale)).format(Math.round(value));
}

export function fmtPercent(value: number | null | undefined, locale: string, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return locale === "et" ? `${number} %` : `${number}%`;
}

export function fmtCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function periodDate(period: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

/** "2026-09" → "september 2026" / "September 2026" */
export function fmtPeriod(period: string | undefined | null, locale: string): string {
  if (!period) return "—";
  const date = periodDate(period);
  if (!date) return period;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "2026-09" → "sept 2026" / "Sep 2026" */
export function fmtPeriodShort(period: string | undefined | null, locale: string): string {
  if (!period) return "—";
  const date = periodDate(period);
  if (!date) return period;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
}

/** "2026-09" → "09/2026" — compact technical form for plates and axes. */
export function fmtPeriodNumeric(period: string | undefined | null): string {
  if (!period) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  return match ? `${match[2]}/${match[1]}` : period;
}

export function fmtMonthName(period: string, locale: string): string {
  const date = periodDate(period);
  if (!date) return period;
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: "UTC" }).format(date);
}

export function periodYear(period: string): string {
  return period.slice(0, 4);
}

/** "2020-12-31" → "31.12.2020" / "31 Dec 2020" */
export function fmtDate(value: string | undefined | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: locale === "et" ? "2-digit" : "numeric",
    month: locale === "et" ? "2-digit" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Fractional year for placing periods/dates on a continuous time axis. */
export function toYearFraction(value: string): number {
  const [y, m = "01", d = "01"] = value.split("-");
  return Number(y) + (Number(m) - 1) / 12 + (Number(d) - 1) / 365;
}

/** "2026-09" shifted by −11 months → "2025-10". */
export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Whole months between two YYYY-MM periods. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function titleCaseBrand(source: string): string {
  // Source brand names are upper case ("MERCEDES-BENZ"). Short acronyms stay upper.
  const keep = new Set([
    "BMW", "DAF", "MAN", "KIA", "MG", "BYD", "DS", "GAZ", "UAZ", "VAZ", "AMG", "LDV", "SEAT", "MINI", "DFSK", "SWM", "GMC", "KG",
  ]);
  return source
    .split(/(\s|-|&)/)
    .map((part) => {
      if (keep.has(part)) return part === "SEAT" ? "Seat" : part === "MINI" ? "Mini" : part;
      if (/^[\s&-]$/.test(part) || part.length <= 1) return part;
      if (/\d/.test(part) && part.length <= 4) return part;
      return part.charAt(0) + part.slice(1).toLowerCase();
    })
    .join("");
}

export function countyName(source: string): string {
  // "HARJU MAAKOND" → "Harju"
  return titleCaseBrand(source.replace(/\s*MAAKOND$/i, ""));
}

/** Distance between two periods/dates as compact "+4 a" / "+15 a 10 k" (et) or "+4 y" (en). */
export function fmtGap(from: string, to: string, locale: string, compact = true): string {
  const months = monthsBetween(from.slice(0, 7), to.slice(0, 7));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (compact) {
    const y = locale === "et" ? "a" : "y";
    const m = locale === "et" ? "k" : "m";
    const parts = [years ? `${years} ${y}` : "", rest ? `${rest} ${m}` : ""].filter(Boolean);
    return `+${parts.join(" ") || `0 ${m}`}`;
  }
  const yWord = locale === "et" ? (years === 1 ? "aasta" : "aastat") : years === 1 ? "year" : "years";
  const mWord = locale === "et" ? (rest === 1 ? "kuu" : "kuud") : rest === 1 ? "month" : "months";
  return [years ? `${years} ${yWord}` : "", rest ? `${rest} ${mWord}` : ""].filter(Boolean).join(" ");
}

/** A list of periods or dates as "jaan 2006 – sept 2026, 236 kuud" when long. */
export function fmtPeriodList(items: string[], locale: string, formatItem: (item: string) => string): string {
  if (items.length <= 4) return items.map(formatItem).join(", ");
  const sorted = [...items].sort();
  const unit = locale === "et" ? (sorted[0].length > 7 ? "seisu" : "kuud") : sorted[0].length > 7 ? "snapshots" : "months";
  return `${formatItem(sorted[0])} – ${formatItem(sorted[sorted.length - 1])}, ${sorted.length} ${unit}`;
}
