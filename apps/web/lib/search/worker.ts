/// <reference lib="webworker" />
// The /otsing search runs here, off the main thread: the worker loads and
// keeps the decoded files and answers each search with totals, facets and the
// visible page of variants.

import { describeVariant, needsFullFiles, runSearch, sortVariants, variantDetail, type SearchResult, type Variant, type VariantDetail } from "./engine";
import { loadTable, type Manifest } from "./load";
import type { SearchState } from "./url";
import type { Table } from "./format";

export type WorkerRequest =
  | { type: "init"; base: string; manifest: Manifest }
  | { type: "search"; seq: number; state: SearchState; limit: number; allMakes: boolean }
  | { type: "detail"; seq: number; state: SearchState; variant: Variant }
  /** Every variant that matches, sorted as the list is (CSV download). */
  | { type: "export"; seq: number; state: SearchState; allMakes: boolean }
  /** Spec details of several variants side by side, by make and variant id. */
  | { type: "compare"; seq: number; state: SearchState; refs: Array<{ make: string; id: number }> };

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
  | { type: "export"; seq: number; variants: Variant[] }
  | { type: "compare"; seq: number; items: Array<{ variant: Variant; detail: VariantDetail } | null> }
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

type Selection = { tables: Table[]; source: SearchSource } | { needsMakes: number } | null;

/** The files a search reads: the light index, the chosen makes' files, or every make of the type. */
async function select(state: SearchState, allMakes: boolean, seq?: number): Promise<Selection> {
  const family = manifest!.families[state.family];
  if (!family) return null;
  const lite = await loadTable(base, family.lite);
  if (state.makes.length) return { tables: await load(makeFiles(state.makes, state.family), seq), source: "makes" };
  if (!needsFullFiles(state, lite)) return { tables: [lite], source: "lite" };
  const files = familyFiles(state.family);
  if (!allMakes) return { needsMakes: files.reduce((sum, file) => sum + (manifest!.files[file] ?? 0), 0) };
  return { tables: await load(files, seq), source: "all" };
}

async function search(seq: number, state: SearchState, limit: number, allMakes: boolean) {
  const selection = await select(state, allMakes, seq);
  if (!selection) {
    post({ type: "result", seq, source: "lite", options: {}, result: { vehicles: 0, missingForRange: 0, facets: {}, years: [], powerBands: [], variantsTotal: 0, variants: [] } });
    return;
  }
  if ("needsMakes" in selection) {
    post({ type: "needs-makes", seq, bytes: selection.needsMakes });
    return;
  }
  const { tables, source } = selection;
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

async function exportVariants(seq: number, state: SearchState, allMakes: boolean) {
  const selection = await select(state, allMakes);
  const variants = selection && "tables" in selection ? sortVariants(runSearch(selection.tables, state).variants, state.sort, state.dir) : [];
  post({ type: "export", seq, variants });
}

async function compare(seq: number, state: SearchState, refs: Array<{ make: string; id: number }>) {
  // Each variant is read from its make's own file with the page's filters, so
  // the side-by-side figures are the same vehicles the list counted. A link
  // from another snapshot whose id is gone comes back as null.
  const items = await Promise.all(
    refs.map(async ({ make, id }) => {
      const tables = await load(makeFiles([make], state.family));
      const variant = describeVariant(tables, id);
      if (!variant || variant.make !== make) return null;
      const detail = variantDetail(tables, { ...state, makes: [make], models: [] }, id);
      return { variant: { ...variant, vehicles: detail.vehicles }, detail };
    }),
  );
  post({ type: "compare", seq, items });
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    base = message.base;
    manifest = message.manifest;
    return;
  }
  const run =
    message.type === "search"
      ? search(message.seq, message.state, message.limit, message.allMakes)
      : message.type === "detail"
        ? detail(message.seq, message.state, message.variant)
        : message.type === "export"
          ? exportVariants(message.seq, message.state, message.allMakes)
          : compare(message.seq, message.state, message.refs);
  run.catch((error: unknown) => post({ type: "error", seq: message.seq, message: String(error) }));
};
