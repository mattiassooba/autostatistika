import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTranslator } from "next-intl";
import { getCore, getSlice, getTrendFile, trendCategories } from "../data/store";
import { buildExplorerData, type SlicePayload } from "../data/slices";
import { shiftPeriod } from "../format";
import et from "../../messages/et.json";
import en from "../../messages/en.json";
import { buildTrend } from "./build";
import type { Translate } from "./render";
import { messageTranslator, trendFileData } from "./trend-file";
import { requestHash, type AnalysisRequest } from "./validate";

// The Worker rebuilds the page's statements from the trend file and goes on only
// when the hashes match. Here both paths run on the real bundle: the page's
// (core payload + brand slice, next-intl's translator) and the Worker's (trend
// file, plain translator). They must give the same request, byte for byte.

const messages = { et, en };

async function pagePath(category: string) {
  const core = await getCore();
  const slice = (await getSlice(`brands:${category}`)) as SlicePayload;
  // The page may hold other categories' slices too; they must not change the result.
  const other = (await getSlice(`brands:${category === "truck" ? "passenger_car" : "truck"}`)) as SlicePayload;
  return buildExplorerData(core, [slice, other]);
}

describe("page and Worker build the same request", () => {
  it("for every category, several selections, windows and both languages", async () => {
    const selections: Record<string, string[][]> = {
      passenger_car: [["bmw", "toyota", "skoda"], ["tesla", "volvo", "kia", "audi"], ["volkswagen"]],
      truck: [["volvo", "scania", "man", "daf"]],
    };
    assert.deepEqual((await trendCategories()).sort(), Object.keys(selections).sort());
    let compared = 0;
    for (const [category, brandSets] of Object.entries(selections)) {
      const page = await pagePath(category);
      const file = await getTrendFile(category);
      assert.ok(file);
      const worker = trendFileData(JSON.parse(JSON.stringify(file)));
      const latest = file.brandPeriods[file.brandPeriods.length - 1];
      for (const brands of brandSets) {
        for (const years of [2, 5, 10, null]) {
          const from = years ? shiftPeriod(latest, -(years * 12 - 1)) : null;
          for (const locale of ["et", "en"] as const) {
            const intl = createTranslator({ locale, messages: messages[locale], namespace: "trend" });
            const pageT: Translate = (key, values) => intl(key as never, values as never);
            const label = messages[locale].categories[category as keyof typeof et.categories];
            const fromPage: AnalysisRequest = buildTrend(page, { locale, category, brands, from }, label, pageT).rendered.request;
            const fromWorker: AnalysisRequest = buildTrend(worker, { locale, category, brands, from }, file.messages[locale].categories[category], messageTranslator(file.messages[locale].trend)).rendered.request;
            assert.deepEqual(fromWorker, fromPage, `${category} ${brands} ${years} ${locale}`);
            assert.equal(await requestHash(fromWorker), await requestHash(fromPage));
            compared += 1;
          }
        }
      }
    }
    assert.equal(compared, 32);
  });

  it("a different selection gives a different hash", async () => {
    const file = (await getTrendFile("passenger_car"))!;
    const data = trendFileData(file);
    const t = messageTranslator(file.messages.et.trend);
    const a = buildTrend(data, { locale: "et", category: "passenger_car", brands: ["bmw"], from: null }, "Sõiduautod", t).rendered.request;
    const b = buildTrend(data, { locale: "et", category: "passenger_car", brands: ["audi"], from: null }, "Sõiduautod", t).rendered.request;
    assert.notEqual(await requestHash(a), await requestHash(b));
  });
});
