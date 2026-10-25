import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/pages/page-shell";
import {
  Breadcrumbs,
  ButtonLink,
  Columns,
  PageIntro,
  RankedBars,
  Section,
  SourceNote,
  Stat,
  StatGrid,
  fmtChange,
} from "@/components/pages/parts";
import { loadBundle } from "@/lib/data/load";
import { brandDetail, brandSlugs, brandSummaries, shiftPeriod, type BrandDetail } from "@/lib/data/pages";
import { fmtNumber, fmtPercent, fmtPeriod, fmtPeriodShort } from "@/lib/format";
import { ogImagePath, pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

type Params = { locale: string; brand: string };

export async function generateStaticParams(): Promise<Array<{ brand: string }>> {
  return brandSlugs(await loadBundle()).map((brand) => ({ brand }));
}

async function load(slug: string): Promise<BrandDetail> {
  const detail = brandDetail(await loadBundle(), slug);
  if (!detail) notFound();
  return detail;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, brand } = await params;
  const d = await load(brand);
  const t = await getTranslations({ locale, namespace: "pages.brand" });
  const description =
    d.newCarsLatest != null
      ? [
          t("descNew", { name: d.name, latest: d.newCarsLatest, period: fmtPeriod(d.latest, locale) }),
          d.last12 != null ? t("descLast12", { count: fmtNumber(d.last12, locale) }) : "",
          d.carRank != null ? t("descRank", { rank: d.carRank }) : "",
          t("descTail"),
        ].join("")
      : t("descFallback", { name: d.name });
  return pageMetadata({
    locale,
    path: `/margid/${brand}`,
    title: t("metaTitle", { name: d.name }),
    description,
    image: ogImagePath(locale, "brand", brand),
  });
}

export default async function BrandPage({ params }: { params: Promise<Params> }) {
  const { locale, brand } = await params;
  setRequestLocale(locale);
  const d = await load(brand);
  const t = await getTranslations("pages.brand");
  const tp = await getTranslations("pages");
  const bundle = await loadBundle();

  const first = d.newCars[0]?.period ?? d.cars[0]?.period ?? d.latest;
  const latestRank = d.cars.find((entry) => entry.period === d.latest) ?? null;
  const latestTruck = d.trucks.find((entry) => entry.period === d.latest) ?? null;
  const recentFrom = shiftPeriod(d.latest, -11);
  const change12 = fmtChange(d.last12, d.prev12, locale);

  // Last 24 months: new cars (null where the model sheet does not reconcile) and TOP-list rows.
  const months = Array.from({ length: 24 }, (_, i) => shiftPeriod(d.latest, i - 23));
  const newByPeriod = new Map(d.newCars.map((entry) => [entry.period, entry.value]));
  const carsByPeriod = new Map(d.cars.map((entry) => [entry.period, entry]));
  const hasNewCars = d.newCars.some((entry) => entry.value > 0);
  const rankLabels = { month: t("month"), first: t("first"), rank: t("rank"), share: t("share"), notRanked: tp("notRanked") };

  // Other brands with pages, nearest by recent volume.
  const others = brandSummaries(bundle)
    .filter((entry) => entry.slug !== d.slug)
    .sort((a, b) => Math.abs((a.last12 ?? 0) - (d.last12 ?? 0)) - Math.abs((b.last12 ?? 0) - (d.last12 ?? 0)))
    .slice(0, 12)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell>
      <Breadcrumbs locale={locale} items={[{ label: tp("brandsNav"), href: "/margid" }, { label: d.name }]} />
      <PageIntro
        plate={t("plate")}
        title={t("title", { name: d.name })}
        lede={t("lede", { from: fmtPeriodShort(first, locale), to: fmtPeriodShort(d.latest, locale) })}
      >
        {latestRank && (
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/?tab=registreerimised&brands=${d.slug}#explorer`}>
              {t("compare")} <ArrowRight size={16} aria-hidden />
            </ButtonLink>
          </div>
        )}
      </PageIntro>

      <StatGrid>
        {d.newCarsLatest != null && (
          <Stat
            label={t("statNew", { period: fmtPeriod(d.latest, locale) })}
            value={fmtNumber(d.newCarsLatest, locale)}
            sub={
              d.newCarsRankLatest != null
                ? t("statNewRank", { rank: d.newCarsRankLatest, share: fmtPercent(d.newCarsShareLatest, locale) })
                : t("statNewNone")
            }
          />
        )}
        {d.last12 != null && (
          <Stat
            label={t("stat12")}
            value={fmtNumber(d.last12, locale)}
            sub={d.prev12 != null ? t("stat12Sub", { prev: fmtNumber(d.prev12, locale), change: change12 ?? "—" }) : undefined}
          />
        )}
        {d.cars.length > 0 && (
          <Stat
            label={t("statFirst", { period: fmtPeriod(d.latest, locale) })}
            value={latestRank ? fmtNumber(latestRank.value, locale) : "—"}
            sub={
              latestRank
                ? t("statFirstSub", { rank: latestRank.rank, share: fmtPercent(latestRank.share, locale) })
                : t("statFirstNone")
            }
            info={t("statFirstInfo")}
          />
        )}
        {latestTruck && (
          <Stat
            label={t("statTruck", { period: fmtPeriod(d.latest, locale) })}
            value={fmtNumber(latestTruck.value, locale)}
            sub={t("statTruckSub", { rank: latestTruck.rank })}
          />
        )}
      </StatGrid>

      {hasNewCars && (
        <Section id="new-cars" title={t("yearlyTitle")} note={t("yearlyNote")}>
          <Columns
            locale={locale}
            showValues
            labelEvery={d.yearly.length > 12 ? 2 : 1}
            items={d.yearly.map((year) => ({
              key: year.year,
              label: year.year,
              value: year.value,
              partial: year.months < 12,
              title: `${year.year}: ${fmtNumber(year.value, locale)}${year.months < 12 ? ` (${tp("partial", { months: year.months })})` : ""}`,
            }))}
          />
          <h3 className="t-title mt-14 text-[19px]">{t("monthlyTitle")}</h3>
          <p className="mt-2 text-[13.5px] text-muted">{t("monthlyNote")}</p>
          <div className="mt-6">
            <Columns
              locale={locale}
              height={160}
              labelEvery={6}
              items={months.map((period) => {
                const value = newByPeriod.get(period) ?? null;
                return {
                  key: period,
                  label: fmtPeriodShort(period, locale),
                  value,
                  title: `${fmtPeriod(period, locale)}: ${value == null ? "—" : fmtNumber(value, locale)}`,
                };
              })}
            />
          </div>
        </Section>
      )}

      {d.topModels.length > 0 && (
        <Section
          id="models"
          title={t("modelsTitle")}
          note={t("modelsNote", { name: d.name, from: fmtPeriodShort(recentFrom, locale), to: fmtPeriodShort(d.latest, locale) })}
        >
          <RankedBars
            locale={locale}
            valueLabel={t("count")}
            rows={d.topModels.map((model, index) => ({
              key: model.model,
              rank: index + 1,
              name: model.model,
              value: model.value,
              share: model.share,
            }))}
          />
        </Section>
      )}

      {d.cars.length > 0 && (
        <Section id="ranking" title={t("rankTitle")} note={t("rankNote")}>
          <RankTable locale={locale} months={months} rows={carsByPeriod} listed={new Set(d.carListPeriods)} labels={rankLabels} />
        </Section>
      )}

      {d.trucks.length > 0 && (
        <Section id="trucks" title={t("truckRankTitle")} note={t("truckRankNote")}>
          <RankTable
            locale={locale}
            months={months}
            rows={new Map(d.trucks.map((entry) => [entry.period, entry]))}
            listed={new Set(d.truckListPeriods)}
            labels={rankLabels}
          />
        </Section>
      )}

      <Section id="other-brands" title={t("otherBrands")}>
        <ul className="flex flex-wrap gap-2">
          {others.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/margid/${entry.slug}`}
                className="press inline-flex h-9 items-center rounded-full bg-paper-2 px-4 text-[14px] font-medium ring-1 ring-rule transition-colors hover:bg-paper-3"
              >
                {entry.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/margid" className="inline-flex h-9 items-center gap-1.5 px-3 text-[14px] font-medium underline underline-offset-4">
              {t("allBrands")} <ArrowRight size={14} aria-hidden />
            </Link>
          </li>
        </ul>
      </Section>

      <SourceNote />
    </PageShell>
  );
}

function RankTable({
  locale,
  months,
  rows,
  listed,
  labels,
}: {
  locale: string;
  months: string[];
  rows: Map<string, { value: number; rank: number; share: number | null }>;
  listed: Set<string>;
  labels: { month: string; first: string; rank: string; share: string; notRanked: string };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[14.5px]">
        <thead>
          <tr className="border-b border-ink text-left text-[13px] text-muted">
            <th scope="col" className="py-2 pr-4 font-normal">
              {labels.month}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              {labels.first}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              {labels.rank}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {labels.share}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...months].reverse().map((period) => {
            const row = rows.get(period);
            return (
              <tr key={period} className="border-b border-rule">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  <Link href={`/kuu/${period}`} className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                    {fmtPeriod(period, locale)}
                  </Link>
                </th>
                {row ? (
                  <>
                    <td className="tabular py-2 pr-4 text-right font-medium">{fmtNumber(row.value, locale)}</td>
                    <td className="tabular py-2 pr-4 text-right">{row.rank}</td>
                    <td className="tabular py-2 text-right text-muted">{fmtPercent(row.share, locale)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="py-2 text-right text-[13.5px] text-muted">
                    {listed.has(period) ? labels.notRanked : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
