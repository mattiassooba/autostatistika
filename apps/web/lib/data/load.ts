import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PublishedBundle } from "./types";

// The bundle is ~25 MB. It is parsed once and re-read only when the
// ingestion publishes a new file (mtime change), checked at most every 10 s.
let cache: { bundle: PublishedBundle; mtimeMs: number; checkedAt: number } | null = null;
let pending: Promise<PublishedBundle> | null = null;

const FILE = path.join(process.cwd(), "data", "published", "bundle.json");

export async function loadBundle(): Promise<PublishedBundle> {
  if (cache && Date.now() - cache.checkedAt < 10_000) return cache.bundle;
  if (pending) return pending;
  pending = (async () => {
    const { mtimeMs } = await stat(FILE);
    if (cache && cache.mtimeMs === mtimeMs) {
      cache.checkedAt = Date.now();
      return cache.bundle;
    }
    const bundle = JSON.parse(await readFile(FILE, "utf8")) as PublishedBundle;
    cache = { bundle, mtimeMs, checkedAt: Date.now() };
    return bundle;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
