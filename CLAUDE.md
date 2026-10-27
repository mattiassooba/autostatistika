# Autostatistika.ee: notes for Claude

Estonian vehicle statistics from Transpordiamet files, published at https://autostatistika.ee. Read `README.md`
first, then `docs/architecture.md`, `docs/methodology.md` and `docs/operations.md`.

## Hard rules

- **Never invent or estimate numbers.** Missing is not zero; months without data stay empty or hatched; every share
  names its denominator. If a figure needs data the bundle does not have, say so instead of approximating.
- **Static only.** The site is a Next.js static export on GitHub Pages: no API routes, middleware, server rendering per
  request or redirects at runtime. Do not suggest Vercel or other hosts (the owner chose GitHub Pages).
- **Estonian first.** User-facing copy lives in `apps/web/messages/et.json` and `en.json`; add both. URL segments are
  Estonian in both locales (`/en/margid/bmw`).
- **Pushing to `main` deploys the live site** (`.github/workflows/deploy.yml`). Build and test before pushing.
- Brand marks only from free official sources (Simple Icons CC0, Wikimedia Commons PD/CC0); never redraw a logo.
  Non-commercial icon sets (e.g. Custom Brand Icons) are not allowed.

## Layout

- `ingestion/`: Python CLI and parsers (`parsers/registrations.py` is the busiest); tests in `ingestion/tests/`
- `scripts/`: backfill (`fetch_backfill.py`, `run_backfill.py`), `compare_bundle.py`
- `apps/web/`: Next.js app. Data: `lib/data/` (`store.ts` slices, `views.ts` explorer views, `pages.ts` brand/month
  read models). Hero: `components/hero/`. Static pages: `app/[locale]/margid`, `app/[locale]/kuu`.
- `apps/web/data/published/bundle.json`: the published data, committed (~25 MB)
- `data/`: local warehouse and downloaded source files (not committed)

## Commands

```bash
python -m pytest ingestion/tests -q                      # repo root, PYTHONPATH=.
cd apps/web && npm test && npx tsc --noEmit -p . && npx next lint && npm run build
npm run preview                                          # serves apps/web/out on :3000
npm run logos                                            # regenerate public/logos + lib/brand-logos.ts
```

## Verifying changes

- Data or parser changes: rebuild into a temporary DB/publish dir and diff against the committed bundle per table and
  month (see `docs/operations.md`). Only the intended months may change.
- Category, brand or region mapping changes also change the /otsing search files: rebuild the index and upload the
  new release asset before pushing (`docs/operations.md`, "Vehicle search files").
- A source code without an official definition stays unclassified unless the evidence is documented in
  `docs/methodology.md` and on the site's methodology note.
- UI changes: check the production build in a real browser at 1440×900, 1920×1080 and 390px, with hover, keyboard,
  touch and reduced motion. The dev server (React Strict Mode) can show motion glitches the build does not have.
- Stop servers serving `apps/web/out/` before building on Windows (locked files make the build hang).
