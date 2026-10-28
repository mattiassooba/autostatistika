// Trend analysis for the registrations history: the selected month of one vehicle
// type against the same month a year earlier, the last 12 months against the 12
// before, the new and used split, and where the month stands among the same
// calendar month in earlier years. Every number is computed here from the type's
// monthly general-table totals (the history chart's rows); a month the source
// does not state stays missing and is never counted as zero.
//
// The statements use the same shapes as trend.ts, so render.ts, validate.ts and
// the Worker handle both analyses alike.

import type { RegistrationPoint } from "../data/views";
import { shiftPeriod } from "../format";
import type { EvidenceRow, Limitation, Section, Statement, TrendStatements, Value } from "./trend";
import { runs } from "./trend";

/** A month is "highest/lowest since" only when the earlier record is at least this many years back. */
export const SEASON_MIN_YEARS = 3;

type Point = RegistrationPoint;

export type RegistrationFacts = {
  status: "ok" | "insufficient" | "empty";
  category: string;
  period: string;
  month: Point | null;
  yearAgo: Point | null;
  rolling: {
    last: { from: string; to: string; first: number; neu: number | null };
    previous: { from: string; to: string; first: number; neu: number | null };
  } | null;
  /** The same calendar month in earlier years, with a stated first-registration count. */
  sameMonth: Array<{ period: string; first: number }>;
  gaps: string[]; // months in the 24 months up to the selected one without a stated total
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const pct = (from: number, to: number) => ((to - from) / from) * 100;
// Shares and percentage points as shown (one decimal), as in trend.ts.
const shown = (share: number) => Math.round(share * 10) / 10;

export function registrationFacts(series: Point[], category: string, period: string): RegistrationFacts {
  const byPeriod = new Map(series.map((point) => [point.period, point]));
  const month = byPeriod.get(period) ?? null;
  const stated = (p: string) => {
    const point = byPeriod.get(p);
    return point && point.first != null ? point : null;
  };
  const yearAgo = stated(shiftPeriod(period, -12));

  const block = (to: string) => {
    const months = Array.from({ length: 12 }, (_, i) => shiftPeriod(to, -11 + i));
    const points = months.map(stated);
    if (points.some((point) => !point)) return null;
    const firsts = points.map((point) => point!.first!);
    const neus = points.map((point) => point!.neu);
    return {
      from: months[0],
      to: months[11],
      first: sum(firsts),
      neu: neus.every((value) => value != null) ? sum(neus as number[]) : null,
    };
  };
  const last = month?.first != null ? block(period) : null;
  const previous = last ? block(shiftPeriod(period, -12)) : null;

  // The type's data starts at its first stated month (mopeds: 06/2012); earlier months are not gaps.
  const start = series.find((point) => point.first != null)?.period ?? period;
  const sameMonth: RegistrationFacts["sameMonth"] = [];
  for (let back = 1; ; back++) {
    const p = shiftPeriod(period, -12 * back);
    if (p < start) break;
    const point = stated(p);
    if (point) sameMonth.push({ period: p, first: point.first! });
  }

  const span = Array.from({ length: 24 }, (_, i) => shiftPeriod(period, -23 + i)).filter((p) => p >= start);
  return {
    status: month?.first == null ? "empty" : yearAgo || previous ? "ok" : "insufficient",
    category,
    period,
    month,
    yearAgo,
    rolling: last && previous && previous.first > 0 ? { last, previous } : null,
    sameMonth,
    gaps: span.filter((p) => !stated(p)),
  };
}

const count = (value: number): Value => ({ kind: "count", value });
const share = (value: number): Value => ({ kind: "pct", value });
const signed = (value: number): Value => ({ kind: "signedPct", value });
const month = (value: string): Value => ({ kind: "period", value });
const range = (from: string, to: string): Value => ({ kind: "range", value: { from, to } });
const change = (from: Value, to: Value): Value => ({ kind: "change", from, to });

export function registrationStatements(facts: RegistrationFacts): TrendStatements {
  const statements: Statement[] = [];
  const evidence: EvidenceRow[] = [];
  const ids = new Map<string, string>();
  const cite = (row: Omit<EvidenceRow, "id">) => {
    const signature = JSON.stringify(row);
    let id = ids.get(signature);
    if (!id) {
      id = `e${evidence.length + 1}`;
      ids.set(signature, id);
      evidence.push({ id, ...row });
    }
    return id;
  };
  const say = (section: Section, key: string, values: Record<string, Value>, cites: string[] = []) =>
    statements.push({ id: `s${statements.length + 1}`, section, key, values, evidence: cites });

  const { month: m, yearAgo: y, rolling, period } = facts;
  const limitations: Limitation[] = [{ key: "regDefinition", values: {} }];
  if (facts.status === "empty" || !m || m.first == null) return { statements, evidence, limitations };

  // Evidence: one row per figure, as a pair (a year earlier → selected month) where both exist.
  const yearPeriod = shiftPeriod(period, -12);
  const pairOrMonth = (key: string, now: number | null, before: number | null | undefined, as: (n: number) => Value) =>
    now == null
      ? null
      : cite(
          before != null
            ? { key, period: change(month(yearPeriod), month(period)), value: change(as(before), as(now)) }
            : { key, period: month(period), value: as(now) },
        );
  const newShareNow = m.neu != null ? m.newShare : null;
  const newShareBefore = y?.neu != null ? y.newShare : null;
  const privateNow = m.neu && m.privateNew != null ? (m.privateNew / m.neu) * 100 : null;
  const privateBefore = y?.neu && y.privateNew != null ? (y.privateNew / y.neu) * 100 : null;

  // Rows are created when a statement cites them, so no figure is listed that no sentence uses.
  const eFirst = pairOrMonth("regFirst", m.first, y?.first, count)!;
  const eNew = () => pairOrMonth("regNew", m.neu, y?.neu, count)!;
  const eUsed = () => pairOrMonth("regUsed", m.used, y?.used, count)!;
  const eNewShare = () => pairOrMonth("regNewShare", newShareNow, newShareBefore, share)!;
  const ePrivate = () => pairOrMonth("regPrivateShare", privateNow, privateBefore, share)!;

  // Summary: the month, its new share, and the change from a year earlier.
  if (m.neu != null && newShareNow != null) {
    say("summary", "regMonth", { period: month(period), value: count(m.first), neu: count(m.neu), share: share(newShareNow) }, [eFirst, eNew(), eNewShare()]);
  } else {
    say("summary", "regMonthNoNew", { period: month(period), value: count(m.first) }, [eFirst]);
  }
  if (y?.first) {
    say("summary", "regYearAgo", { before: month(yearPeriod), from: count(y.first), pct: signed(pct(y.first, m.first)) }, [eFirst]);
  } else {
    say("summary", "regNoYearAgo", { before: month(yearPeriod) });
  }

  if (facts.status === "ok") {
    // Key changes: month against the same month a year earlier, then 12 months against 12.
    if (y?.first) {
      say("changes", "regFirst", { before: month(yearPeriod), period: month(period), from: count(y.first), to: count(m.first), pct: signed(pct(y.first, m.first)) }, [eFirst]);
      if (y.neu && m.neu != null) say("changes", "regNew", { from: count(y.neu), to: count(m.neu), pct: signed(pct(y.neu, m.neu)) }, [eNew()]);
      if (y.used && m.used != null) say("changes", "regUsed", { from: count(y.used), to: count(m.used), pct: signed(pct(y.used, m.used)) }, [eUsed()]);
    }
    if (rolling) {
      const { last, previous } = rolling;
      const eRolling = cite({ key: "regRolling", period: change(range(previous.from, previous.to), range(last.from, last.to)), value: change(count(previous.first), count(last.first)) });
      say(
        "changes",
        "regRolling",
        { prevRange: range(previous.from, previous.to), range: range(last.from, last.to), from: count(previous.first), to: count(last.first), pct: signed(pct(previous.first, last.first)) },
        [eRolling],
      );
    }

    // Comparison: the new/used split and new cars to private owners.
    if (newShareNow != null && newShareBefore != null) {
      say("comparison", "regNewShare", { before: month(yearPeriod), period: month(period), from: share(newShareBefore), to: share(newShareNow), pp: { kind: "pp", value: shown(newShareNow) - shown(newShareBefore) } }, [eNewShare()]);
    }
    if (rolling && rolling.last.neu != null && rolling.previous.neu != null) {
      const { last, previous } = rolling;
      const before = (previous.neu! / previous.first) * 100;
      const now = (last.neu! / last.first) * 100;
      const eRollingShare = cite({ key: "regRollingShare", period: change(range(previous.from, previous.to), range(last.from, last.to)), value: change(share(before), share(now)) });
      say("comparison", "regRollingShare", { from: share(before), to: share(now), pp: { kind: "pp", value: shown(now) - shown(before) } }, [eRollingShare]);
    }
    if (privateNow != null && privateBefore != null) {
      say("comparison", "regPrivate", { from: share(privateBefore), to: share(privateNow), pp: { kind: "pp", value: shown(privateNow) - shown(privateBefore) } }, [ePrivate()]);
    }
    if (!statements.some((s) => s.section === "comparison")) say("comparison", "regNoSplit", {});

    // Observation: the month among the same calendar month in earlier years.
    const earlier = facts.sameMonth;
    if (earlier.length >= SEASON_MIN_YEARS) {
      // `earlier` runs back in time: the first entry above (below) the month is the last time it was higher (lower).
      const current = m.first;
      const firstYear = earlier[earlier.length - 1].period;
      const values = earlier.map((e) => e.first);
      const higher = earlier.find((e) => e.first > current);
      const lower = earlier.find((e) => e.first < current);
      const tied = values.includes(current);
      const yearsBack = (p: string) => Number(period.slice(0, 4)) - Number(p.slice(0, 4));
      const eRange = cite({ key: "regSameMonth", period: range(firstYear, yearPeriod), value: change(count(Math.min(...values)), count(Math.max(...values))) });
      if (!higher && !tied) {
        say("observation", "regSeasonTop", { period: month(period), value: count(current), years: { kind: "int", value: earlier.length + 1 }, firstYear: month(firstYear) }, [eFirst, eRange]);
      } else if (!lower && !tied) {
        say("observation", "regSeasonBottom", { period: month(period), value: count(current), years: { kind: "int", value: earlier.length + 1 }, firstYear: month(firstYear) }, [eFirst, eRange]);
      } else if (higher && !earlier.slice(0, earlier.indexOf(higher)).some((e) => e.first === current) && yearsBack(higher.period) >= SEASON_MIN_YEARS) {
        const eSince = cite({ key: "regSince", period: month(higher.period), value: count(higher.first) });
        say("observation", "regSeasonHigh", { period: month(period), value: count(current), since: month(higher.period), sinceValue: count(higher.first) }, [eFirst, eSince]);
      } else if (lower && !earlier.slice(0, earlier.indexOf(lower)).some((e) => e.first === current) && yearsBack(lower.period) >= SEASON_MIN_YEARS) {
        const eSince = cite({ key: "regSince", period: month(lower.period), value: count(lower.first) });
        say("observation", "regSeasonLow", { period: month(period), value: count(m.first), since: month(lower.period), sinceValue: count(lower.first) }, [eFirst, eSince]);
      } else {
        say("observation", "regSeasonRange", { period: month(period), value: count(m.first), years: { kind: "int", value: earlier.length }, min: count(Math.min(...values)), max: count(Math.max(...values)) }, [eFirst, eRange]);
      }
    } else {
      say("observation", "regSeasonShort", { years: { kind: "int", value: earlier.length } });
    }
    limitations.push({ key: "regRollingNote", values: {} });
  }

  if (facts.gaps.length) {
    limitations.push({ key: "regGaps", values: { count: { kind: "int", value: facts.gaps.length }, ranges: { kind: "list", value: runs(facts.gaps).map((run) => ({ key: "gapRange", values: { range: { kind: "range", value: run } } })) } } });
  }
  limitations.push({ key: "noCause", values: {} });
  return { statements, evidence, limitations };
}
