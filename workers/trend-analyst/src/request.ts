// The request body: a selection only (SelectionRequest in
// apps/web/lib/analysis/validate.ts). No text is accepted; the statements are
// rebuilt from the site's trend file. Anything outside these shapes is refused.

import type { SelectionRequest } from "../../../apps/web/lib/analysis/validate";

export const MAX_BODY_BYTES = 2_000;

const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseSelection(body: unknown): SelectionRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const allowed = new Set(["v", "kind", "locale", "generation", "category", "brands", "from", "period", "hash", "fresh"]);
  if (Object.keys(b).some((key) => !allowed.has(key))) return null;
  if (b.v !== 2 || (b.locale !== "et" && b.locale !== "en")) return null;
  // Pages built before the registrations analysis send no kind: they are brand comparisons.
  const kind = b.kind ?? "brands";
  if (kind !== "brands" && kind !== "registrations") return null;
  if (typeof b.generation !== "string" || !/^\d{14}$/.test(b.generation)) return null;
  if (typeof b.category !== "string" || !/^[a-z_]{2,30}$/.test(b.category)) return null;
  if (typeof b.hash !== "string" || !/^[0-9a-f]{64}$/.test(b.hash)) return null;
  if (b.fresh !== undefined && typeof b.fresh !== "boolean") return null;
  const brands = b.brands ?? [];
  const from = b.from ?? null;
  const period = b.period ?? null;
  if (!Array.isArray(brands)) return null;

  if (kind === "brands") {
    if (brands.length < 1 || brands.length > 4) return null;
    if (!brands.every((slug) => typeof slug === "string" && SLUG.test(slug)) || new Set(brands).size !== brands.length) return null;
    if (from !== null && (typeof from !== "string" || !MONTH.test(from))) return null;
    if (period !== null) return null;
  } else {
    if (brands.length !== 0 || from !== null) return null;
    if (typeof period !== "string" || !MONTH.test(period)) return null;
  }
  return {
    v: 2,
    kind,
    locale: b.locale,
    generation: b.generation,
    category: b.category,
    brands: brands as string[],
    from: from as string | null,
    period: period as string | null,
    hash: b.hash,
    fresh: b.fresh === true,
  };
}
