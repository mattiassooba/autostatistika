// Trend analysis for the brand comparison. Every number is computed here, from
// the same rows the comparison chart draws; the optional language model only
// rewords the resulting statements (see validate.ts for the checks on its text).
//
// Missing stays missing. A month in which a brand is not on the source's TOP list
// is unknown, not zero, so a brand gets a 12-month total only when it is listed in
// all 12 months. Changes compare two complete 12-month blocks (the first and the
// last in the window), so seasonality does not decide the direction.

import type { BrandHistory, RegistrationPoint } from "../data/views";
import { shiftPeriod } from "../format";

export const BLOCK_MONTHS = 12;
/** A month stands out when it is this many times the brand's median month (or that fraction of it). */
export const SPIKE_RATIO = 1.8;
const MIN_MONTHS_FOR_SPIKE = 12;

export type Block = { from: string; to: string };

export type BlockStat = {
  listed: number; // months of the block with the brand on the TOP list
  total: number | null; // sum over the block, only when listed in all 12 months
  share: number | null; // total / category first registrations over the same 12 months × 100
};

export type BrandTrend = {
  slug: string;
  name: string;
  months: number; // window months that have a TOP list
  listed: number; // of which the brand is on it
  best: number | null; // best rank in the window
  worst: number | null;
  start: BlockStat | null;
  end: BlockStat | null;
  change: number | null; // (end − start) / start × 100
  shareChange: number | null; // percentage points between the shares as shown
  median: number | null; // median listed month, with at least 12 listed months
  peak: { period: string; value: number } | null;
  low: { period: string; value: number } | null;
};

export type MarketBlock = { first: number; neu: number | null; newShare: number | null }; // newShare = new / first × 100

export type MarketTrend = {
  start: MarketBlock;
  end: MarketBlock;
  change: number; // first registrations, (end − start) / start × 100
  newShareChange: number | null; // percentage points between the shares as shown
};

export type TrendFacts = {
  status: "ok" | "insufficient" | "empty";
  category: string;
  from: string;
  to: string;
  calendarMonths: number;
  gaps: string[]; // calendar months in the window without a TOP list
  listSize: { min: number; max: number } | null; // brands per month's TOP list
  blocks: { start: Block; end: Block } | null;
  brands: BrandTrend[];
  market: MarketTrend | null;
  latest: string | null; // last window month with a TOP list
};

export type TrendInput = {
  category: string;
  periods: string[]; // months with a TOP list, inside the window, sorted
  history: BrandHistory[]; // points for exactly those months
  totals: RegistrationPoint[]; // the category's monthly totals
  listSize: (period: string) => number;
};

export function monthsFrom(from: string, to: string): string[] {
  const months: string[] = [];
  for (let period = from; period <= to; period = shiftPeriod(period, 1)) months.push(period);
  return months;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
// Percentage points are taken between the shares as shown (one decimal), so that
// "9,9 % → 11,3 %" reads "+1,4 pp" and never disagrees with its own figures.
const shown = (share: number) => Math.round(share * 10) / 10;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function trendFacts({ category, periods, history, totals, listSize }: TrendInput): TrendFacts {
  const from = periods[0] ?? "";
  const to = periods[periods.length - 1] ?? "";
  const calendar = from ? monthsFrom(from, to) : [];
  const listed = new Set(periods);
  const totalsBy = new Map(totals.map((point) => [point.period, point]));
  const sizes = periods.map(listSize).filter((size) => size > 0);

  // A month counts towards a block when it has a TOP list and a stated category total.
  const covered = calendar.map((period) => listed.has(period) && totalsBy.get(period)?.first != null);
  const runAt = (index: number) => covered.slice(index, index + BLOCK_MONTHS).every(Boolean);
  let startIndex = -1;
  for (let i = 0; i + BLOCK_MONTHS <= calendar.length; i++) if (runAt(i)) { startIndex = i; break; }
  let endIndex = -1;
  for (let i = calendar.length - BLOCK_MONTHS; i >= 0; i--) if (runAt(i)) { endIndex = i; break; }
  const blocks =
    startIndex >= 0 && endIndex >= startIndex + BLOCK_MONTHS
      ? {
          start: { from: calendar[startIndex], to: calendar[startIndex + BLOCK_MONTHS - 1] },
          end: { from: calendar[endIndex], to: calendar[endIndex + BLOCK_MONTHS - 1] },
        }
      : null;

  const blockMonths = (block: Block) => monthsFrom(block.from, block.to);
  const marketBlock = (block: Block): MarketBlock => {
    const points = blockMonths(block).map((period) => totalsBy.get(period)!);
    const first = sum(points.map((point) => point.first!));
    const neu = points.every((point) => point.neu != null) ? sum(points.map((point) => point.neu!)) : null;
    return { first, neu, newShare: neu != null && first ? (neu / first) * 100 : null };
  };
  const market = blocks
    ? (() => {
        const start = marketBlock(blocks.start);
        const end = marketBlock(blocks.end);
        if (!start.first) return null;
        return {
          start,
          end,
          change: ((end.first - start.first) / start.first) * 100,
          newShareChange: start.newShare != null && end.newShare != null ? shown(end.newShare) - shown(start.newShare) : null,
        };
      })()
    : null;

  const brands = history.map((brand): BrandTrend => {
    const byPeriod = new Map(brand.points.map((point) => [point.period, point]));
    const hits = brand.points.filter((point) => point.value != null) as Array<{ period: string; value: number; rank: number | null }>;
    const ranks = hits.map((point) => point.rank).filter((rank): rank is number => rank != null);
    const blockStat = (block: Block, marketFirst: number): BlockStat => {
      const values = blockMonths(block).map((period) => byPeriod.get(period)?.value ?? null);
      const known = values.filter((value): value is number => value != null);
      const total = known.length === BLOCK_MONTHS ? sum(known) : null;
      return { listed: known.length, total, share: total != null && marketFirst ? (total / marketFirst) * 100 : null };
    };
    const start = blocks && market ? blockStat(blocks.start, market.start.first) : null;
    const end = blocks && market ? blockStat(blocks.end, market.end.first) : null;
    const enough = hits.length >= MIN_MONTHS_FOR_SPIKE;
    const peak = enough ? hits.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    const low = enough ? hits.reduce((a, b) => (b.value < a.value ? b : a)) : null;
    return {
      slug: brand.slug,
      name: brand.name,
      months: periods.length,
      listed: hits.length,
      best: ranks.length ? Math.min(...ranks) : null,
      worst: ranks.length ? Math.max(...ranks) : null,
      start,
      end,
      change: start?.total && end?.total != null ? ((end.total - start.total) / start.total) * 100 : null,
      shareChange: start?.share != null && end?.share != null ? shown(end.share) - shown(start.share) : null,
      median: enough ? median(hits.map((point) => point.value)) : null,
      peak: peak && { period: peak.period, value: peak.value },
      low: low && { period: low.period, value: low.value },
    };
  });

  return {
    status: !history.length || !periods.length ? "empty" : blocks && market ? "ok" : "insufficient",
    category,
    from,
    to,
    calendarMonths: calendar.length,
    gaps: calendar.filter((period) => !listed.has(period)),
    listSize: sizes.length ? { min: Math.min(...sizes), max: Math.max(...sizes) } : null,
    blocks: market ? blocks : null,
    brands,
    market,
    latest: to || null,
  };
}

/* ------------------------------------------------------------------ */
/* Statements                                                           */
/* ------------------------------------------------------------------ */

// A statement is a message key plus typed values; render.ts turns it into a
// sentence in the page's language. Evidence rows are the figures a statement
// rests on, shown beside the text.

export type Value =
  | { kind: "count"; value: number }
  | { kind: "pct"; value: number }
  | { kind: "signedPct"; value: number }
  | { kind: "pp"; value: number }
  | { kind: "ratio"; value: number }
  | { kind: "int"; value: number }
  | { kind: "period"; value: string }
  | { kind: "range"; value: Block }
  | { kind: "brand"; value: string }
  | { kind: "change"; from: Value; to: Value } // "6925 → 4483"
  | { kind: "list"; value: Array<{ key: string; values: Record<string, Value> }> };

export type Section = "summary" | "changes" | "comparison" | "observation";

export type Statement = { id: string; section: Section; key: string; values: Record<string, Value>; evidence: string[] };

export type EvidenceRow = {
  id: string;
  key: string; // what the figure is (message key)
  brand?: string;
  period: Value; // a month, a block, or the start and end blocks
  value: Value;
};

export type Limitation = { key: string; values: Record<string, Value> };

export type TrendStatements = {
  statements: Statement[];
  evidence: EvidenceRow[];
  limitations: Limitation[];
};

const count = (value: number): Value => ({ kind: "count", value });
const range = (value: Block): Value => ({ kind: "range", value });
const brandName = (value: string): Value => ({ kind: "brand", value });

export function trendStatements(facts: TrendFacts): TrendStatements {
  const statements: Statement[] = [];
  const evidence: EvidenceRow[] = [];
  const evidenceId = new Map<string, string>();
  const cite = (row: Omit<EvidenceRow, "id">) => {
    const signature = JSON.stringify(row);
    let id = evidenceId.get(signature);
    if (!id) {
      id = `e${evidence.length + 1}`;
      evidenceId.set(signature, id);
      evidence.push({ id, ...row });
    }
    return id;
  };
  const say = (section: Section, key: string, values: Record<string, Value>, cites: string[] = []) =>
    statements.push({ id: `s${statements.length + 1}`, section, key, values, evidence: cites });

  const { blocks, market, brands } = facts;
  // One evidence row per figure pair: start block → end block (or the end block alone).
  const blockPair = (start: number | null | undefined, end: number | null | undefined, as: (n: number) => Value) =>
    start != null && end != null
      ? { period: { kind: "change", from: range(blocks!.start), to: range(blocks!.end) } as Value, value: { kind: "change", from: as(start), to: as(end) } as Value }
      : { period: range(blocks!.end), value: as(end!) };
  const pct = (value: number): Value => ({ kind: "pct", value });
  const totals = (brand: BrandTrend) => cite({ key: "brandTotals", brand: brand.name, ...blockPair(brand.start?.total, brand.end?.total, count) });
  const shares = (brand: BrandTrend) => cite({ key: "brandShares", brand: brand.name, ...blockPair(brand.start?.share, brand.end?.share, pct) });
  const marketTotals = () => cite({ key: "marketTotals", ...blockPair(market!.start.first, market!.end.first, count) });
  const ranksOf = (brand: BrandTrend) =>
    cite({
      key: "brandRanks",
      brand: brand.name,
      period: range({ from: facts.from, to: facts.to }),
      value: { kind: "list", value: [{ key: brand.best === brand.worst ? "rank" : "rankRange", values: { best: { kind: "int", value: brand.best! }, worst: { kind: "int", value: brand.worst! } } }] },
    });

  if (facts.status === "ok" && blocks && market) {
    const withTotals = brands.filter((brand) => brand.end?.total != null).sort((a, b) => b.end!.total! - a.end!.total!);
    const movers = brands.filter((brand) => brand.change != null).sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!));

    // Summary: the largest of the selected brands at the end, and the largest change.
    if (withTotals.length >= 2) {
      const leader = withTotals[0];
      say("summary", "leader", { brand: brandName(leader.name), range: range(blocks.end), value: count(leader.end!.total!), share: { kind: "pct", value: leader.end!.share! } }, [totals(leader), shares(leader)]);
    }
    if (movers.length) {
      const mover = movers[0];
      say(
        "summary",
        brands.length === 1 ? "single" : "mover",
        { brand: brandName(mover.name), start: range(blocks.start), end: range(blocks.end), from: count(mover.start!.total!), to: count(mover.end!.total!), pct: { kind: "signedPct", value: mover.change! } },
        [totals(mover)],
      );
    }
    if (!movers.length && withTotals.length < 2) say("summary", "noTotals", { start: range(blocks.start), end: range(blocks.end) });

    // Key changes: one per brand, then the category as context.
    for (const brand of brands) {
      if (brand.change != null) {
        say(
          "changes",
          "brand",
          {
            brand: brandName(brand.name),
            from: count(brand.start!.total!),
            to: count(brand.end!.total!),
            pct: { kind: "signedPct", value: brand.change },
            shareFrom: { kind: "pct", value: brand.start!.share! },
            shareTo: { kind: "pct", value: brand.end!.share! },
            pp: { kind: "pp", value: brand.shareChange! },
          },
          [totals(brand), shares(brand)],
        );
      } else {
        say("changes", "partial", {
          brand: brandName(brand.name),
          start: range(blocks.start),
          end: range(blocks.end),
          startListed: { kind: "int", value: brand.start!.listed },
          endListed: { kind: "int", value: brand.end!.listed },
        });
      }
    }
    const marketCites = [marketTotals()];
    if (market.newShareChange != null) {
      const newShares = [cite({ key: "marketNewShares", ...blockPair(market.start.newShare, market.end.newShare, pct) })];
      say(
        "changes",
        "market",
        {
          from: count(market.start.first),
          to: count(market.end.first),
          pct: { kind: "signedPct", value: market.change },
          newFrom: { kind: "pct", value: market.start.newShare! },
          newTo: { kind: "pct", value: market.end.newShare! },
          pp: { kind: "pp", value: market.newShareChange },
        },
        [...marketCites, ...newShares],
      );
    } else {
      say("changes", "marketNoNew", { from: count(market.start.first), to: count(market.end.first), pct: { kind: "signedPct", value: market.change } }, marketCites);
    }

    // Comparison: the selected brands' totals in the last block, then their ranks.
    if (withTotals.length >= 2) {
      say(
        "comparison",
        "order",
        {
          range: range(blocks.end),
          list: { kind: "list", value: withTotals.map((brand) => ({ key: "brandValue", values: { brand: brandName(brand.name), value: count(brand.end!.total!) } })) },
        },
        withTotals.map(totals),
      );
      const [first, second] = withTotals;
      if (second.end!.total! > 0) {
        say(
          "comparison",
          "ratio",
          { first: brandName(first.name), second: brandName(second.name), ratio: { kind: "ratio", value: first.end!.total! / second.end!.total! } },
          [totals(first), totals(second)],
        );
      }
    } else if (brands.length === 1) {
      say("comparison", "single", { brand: brandName(brands[0].name) });
    } else if (withTotals.length === 1) {
      say("comparison", "onlyOne", { range: range(blocks.end), brand: brandName(withTotals[0].name) });
    } else {
      say("comparison", "none", { range: range(blocks.end) });
    }
  } else if (facts.status === "insufficient") {
    say("summary", "insufficient", { months: { kind: "int", value: facts.calendarMonths } });
  }

  // Ranks over the whole window: available in both states.
  const ranked = brands.filter((brand) => brand.best != null);
  if (facts.status !== "empty" && ranked.length) {
    say(
      "comparison",
      "ranks",
      {
        range: range({ from: facts.from, to: facts.to }),
        list: {
          kind: "list",
          value: ranked.map((brand) => ({
            key: brand.best === brand.worst ? "brandRank" : "brandRankRange",
            values: {
              brand: brandName(brand.name),
              best: { kind: "int", value: brand.best! },
              worst: { kind: "int", value: brand.worst! },
              listed: { kind: "int", value: brand.listed },
              months: { kind: "int", value: brand.months },
            },
          })),
        },
      },
      ranked.map(ranksOf),
    );
  }

  // Observation: the month furthest from the brand's median, if far enough.
  if (facts.status !== "empty") {
    const candidates = brands.flatMap((brand) => {
      if (brand.median == null || !brand.peak || !brand.low || brand.median <= 0) return [];
      return [
        { brand, kind: "peak" as const, point: brand.peak, score: brand.peak.value / brand.median },
        { brand, kind: "dip" as const, point: brand.low, score: brand.low.value > 0 ? brand.median / brand.low.value : Infinity },
      ];
    });
    const top = candidates.sort((a, b) => b.score - a.score)[0];
    if (top && top.score >= SPIKE_RATIO) {
      const window = range({ from: facts.from, to: facts.to });
      say(
        "observation",
        top.kind,
        {
          brand: brandName(top.brand.name),
          period: { kind: "period", value: top.point.period },
          value: count(top.point.value),
          median: count(top.brand.median!),
          ratio: { kind: "ratio", value: top.kind === "peak" ? top.score : top.point.value / top.brand.median! },
        },
        [
          cite({ key: "brandMonth", brand: top.brand.name, period: { kind: "period", value: top.point.period }, value: count(top.point.value) }),
          cite({ key: "brandMedian", brand: top.brand.name, period: window, value: count(top.brand.median!) }),
        ],
      );
    } else {
      const steady = brands
        .filter((brand) => brand.listed === brand.months && brand.months >= BLOCK_MONTHS && brand.best != null)
        .sort((a, b) => a.worst! - a.best! - (b.worst! - b.best!))[0];
      if (steady) {
        say(
          "observation",
          steady.best === steady.worst ? "steadyRank" : "steady",
          { brand: brandName(steady.name), months: { kind: "int", value: steady.months }, best: { kind: "int", value: steady.best! }, worst: { kind: "int", value: steady.worst! } },
          [ranksOf(steady)],
        );
      } else {
        say("observation", "none", { threshold: { kind: "ratio", value: SPIKE_RATIO } });
      }
    }
  }

  const limitations: Limitation[] = [];
  if (facts.listSize) {
    limitations.push({ key: facts.listSize.min === facts.listSize.max ? "topListOne" : "topList", values: { min: { kind: "int", value: facts.listSize.min }, max: { kind: "int", value: facts.listSize.max } } });
  }
  limitations.push({ key: "newUsed", values: {} });
  if (facts.gaps.length) {
    limitations.push({ key: "gaps", values: { count: { kind: "int", value: facts.gaps.length }, ranges: { kind: "list", value: runs(facts.gaps).map((run) => ({ key: "gapRange", values: { range: range(run) } })) } } });
  }
  if (facts.status === "ok") limitations.push({ key: "blocks", values: {} });
  limitations.push({ key: "noCause", values: {} });

  return { statements, evidence, limitations };
}

/** Consecutive months grouped into ranges. */
export function runs(months: string[]): Block[] {
  const out: Block[] = [];
  for (const month of [...months].sort()) {
    const last = out[out.length - 1];
    if (last && shiftPeriod(last.to, 1) === month) last.to = month;
    else out.push({ from: month, to: month });
  }
  return out;
}
