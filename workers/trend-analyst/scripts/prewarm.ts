// Pre-writes the AI wording of the default trend card: the registrations
// analysis of the newest month, for every vehicle type and both languages.
// Visitors open the explorer on that month, so the card then answers at once
// from the Worker's cache, and those views do not count against the daily cap.
//
//   npx tsx scripts/prewarm.ts <worker-url> [--origin https://autostatistika.ee]
//
// Run after every site deploy (deploy.yml). Selections already cached cost
// nothing; a new month costs one model call per type and language (about 16).
// It never fails the deploy: problems are reported as warnings.

import { readFileSync } from "node:fs";
import type { ExplorerData, PublishedBundle } from "../../../apps/web/lib/data/types";
import { registrationCategoriesOf, registrationPeriodsOf } from "../../../apps/web/lib/data/views";
import { generationId } from "../../../apps/web/lib/data/slices";
import { buildRegistrationTrend } from "../../../apps/web/lib/analysis/build";
import { messageTranslator, trendFile, trendFileData, type TrendFile } from "../../../apps/web/lib/analysis/trend-file";
import { requestHash, type SelectionRequest } from "../../../apps/web/lib/analysis/validate";

const args = process.argv.slice(2);
const url = args.find((arg) => /^https?:/.test(arg));
const origin = args.includes("--origin") ? args[args.indexOf("--origin") + 1] : "https://autostatistika.ee";
const SPACING_MS = 8_000; // stays under the Worker's 8 requests a minute per IP
const GENERATION_RETRIES = 10; // the new data files can take a minute or two to appear on Pages

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!url) {
    console.log("No Worker URL given; nothing to pre-write.");
    return;
  }
  const web = new URL("../../../apps/web/", import.meta.url);
  const bundle = JSON.parse(readFileSync(new URL("data/published/bundle.json", web), "utf-8")) as PublishedBundle;
  const explorer = { ...bundle, insights: [] } as unknown as ExplorerData;
  const messages = Object.fromEntries(
    (["et", "en"] as const).map((locale) => {
      const all = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, web), "utf-8"));
      return [locale, { trend: all.trend, categories: all.categories }];
    }),
  ) as TrendFile["messages"];
  const periods = registrationPeriodsOf(explorer);
  const period = periods[periods.length - 1]; // the month the explorer opens on
  const generation = generationId(bundle.generatedAt);
  console.log(`Pre-writing the registrations analysis for ${period} (data generation ${generation}).`);

  const outcomes: string[] = [];
  for (const category of registrationCategoriesOf(explorer)) {
    const brandPeriods = [...new Set(bundle.registrations.brands.filter((r) => r.category_code === category).map((r) => r.reporting_period))].sort();
    const data = trendFileData(trendFile(bundle, category, brandPeriods, messages));
    for (const locale of ["et", "en"] as const) {
      const { facts, rendered } = buildRegistrationTrend(data, { locale, category, period }, messages[locale].categories[category], messageTranslator(messages[locale].trend));
      const label = `${category} ${locale}`;
      if (facts.status !== "ok") {
        outcomes.push(`${label}: skipped (${facts.status})`);
        continue;
      }
      const body: SelectionRequest = { v: 2, kind: "registrations", locale, generation, category, brands: [], from: null, period, hash: await requestHash(rendered.request) };
      let outcome = "";
      for (let attempt = 0; attempt <= GENERATION_RETRIES; attempt++) {
        const response = await fetch(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
        const answer = response ? await response.json().catch(() => ({})) : {};
        if (response?.status === 409 && answer.error === "generation") {
          outcome = "site data not published yet";
          await wait(30_000);
          continue;
        }
        if (response?.status === 429) {
          await wait(60_000);
          continue;
        }
        outcome = !response ? "Worker unreachable" : response.ok ? (answer.cached ? "already cached" : "written") : `${response.status} ${answer.reason ?? answer.error ?? ""}`;
        break;
      }
      outcomes.push(`${label}: ${outcome}`);
      await wait(SPACING_MS);
    }
  }
  for (const line of outcomes) console.log(`  ${line}`);
  const problems = outcomes.filter((line) => !/already cached|written|skipped/.test(line));
  if (problems.length) console.log(`::warning::Trend pre-write: ${problems.length} selection(s) not cached; visitors get them on demand.`);
}

main().catch((error) => {
  console.log(`::warning::Trend pre-write failed: ${error instanceof Error ? error.message : String(error)}`);
});
