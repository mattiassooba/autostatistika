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

25 Oct 2026 result: 370 files, 369 imported, 1 skipped (`infoleht-0109-27092014.xls` covers 01.09-27.09.2014 only;
the complete September 2014 leaflet supersedes it). Runtime about 2 minutes after download.

Re-importing a file replaces everything that file produced before, so parser fixes never leave stale rows.
When a month has several files (stock leaflet + first-registration leaflet, re-uploads), publishing takes every
fact key from one file only: the newest upload folder in the official URL.

## Vehicle search files

`python scripts/register_index.py build` writes the /otsing files for the latest register snapshot to
`data/register-index/<date>/` (about 29 MB of gzip files, one minute) and `index.json`, which `publish` copies into the
bundle as `registerIndex` (snapshot, checksum, asset name). The weekly job uploads them as one tar to the
`register-index` release (`… upload`, skipped when present); the deploy downloads exactly the asset the bundle names
into `apps/web/public/register/` and fails if it is missing. For a local build run `… build` and `… install`.
The files are not committed (`.gitignore`).

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

`.github/workflows/ingest.yml` runs Tuesday 04:17 UTC (and on demand). It restores `data/downloads/` from the Actions
cache and any missing register snapshots from the `register-archive` release (`scripts/register_archive.py restore`),
downloads new files, uploads new register snapshots to that release (`… upload`), runs the parser tests, rebuilds the
warehouse from every file, and compares the new bundle with the committed one (`scripts/compare_bundle.py`). The
release exists because the open-data catalogue replaces its monthly register file; `fetch_backfill.py` keeps files the
catalogue no longer lists in the manifest, so a rebuild never loses a snapshot. If the numbers changed, it commits the bundle and redeploys.
The run fails, and nothing is published, if any table would lose rows. Optional `ALERT_WEBHOOK_URL` (repository secret)
receives a POST on failure; GitHub also emails the repository owner.

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

## Unverified until credentials exist

- Supabase Storage archival of original files
- Teabevärav vehicle-level CSV adapters (slug API returned HTTP 500 on 25 Oct 2026)
- AI phrasing of insights (deterministic text is always produced)
