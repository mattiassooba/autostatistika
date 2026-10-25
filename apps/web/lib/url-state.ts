import { z } from "zod";
import type { DashboardQuery, TabId } from "./data/types";

const tabSchema = z.enum(["registreerimised", "soidukipark", "ulevaatused"]);
const periodSchema = z.string().regex(/^\d{4}-\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const codeSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/);

export function parseQuery(searchParams: Record<string, string | string[] | undefined>): DashboardQuery {
  const tab = tabSchema.safeParse(first(searchParams.tab)).success
    ? (first(searchParams.tab) as TabId)
    : "registreerimised";
  const brands = (first(searchParams.brands) ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => codeSchema.safeParse(item).success)
    .slice(0, 8);
  return {
    tab,
    category: valid(codeSchema, first(searchParams.category)),
    brands: [...new Set(brands)],
    from: valid(periodSchema, first(searchParams.from)),
    to: valid(periodSchema, first(searchParams.to)),
    fuel: valid(codeSchema, first(searchParams.fuel)),
    snapshot: valid(dateSchema, first(searchParams.snapshot)),
    population: valid(codeSchema, first(searchParams.population)),
  };
}

export function toSearchParams(query: DashboardQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tab", query.tab);
  if (query.category) params.set("category", query.category);
  if (query.brands.length) params.set("brands", query.brands.join(","));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.fuel) params.set("fuel", query.fuel);
  if (query.snapshot) params.set("snapshot", query.snapshot);
  if (query.population) params.set("population", query.population);
  return params;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function valid(schema: z.ZodType<string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return schema.safeParse(value).success ? value : undefined;
}
