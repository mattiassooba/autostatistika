// URL contract for /otsing. Every search is a link:
//   ?category=passenger_car&brands=bmw,audi&models=X5&engine=DIISEL&year=2015..2020&power=100..
// List values are comma-separated register codes; ranges are "min..max" with
// either side optional. Invalid values are dropped, never guessed.

import { NUMBER_FILTERS, TEXT_FILTERS, type NumberFilter, type Range, type SearchFilters, type SortKey, type TextFilter } from "./engine";

export type SearchState = SearchFilters & { sort: SortKey; dir: 1 | -1 };

export const DEFAULT_FAMILY = "passenger_car";
const FAMILY = /^[a-z_]{2,30}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const SORTS: SortKey[] = ["vehicles", "year", "power", "name"];
const MAX_VALUES = 20;
// "category" is the vehicle family; the EU category filter is "eu".
const PARAM: Partial<Record<TextFilter, string>> = { category: "eu" };

function list(value: string | null, valid: (item: string) => boolean = (item) => item.length > 0 && item.length <= 80): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(valid))].slice(0, MAX_VALUES);
}

function range(value: string | null): Range | undefined {
  if (!value) return undefined;
  const match = /^(-?\d+(?:\.\d+)?)?\.\.(-?\d+(?:\.\d+)?)?$/.exec(value);
  if (!match || (match[1] == null && match[2] == null)) return undefined;
  const low = match[1] == null ? null : Number(match[1]);
  const high = match[2] == null ? null : Number(match[2]);
  if (low != null && high != null && low > high) return [high, low];
  return [low, high];
}

export function parseSearch(params: URLSearchParams): SearchState {
  const category = params.get("category");
  const text: SearchFilters["text"] = {};
  for (const key of TEXT_FILTERS) {
    const values = list(params.get(PARAM[key] ?? key));
    if (values.length) text[key] = values;
  }
  const ranges: SearchFilters["ranges"] = {};
  for (const key of NUMBER_FILTERS) {
    const value = range(params.get(key));
    if (value) ranges[key] = value;
  }
  const sort = params.get("sort") as SortKey | null;
  return {
    family: category && FAMILY.test(category) ? category : DEFAULT_FAMILY,
    makes: list(params.get("brands"), (item) => SLUG.test(item)),
    models: list(params.get("models")),
    text,
    ranges,
    sort: sort && SORTS.includes(sort) ? sort : "vehicles",
    dir: params.get("dir") === "asc" ? 1 : -1,
  };
}

function rangeText([low, high]: Range): string {
  return `${low ?? ""}..${high ?? ""}`;
}

export function searchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.family !== DEFAULT_FAMILY) params.set("category", state.family);
  if (state.makes.length) params.set("brands", state.makes.join(","));
  if (state.models.length) params.set("models", state.models.join(","));
  for (const key of TEXT_FILTERS) {
    const values = state.text[key as TextFilter];
    if (values?.length) params.set(PARAM[key as TextFilter] ?? key, values.join(","));
  }
  for (const key of NUMBER_FILTERS) {
    const value = state.ranges[key as NumberFilter];
    if (value && (value[0] != null || value[1] != null)) params.set(key, rangeText(value));
  }
  if (state.sort !== "vehicles") params.set("sort", state.sort);
  if (state.dir === 1) params.set("dir", "asc");
  return params;
}

export function emptySearch(family = DEFAULT_FAMILY): SearchState {
  return { family, makes: [], models: [], text: {}, ranges: {}, sort: "vehicles", dir: -1 };
}

/** Number of active filters (for the "reset" control and the chips row). */
export function activeCount(state: SearchFilters): number {
  return (
    state.makes.length +
    state.models.length +
    Object.values(state.text).reduce((sum, values) => sum + (values?.length ?? 0), 0) +
    Object.values(state.ranges).filter((value) => value && (value[0] != null || value[1] != null)).length
  );
}
