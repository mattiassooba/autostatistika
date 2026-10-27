# Operations

## Local

```bash
python -m pip install pandas==2.3.3 openpyxl==3.1.5 xlrd==2.0.2 requests==2.32.5 beautifulsoup4==4.14.2 lxml==6.0.2 python-dotenv==1.1.1 pytest==8.4.2
set PYTHONPATH=.
python -m pytest ingestion/tests -q
python -m ingestion backfill --source samples
python -m ingestion discover
python -m ingestion status
python -m ingestion publish
```

Website:

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000/et

## Commands

| Command | Meaning |
| --- | --- |
| `python -m ingestion discover` | Read official HTML, record trusted XLS/XLSX links |
| `python -m ingestion backfill --source samples` | Import the inspected local workbooks |
| `python -m ingestion backfill --source registrations --limit 24` | Download and import recent Infoleht files |
| `python -m ingestion update --all` | Import the newest resource per source |
| `python -m ingestion validate --all` | Summarise import-run statuses |
| `python -m ingestion status` | Heartbeats |
| `python -m ingestion publish` | Rebuild `apps/web/data/published/bundle.json` |

A failed or quarantined import leaves previously published facts in place.

## Full historical backfill

```bash
set PYTHONPATH=.
python scripts/fetch_backfill.py          # download every Infoleht + inspection monthly (polite, trusted hosts, skips cached)
python scripts/diagnose_registrations.py  # optional: per-file parse report -> data/downloads/diagnose_registrations.json
python scripts/run_backfill.py            # import everything in data/downloads/manifest.json, then publish
```

Register snapshots (about 300 MB per date, 1.4 GB for 2020-2026) download to `data/downloads/register_snapshot/`.
`fetch_backfill.py --kinds …` rewrites the manifest with only those kinds; run it without `--kinds` before a full rebuild.

27 Oct 2026 result: 384 files (with the register snapshots and general tables), 383 imported, 1 skipped (`infoleht-0109-27092014.xls` covers 01.09-27.09.2014 only;
the complete September 2014 leaflet supersedes it). Runtime about 4 minutes after download.

Re-importing a file replaces everything that file produced before, so parser fixes never leave stale rows.
When a month has several files (stock leaflet + first-registration leaflet, re-uploads), publishing takes every
fact key from one file only: the newest upload folder in the official URL.

## Vehicle search files

`python scripts/register_index.py build` writes the /otsing files for the latest register snapshot to
`data/register-index/<date>/` (about 29 MB of gzip files, one minute) and `index.json`, which `publish` copies into the
bundle as `registerIndex` (snapshot, checksum, asset name). The weekly job uploads them as one tar to the
`register-index` release (`… upload`, skipped when present); the deploy downloads exactly the asset the bundle names
into `apps/web/public/register/` and fails if it is missing. For a local build run `… build` and `… install`.
The files are not committed (`.gitignore`). A build replaces the snapshot's folder, so files a new build no longer
writes (e.g. a family that became empty) are not packed into the asset.

A change to category, brand or region mapping also changes the search files and so the checksum and asset name.
Rebuild with `… build`, republish the bundle, run `… upload` and only then push: the deploy fails on an asset name
the release does not have. Older assets can be deleted from the release once the live site uses the new one.

## Trend analyst Worker (optional AI wording)

The brand comparison's trend analysis computes everything in the browser (`apps/web/lib/analysis`). To have Claude
word it, deploy `workers/trend-analyst` (Cloudflare Workers, free plan) and point the site at it. The site stays on
GitHub Pages; the Worker holds `ANTHROPIC_API_KEY`, rate-limits, caches and caps the day's calls.

No text from a caller reaches the model. The page sends only a selection (type, up to four brand slugs, start month,
language, data generation) and the SHA-256 of the request it computed. The Worker reads the site's own
`/data/<generation>/trend/<category>.json` (rows and wording from the same build), rebuilds the statements with the
same code (`lib/analysis/build.ts`) and goes on only if the hash matches; unknown brands, other fields and statement
text are refused before any model call. `lib/analysis/build.test.ts` checks that page and Worker build the same
request for real data. A change to `lib/analysis` or the trend messages therefore needs a Worker redeploy: until then
hashes differ and visitors get the computed text.

Order of setup (the key never goes into the repository, a chat or the site build):

1. Anthropic Console: a workspace for this site with a monthly spend limit, and an API key created in it.
2. Local test with real Claude: put the key in `workers/trend-analyst/.dev.vars` (git-ignored) as
   `ANTHROPIC_API_KEY=…`, then `npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:3000` (it reads the trend files
   from the live site; add `--var SITE_ORIGIN:http://localhost:3000` with `npm run preview` for a local build) and
   `npx tsx scripts/live-check.ts`. It reports accepted/rejected answers, token use and cost, forged requests and the
   cache. `npx wrangler dev --var DAILY_LIMIT:2 --persist-to .wrangler/limit-test …` (a fresh day count) with `live-check.ts --limit-test` checks the cap.
3. Cloudflare: `npx wrangler login`, `npx wrangler kv namespace create CACHE` (id into `wrangler.toml`),
   `npx wrangler secret put ANTHROPIC_API_KEY` (typed at the prompt), `npx wrangler deploy`. Run `live-check.ts` against
   the printed URL with `--origin https://autostatistika.ee`.
4. Visitors: set the repository variable `TREND_API_URL` (Settings → Secrets and variables → Actions → Variables) to
   that URL and redeploy the site; `deploy.yml` passes it to the build as `NEXT_PUBLIC_TREND_API_URL`. Unset, the page
   makes no request and shows the computed text. To switch AI off again, delete the variable and redeploy.

```bash
cd workers/trend-analyst
npm install
npm test                 # selection checks, rebuild and hash, validation, cache, limits, daily budget (fake model)
npx wrangler tail        # live log: one JSON line per model call with tokens and outcome
```

- Model `claude-haiku-5-5` (`MODEL` in `wrangler.toml`), effort low, structured JSON output, at most 4 000 tokens
- Limits: 8 requests a minute per IP (Workers rate-limit binding), 2 KB request body, requests only from
  `ALLOWED_ORIGINS` (a browser rule only; the selection-only format is the real protection), and `DAILY_LIMIT` model
  calls per UTC day (500) counted by the `DailyBudget` Durable Object: atomic, so parallel requests cannot pass it.
  Without that binding the Worker makes no model call
- Cost ceiling: the model input is the Worker's own statements for at most four brands (a few thousand tokens) and the
  output at most 4 000 tokens including thinking, so a call costs at most about $0.003 at Haiku 5.5 list prices
  ($0.10 / $0.50 per million tokens), and 500 calls stay under $2 a day; measured use is lower (`live-check.ts`). The
  Anthropic workspace spend limit is the backstop for everything else
- Cache: validated answers in KV for 30 days, keyed by prompt version, model and the request hash (the request carries
  the figures, so new data means a new key). Selections are finite, so repeat visitors are served from the cache at
  no cost and without counting against the cap. "Koosta uuesti" skips the cache read
- Every answer is checked twice with `apps/web/lib/analysis/validate.ts`: in the Worker before caching, and in the page.
  A change to that file should be followed by `npm test` here as well

## Data delivery (web)

The site is a static export (`next build` → `apps/web/out/`). `bundle.json` (~25 MB) is never sent to the browser;
`lib/data/store.ts` indexes it at build time:

- Core payload, rendered into `/et` and `/en`: totals, stock totals, age bands, national inspections, insights, availability catalogue
- One JSON file per slice at `/data/<generation>/<kind>/<arg>.json` (`app/data/[generation]/[kind]/[file]/route.ts`):
  `brands/<category>`, `month/<YYYY-MM>`, `fleet/<YYYY-MM-DD>`, `stations/<YYYY-MM>`. The generation segment
  changes with every bundle, so cached files never mix two generations
- Pages are rendered with the default view; a shared link's query is applied in the browser
- `/` picks `/et` or `/en` from the browser language (no server, so no middleware)

Static pages for search engines, built from the same bundle (`lib/data/pages.ts`):

- `/et/margid`, `/et/margid/<brand>`: brands with at least 12 TOP-list months or 100 new cars. New-car counts use the
  model sheet only in months whose sum matches the stated new-vehicle total (within 1 %); others are left out
- `/et/kuu`, `/et/kuu/<YYYY-MM>`: every registration month
- Share images at `/og/<locale>/{site,brand,month}/<name>.png` (`app/og/...`, Archivo TTFs in `assets/og/`)
- The sitemap lists all of them; the footer links popular brands and recent months from every page

Brand marks: `apps/web/public/logos/*.svg` come from Simple Icons (CC0, pinned in `package.json`) and, for
brands Simple Icons lacks, from Wikimedia Commons files kept in `apps/web/scripts/logo-sources/` (public domain
or CC0; source page and licence per file in `public/logos/NOTICE.md`). `npm run logos` regenerates them and
`lib/brand-logos.ts` (available marks and a weight-balancing scale per mark). Alfa Romeo has no free official
mark and shows a typographic monogram. Add a brand by mapping its slug in `scripts/build-logos.mjs`.

Preview the export locally: `npm run build && npm run preview` (http://localhost:3000/et).

## Hosting

- GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push that touches `apps/web/`
- Repository `mattiassooba/autostatistika` (public: Pages on a private repository needs GitHub Pro)
- Custom domain `autostatistika.ee`, verified in GitHub (account Settings → Pages), HTTPS enforced. DNS at Zone.ee
  (Zone nameservers): apex `A` 185.199.108.153 / .109.153 / .110.153 / .111.153, `AAAA` 2606:50c0:8000::153 …
  8003::153, `www` `CNAME` `mattiassooba.github.io`, plus TXT records for GitHub domain verification
  (`_github-pages-challenge-mattiassooba`) and Google (`google-site-verification=…`). No mail records
- Search: Google Search Console (domain property, `sitemap.xml` submitted 25 Oct 2026); Bing Webmaster Tools imported
  from Search Console
- SEO: `robots.txt`, `sitemap.xml`, canonical + hreflang tags and schema.org `Dataset` JSON-LD are generated by the build
- Supabase is optional. Apply `supabase/migrations/0001_init.sql`. Store service-role keys only in GitHub Actions and the Python environment
- Sentry: set `SENTRY_DSN` when an account exists. The site runs without it

## Alerts and the weekly update

`.github/workflows/ingest.yml` runs Tuesday and Friday 04:17 UTC (and on demand; GitHub can drop a scheduled run, and a run
with nothing new commits nothing). It restores `data/downloads/` from the Actions
cache and any missing register snapshots from the `register-archive` release (`scripts/register_archive.py restore`),
downloads new files, uploads new register snapshots to that release (`… upload`), runs the parser tests, rebuilds the
warehouse from every file, and compares the new bundle with the committed one (`scripts/compare_bundle.py`). The
release exists because the open-data catalogue replaces its monthly register file; `fetch_backfill.py` keeps files the
catalogue no longer lists in the manifest, so a rebuild never loses a snapshot. If the numbers changed, it commits the bundle and redeploys.
The run fails, and nothing is published, if any table would lose rows. Optional `ALERT_WEBHOOK_URL` (repository secret)
receives a POST on failure; GitHub also emails the repository owner.

### Monthly register history

The catalogue lists only the current month's register file, so monthly fleet snapshots exist from 1 October 2026
onwards (before that: 1 January 2020-2026). Each new month is downloaded once, archived to `register-archive`, and kept
in the manifest after the catalogue drops it (`kept_register_files`, tested in `ingestion/tests/test_register_history.py`).
The fleet tab and brand pages plot every register date on a time axis; the search uses the latest one.

- Growth: about 300 MB of CSV per month on the runner and about 55 MB per month in the release (gzip).
- A correction re-uploaded under the same file name is not picked up automatically (the cached copy wins). Delete the
  file from `data/downloads/register_snapshot/` and the release asset, then run the job, to take a corrected file.

## Verifying a data or parser change

1. Run the parser tests: `python -m pytest ingestion/tests -q`.
2. Rebuild into a separate database and publish directory, so the live bundle is untouched:
   `INGESTION_DB=<tmp>/fresh.db PUBLISH_DIR=<tmp>/pub python -m ingestion backfill --source samples` then
   `... python scripts/run_backfill.py`.
3. Diff `<tmp>/pub/bundle.json` against `apps/web/data/published/bundle.json` row by row, grouped by table and month.
   Only the months the change targets may differ. `scripts/compare_bundle.py` gives the summary the weekly job uses.
4. Copy the new bundle into `apps/web/data/published/`, run `npm test` and `npm run build` in `apps/web`, commit, push.

## Local gotchas (Windows)

- Stop any server that serves `apps/web/out/` (e.g. `npm run preview`) before `npm run build`: open files lock the
  folder, and the build then times out on share images.
- Stopping `npx next dev` from a task runner can leave the Next.js child process holding the port; end it by PID.
- The dev server runs React Strict Mode. Motion state on list rows that React re-orders can reset there; hero row
  opacity, dimming and entrance therefore live in CSS classes (`.race-enter`, `.race-in`). Check animations in the
  production build before concluding anything.

## Open questions with the source

- Older register category codes TR, TR1, TR2, RO, TH, TH1: mapped by evidence on 27 Oct 2026 (methodology), an
  email to andmed@transpordiamet.ee asks for their meaning. If the answer differs, change `EU_TO_FAMILY` in
  `ingestion/normalization/categories.py`, the methodology note (`docs/methodology.md`, `method.p.legacyCodes` in
  both message files) and the test, then rebuild the bundle and the search index.

## Unverified until credentials exist

- Supabase Storage archival of original files
- Teabevärav vehicle-level CSV adapters (slug API returned HTTP 500 on 25 Oct 2026)
- AI phrasing of insights (deterministic text is always produced)
