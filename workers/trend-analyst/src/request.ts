// The request body: a selection only (SelectionRequest in
// apps/web/lib/analysis/validate.ts). No text is accepted; the statements are
// rebuilt from the site's trend file. Anything outside these shapes is refused.

import type { SelectionRequest } from "../../../apps/web/lib/analysis/validate";

export const MAX_BODY_BYTES = 2_000;

const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function parseSelection(body: unknown): SelectionRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const allowed = new Set(["v", "locale", "generation", "category", "brands", "from", "hash", "fresh"]);
  if (Object.keys(b).some((key) => !allowed.has(key))) return null;
  if (b.v !== 2 || (b.locale !== "et" && b.locale !== "en")) return null;
  if (typeof b.generation !== "string" || !/^\d{14}$/.test(b.generation)) return null;
  if (typeof b.category !== "string" || !/^[a-z_]{2,30}$/.test(b.category)) return null;
  if (!Array.isArray(b.brands) || b.brands.length < 1 || b.brands.length > 4) return null;
  if (!b.brands.every((slug) => typeof slug === "string" && SLUG.test(slug)) || new Set(b.brands).size !== b.brands.length) return null;
  if (b.from !== null && (typeof b.from !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.from))) return null;
  if (typeof b.hash !== "string" || !/^[0-9a-f]{64}$/.test(b.hash)) return null;
  if (b.fresh !== undefined && typeof b.fresh !== "boolean") return null;
  return {
    v: 2,
    locale: b.locale,
    generation: b.generation,
    category: b.category,
    brands: b.brands as string[],
    from: b.from as string | null,
    hash: b.hash,
    fresh: b.fresh === true,
  };
}
