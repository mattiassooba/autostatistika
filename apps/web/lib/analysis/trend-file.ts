// The trend file: everything the analysis of one vehicle type needs, written at
// build time to /data/<generation>/trend/<category>.json. The trend-analyst Worker
// reads it to rebuild the page's statements (build.ts); the page itself does not
// load it. The trend messages travel with the data so that wording and figures
// always come from the same build.

import type { ExplorerData, PublishedBundle } from "../data/types";
import { decodeTable, encodeTable, type EncodedTable } from "../data/table";
import type { Translate } from "./render";

type Messages = Record<string, unknown>;

export type TrendFile = {
  generatedAt: string;
  category: string;
  brandPeriods: string[];
  tables: { totals: EncodedTable; brands: EncodedTable };
  messages: Record<"et" | "en", { trend: Messages; categories: Record<string, string> }>;
};

export function trendFile(
  bundle: Pick<PublishedBundle, "generatedAt" | "registrations">,
  category: string,
  brandPeriods: string[],
  messages: Record<"et" | "en", { trend: Messages; categories: Record<string, string> }>,
): TrendFile {
  const reg = bundle.registrations;
  return {
    generatedAt: bundle.generatedAt,
    category,
    brandPeriods,
    tables: {
      totals: encodeTable(reg.totals.filter((row) => row.category_code === category), ["reporting_period", "category_code", "metric_code", "value"]),
      brands: encodeTable(reg.brands.filter((row) => row.category_code === category), ["reporting_period", "category_code", "brand_slug", "brand_source", "value"]),
    },
    messages,
  };
}

/** The file as explorer data for build.ts: same rows and month catalogue as the page. */
export function trendFileData(file: TrendFile): ExplorerData & { catalog: { brandPeriods: Record<string, string[]> } } {
  return {
    generatedAt: file.generatedAt,
    disclaimer: { et: "", en: "" },
    insights: [],
    registrations: { totals: decodeTable(file.tables.totals), brands: decodeTable(file.tables.brands), fuels: [], models: [], breakdowns: [] },
    fleet: { snapshots: [], brands: [], regions: [], ages: [] },
    inspections: { national: [], stations: [] },
    catalog: { brandPeriods: { [file.category]: file.brandPeriods } },
  } as unknown as ExplorerData & { catalog: { brandPeriods: Record<string, string[]> } };
}

/**
 * A translator over the trend messages. They use plain "{name}" placeholders
 * only, so this gives the same text as next-intl (tested in build.test.ts).
 */
export function messageTranslator(messages: Messages): Translate {
  return (key, values = {}) => {
    const message = key.split(".").reduce<unknown>((node, part) => (node as Messages | undefined)?.[part], messages);
    if (typeof message !== "string") throw new Error(`missing message trend.${key}`);
    return message.replace(/\{(\w+)\}/g, (_, name: string) => {
      if (!(name in values)) throw new Error(`missing value ${name} for trend.${key}`);
      return values[name];
    });
  };
}
