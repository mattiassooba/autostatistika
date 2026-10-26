/// <reference lib="webworker" />
// The /otsing search runs here, off the main thread: the worker loads and
// keeps the decoded files and answers each search with totals, facets and the
// visible page of variants.

import { needsFullFiles, runSearch, sortVariants, variantDetail, type SearchResult, type Variant, type VariantDetail } from "./engine";
import { loadTable, type Manifest } from "./load";
import type { SearchState } from "./url";
import type { Table } from "./format";

export type WorkerRequest =
  | { type: "init"; base: string; manifest: Manifest }
  | { type: "search"; seq: number; state: SearchState; limit: number; allMakes: boolean }
  | { type: "detail"; seq: number; state: SearchState; variant: Variant };

export type SearchSource = "lite" | "makes" | "all";

export type WorkerResponse =
  | { type: "loading"; seq: number; files: number; bytes: number }
  | {
      type: "result";
      seq: number;
      source: SearchSource;
      result: Omit<SearchResult, "variants"> & { variantsTotal: number; variants: Variant[] };
      /** Every value of each dimension before filtering (family or chosen makes), for the pickers. */
      options: SearchResult["facets"];
    }
  /** A filter needs the makes' own files and no make is chosen. */
  | { type: "needs-makes"; seq: number; bytes: number }
  | { type: "detail"; seq: number; detail: VariantDetail }
  | { type: "error"; seq: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let base = "";
let manifest: Manifest | null = null;
const optionCache = new Map<string, SearchResult["facets"]>();

function options(key: string, tables: Table[], state: SearchState): SearchResult["facets"] {
  let cached = optionCache.get(key);
  if (!cached) {
    cached = runSearch(tables, { family: state.family, makes: state.makes, models: [], text: {}, ranges: {} }).facets;
    optionCache.set(key, cached);
  }
  return cached;
}

function post(message: WorkerResponse) {
  scope.postMessage(message);
}

function makeFiles(slugs: string[], family: string): string[] {
  const wanted = new Set(slugs);
  return [...new Set(manifest!.makes.filter((make) => wanted.has(make.slug) && make.families[family]).map((make) => make.file))];
}

function familyFiles(family: string): string[] {
  return [...new Set(manifest!.makes.filter((make) => make.families[family]).map((make) => make.file))];
}

/** Loads files; a search (not a variant's detail) reports what it is loading. */
async function load(files: string[], seq?: number): Promise<Table[]> {
  if (seq != null) post({ type: "loading", seq, files: files.length, bytes: files.reduce((sum, file) => sum + (manifest!.files[file] ?? 0), 0) });
  return Promise.all(files.map((file) => loadTable(base, file)));
}

async function search(seq: number, state: SearchState, limit: number, allMakes: boolean) {
  const family = manifest!.families[state.family];
  if (!family) {
    post({ type: "result", seq, source: "lite", options: {}, result: { vehicles: 0, missingForRange: 0, facets: {}, years: [], powerBands: [], variantsTotal: 0, variants: [] } });
    return;
  }
  const lite = await loadTable(base, family.lite);
  let tables: Table[] = [lite];
  let source: SearchSource = "lite";
  if (state.makes.length) {
    tables = await load(makeFiles(state.makes, state.family), seq);
    source = "makes";
  } else if (needsFullFiles(state, lite)) {
    const files = familyFiles(state.family);
    if (!allMakes) {
      post({ type: "needs-makes", seq, bytes: files.reduce((sum, file) => sum + (manifest!.files[file] ?? 0), 0) });
      return;
    }
    tables = await load(files, seq);
    source = "all";
  }
  const optionKey = `${state.family}|${source}|${[...state.makes].sort().join(",")}`;
  const choices = options(optionKey, tables, state);
  const { variants, ...rest } = runSearch(tables, state);
  // The model list is only useful once makes are chosen; otherwise keep the top models.
  if (!state.makes.length && rest.facets.model) rest.facets.model = rest.facets.model.slice(0, 50);
  post({
    type: "result",
    seq,
    source,
    options: choices,
    result: { ...rest, variantsTotal: variants.length, variants: sortVariants(variants, state.sort, state.dir).slice(0, limit) },
  });
}

async function detail(seq: number, state: SearchState, variant: Variant) {
  const tables = await load(makeFiles([variant.make], state.family));
  post({ type: "detail", seq, detail: variantDetail(tables, { ...state, makes: [variant.make] }, variant.id) });
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    base = message.base;
    manifest = message.manifest;
    return;
  }
  const run = message.type === "search" ? search(message.seq, message.state, message.limit, message.allMakes) : detail(message.seq, message.state, message.variant);
  run.catch((error: unknown) => post({ type: "error", seq: message.seq, message: String(error) }));
};
