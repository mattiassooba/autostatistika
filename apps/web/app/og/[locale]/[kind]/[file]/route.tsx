import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { loadBundle } from "@/lib/data/load";
import { brandDetail, brandSlugs, carSeries, latestPeriod, monthDetail, monthPeriods, shiftPeriod } from "@/lib/data/pages";
import { color } from "@/lib/design/tokens";
import { BRAND_LOGOS } from "@/lib/brand-logos";
import { RATIO as PLATE_RATIO, plateMarkSvg } from "@/lib/brand/plate-mark";
import { fmtDate, fmtNumber, fmtPeriod } from "@/lib/format";

// Share images (Open Graph / Twitter cards), 1200×630 PNG, written at build
// time: /og/<locale>/site/{home,margid,kuu}.png, /og/<locale>/brand/<slug>.png,
// /og/<locale>/month/<YYYY-MM>.png. Pages reference them via lib/seo.ts.
export const dynamic = "force-static";
export const dynamicParams = false;

type Params = { locale: string; kind: string; file: string };
type Card = {
  eyebrow: string;
  title: string;
  figure?: string;
  figureLabel?: string;
  bars: Array<number | null>;
  /** Index of the bar to highlight; defaults to the last one. */
  highlight?: number;
  tagline: string;
  /** The brand's mark as an SVG data URI, painted in the card's text colour. */
  mark?: { src: string; width: number; height: number };
};

const SITE_FILES = ["home", "margid", "kuu", "otsing"];

// The site mark, reversed for the dark card.
const SITE_MARK = `data:image/svg+xml;base64,${Buffer.from(plateMarkSvg({ tone: "dark" })).toString("base64")}`;

export async function generateStaticParams(): Promise<Params[]> {
  const bundle = await loadBundle();
  return routing.locales.flatMap((locale) => [
    ...SITE_FILES.map((name) => ({ locale, kind: "site", file: `${name}.png` })),
    ...brandSlugs(bundle).map((slug) => ({ locale, kind: "brand", file: `${slug}.png` })),
    ...monthPeriods(bundle).map((period) => ({ locale, kind: "month", file: `${period}.png` })),
  ]);
}

let fonts: Promise<Array<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" }>> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "assets", "og");
  fonts ??= Promise.all([
    readFile(path.join(dir, "archivo-500.ttf")).then((data) => ({ name: "Archivo", data, weight: 500 as const, style: "normal" as const })),
    readFile(path.join(dir, "archivo-700.ttf")).then((data) => ({ name: "Archivo", data, weight: 700 as const, style: "normal" as const })),
    readFile(path.join(dir, "archivo-expanded-800.ttf")).then((data) => ({
      name: "Archivo Expanded",
      data,
      weight: 800 as const,
      style: "normal" as const,
    })),
  ]);
  return fonts;
}

/**
 * A brand mark for the card: the official SVG from public/logos with every
 * visible fill and stroke set to one colour (the site paints the same files
 * through a CSS mask, which keeps only the shape). fill="none" stays none.
 */
async function brandMark(slug: string): Promise<Card["mark"]> {
  const scale = BRAND_LOGOS.get(slug);
  if (scale == null) return undefined;
  let svg = await readFile(path.join(process.cwd(), "public", "logos", `${slug}.svg`), "utf8");
  svg = svg
    .replace(/<\?xml[^>]*>/, "")
    .replace(/\b(fill|stroke)\s*=\s*"(?!none")[^"]*"/g, `$1="${color.paper}"`)
    .replace(/\b(fill|stroke)\s*:\s*(?!none)[^;"]+/g, `$1:${color.paper}`);
  // Shapes without their own fill inherit black from the root element.
  svg = svg.replace(/<svg\b([^>]*)>/, (tag, attrs: string) => (/\bfill=/.test(attrs) ? tag : `<svg fill="${color.paper}"${attrs}>`));
  // Fit the mark into its box with its own proportions (wordmarks are wide).
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const box = root.match(/viewBox\s*=\s*"[\d.\s-]*?([\d.]+)\s+([\d.]+)\s*"/);
  const w = Number(box?.[1] ?? root.match(/\bwidth\s*=\s*"([\d.]+)/)?.[1] ?? 1);
  const h = Number(box?.[2] ?? root.match(/\bheight\s*=\s*"([\d.]+)/)?.[1] ?? 1);
  const side = 54 * scale;
  const aspect = w / h || 1;
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    width: Math.round(aspect >= 1 ? side : side * aspect),
    height: Math.round(aspect >= 1 ? side / aspect : side),
  };
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
// The image renderer drops the no-break space Estonian uses between thousands.
const number = (value: number, locale: string) => fmtNumber(value, locale).replace(/\s/g, " ");

async function card({ locale, kind, file }: Params): Promise<Card | null> {
  const bundle = await loadBundle();
  const t = await getTranslations({ locale, namespace: "pages" });
  const name = file.replace(/\.png$/, "");
  const latest = latestPeriod(bundle);
  const series = carSeries(bundle);
  const window = (end: string, values: Map<string, number>) =>
    Array.from({ length: 24 }, (_, i) => values.get(shiftPeriod(end, i - 23)) ?? null);
  const carValues = new Map(series.map((point) => [point.period, point.value]));
  const latestCars = carValues.get(latest);

  if (kind === "site" && name === "otsing") {
    const index = bundle.registerIndex;
    if (!index) return null;
    const ts = await getTranslations({ locale, namespace: "search" });
    // Every vehicle in the register on each register snapshot date (as the figure).
    const dates = (bundle.fleet.sources ?? []).map((row) => row.snapshot_date).sort();
    const stock = (date: string) => bundle.fleet.snapshots.filter((row) => row.snapshot_date === date).reduce((sum, row) => sum + row.value, 0) || null;
    return {
      eyebrow: t("og.searchTagline"),
      title: ts("title"),
      figure: number(index.vehicles, locale),
      figureLabel: t("og.inRegister", { date: fmtDate(index.snapshot, locale) }),
      bars: dates.map(stock),
      tagline: t("og.source"),
    };
  }
  if (kind === "site" && SITE_FILES.includes(name)) {
    const tm = await getTranslations({ locale, namespace: "meta" });
    const title = name === "margid" ? t("brandIndex.title") : name === "kuu" ? t("monthIndex.title") : tm("title").split(" — ")[1] ?? "Autostatistika";
    return {
      eyebrow: name === "margid" ? t("og.brandsTagline") : name === "kuu" ? t("og.monthsTagline") : t("og.siteTagline"),
      title: capitalize(title),
      figure: latestCars != null ? number(latestCars, locale) : undefined,
      figureLabel: t("og.first", { period: fmtPeriod(latest, locale) }),
      bars: window(latest, carValues),
      tagline: t("og.source"),
    };
  }
  if (kind === "brand") {
    const d = brandDetail(bundle, name);
    if (!d) return null;
    const newValues = new Map(d.newCars.map((point) => [point.period, point.value]));
    const ranked = d.cars.find((entry) => entry.period === latest);
    const useNew = d.newCars.some((point) => point.value > 0);
    // Lead with the most recent non-zero figure: latest month, last 12 months, TOP list, then all years.
    const allNew = d.newCars.reduce((sum, point) => sum + point.value, 0);
    const [figure, figureLabel] =
      useNew && d.newCarsLatest
        ? [d.newCarsLatest, t("og.newCars", { period: fmtPeriod(latest, locale) })]
        : useNew && d.last12
          ? [d.last12, t("og.newCars12")]
          : ranked
            ? [ranked.value, t("og.first", { period: fmtPeriod(latest, locale) })]
            : allNew
              ? [allNew, t("og.newCarsSince", { year: d.yearly[0]?.year ?? "" })]
              : [null, undefined];
    return {
      eyebrow: t("brand.plate"),
      title: d.name,
      figure: figure != null ? number(figure, locale) : undefined,
      figureLabel,
      bars: useNew ? window(latest, newValues) : window(latest, new Map(d.cars.map((entry) => [entry.period, entry.value]))),
      tagline: t("og.source"),
      mark: await brandMark(name),
    };
  }
  if (kind === "month") {
    const d = monthDetail(bundle, name);
    if (!d) return null;
    const cars = d.categories.find((row) => row.code === "passenger_car");
    return {
      eyebrow: t("month.plate"),
      title: capitalize(fmtPeriod(name, locale)),
      figure: cars?.first != null ? number(cars.first, locale) : undefined,
      figureLabel: t("og.firstPlain"),
      bars: window(name, carValues),
      tagline: t("og.source"),
    };
  }
  return null;
}

function titleSize(title: string): number {
  if (title.length <= 7) return 112;
  if (title.length <= 11) return 92;
  if (title.length <= 16) return 72;
  if (title.length <= 24) return 58;
  return 46;
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const content = await card(await params);
  if (!content) return new Response("Not found", { status: 404 });
  const max = Math.max(1, ...content.bars.map((value) => value ?? 0));
  const highlight = content.highlight ?? content.bars.length - 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: color.ink,
          color: color.paper,
          padding: "52px 64px 44px",
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og */}
          <img src={SITE_MARK} width={Math.round(PLATE_RATIO * 48)} height={48} alt="" />
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, color: color.mist }}>{content.eyebrow}</div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "space-between", gap: 48, paddingBottom: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {content.mark && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 104,
                  height: 104,
                  marginBottom: 26,
                  borderRadius: 52,
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og */}
                <img src={content.mark.src} width={content.mark.width} height={content.mark.height} alt="" />
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontFamily: "Archivo Expanded",
                fontWeight: 800,
                fontSize: titleSize(content.title),
                lineHeight: 0.98,
                letterSpacing: -2,
              }}
            >
              {content.title}
            </div>
            {content.figure && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 30 }}>
                <div style={{ display: "flex", flexShrink: 0, fontFamily: "Archivo Expanded", fontWeight: 800, fontSize: content.figure.length > 7 ? 64 : 88, lineHeight: 0.9, color: color.lime }}>
                  {content.figure}
                </div>
                <div style={{ display: "flex", maxWidth: 280, paddingBottom: 6, fontSize: 24, fontWeight: 500, lineHeight: 1.2, color: color.ruleStrong }}>
                  {content.figureLabel}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-end", gap: 5, width: 360, height: 230 }}>
            {content.bars.map((value, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flex: 1,
                  height: value == null ? 3 : Math.max(4, (value / max) * 230),
                  borderRadius: "3px 3px 0 0",
                  background: value == null ? color.ruleDark : index === highlight ? color.lime : color.graphite,
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${color.ruleDark}`,
            paddingTop: 20,
            fontSize: 21,
            fontWeight: 500,
            color: color.mist,
          }}
        >
          <div style={{ display: "flex" }}>autostatistika.ee</div>
          <div style={{ display: "flex" }}>{content.tagline}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await loadFonts() },
  );
}
