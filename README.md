# Autostatistika.ee

Bilingual (Estonian/English) explorer for official Estonian vehicle statistics. Registrations, the vehicle fleet and
technical inspections are imported from Transpordiamet files, validated, then published as aggregates. The site does
not invent numbers.

- Live: https://autostatistika.ee (GitHub Pages, static export)
- Repository: https://github.com/mattiassooba/autostatistika (public)

Autostatistika is not an official service of Transpordiamet or the Estonian government.

## Coverage (rebuilt 26 Oct 2026)

- Registrations: every month 2006-01 to 2026-09 (249), brand rankings for 236 months, fuel 144, new-car models 231
  (every model month adds up to the stated new-car total)
- Vehicle fleet: monthly 2006-2015 from Infoleht; register general tables for 1.1.2017, 1.8.2017, 1.1.2018, 1.6.2018 and
  1.1.2019; bus registers 2010 and 2020; the open register snapshots (1 January 2020-2026, monthly from 1 October 2026)
  with complete splits by make, county and age
- Inspections: 109 monthly reports 2010-01 to 2019-04 (three months are not published by the source)

See `docs/methodology.md` for the parsing rules and cross-checks, and `docs/operations.md` for commands, hosting and
the weekly update.

## The site

| Path | What it shows |
| --- | --- |
| `/et`, `/en` | Hero (blueprint drawing, selected-month figures, animated brand ranking with logos, timeline, brand duel) and the explorer: registrations, fleet, inspections, insights, methodology. The brand comparison has a period control (2, 5, 10 years or all); it and the registrations history each have a trend analysis card ("Analüüsi trendi", optional Claude wording) |
| `/et/margid`, `/et/margid/<brand>` | 57 brand pages: new cars by year, month and model, first-registration ranking, trucks |
| `/et/kuu`, `/et/kuu/<YYYY-MM>` | 249 month pages: vehicle types, brand rankings, new cars by brand and model, fuels, new cars by county, power, gearbox and colour |
| `/et/otsing` | Vehicle search over the latest register snapshot: make, model, year, power, fuel, gearbox, body, county, status and technical filters; results as variants with counts and spec ranges, side-by-side comparison of up to 4 variants, CSV download |
| `/og/...png` | A share image per page; `sitemap.xml` lists all 620 pages |

URL segments are Estonian in both languages (`/en/margid/bmw`).

## What is verified

- Every published month is rebuilt from all 384 source files and compared row by row before publishing
  (`scripts/compare_bundle.py`; the weekly job refuses to publish if any table loses rows)
- September 2026, passenger cars, from `Esm(üldtabel)`: 3639 first registrations, 1670 new, 1969 used
- Monthly first registrations 2006-2014 match Transpordiamet's consolidated table except where that table itself is
  wrong (see `docs/methodology.md`)

## Stack

- Next.js 15 App Router with `output: "export"`, TypeScript, Tailwind 4, next-intl, Motion, Apache ECharts
- GitHub Pages hosting; GitHub Actions for deploys (`deploy.yml`) and the weekly data update (`ingest.yml`)
- Python ingestion (pandas, openpyxl, xlrd); SQLite warehouse, rebuilt from cached source files each run
- Brand marks from Simple Icons (CC0) and Wikimedia Commons, see `apps/web/public/logos/NOTICE.md`

## Run

```bash
# data (from the repo root)
python -m pip install -r requirements.txt
set PYTHONPATH=.                       # Windows cmd; bash: export PYTHONPATH=.
python -m pytest ingestion/tests -q
python -m ingestion backfill --source samples

# site
cd apps/web
npm install
npm test                               # data-view and page-model tests
npm run dev                            # http://localhost:3000/et
npm run build && npm run preview       # the static export, as deployed
npm run logos                          # regenerate brand marks (rarely needed)
```

The full 2006-2026 backfill and the weekly job are described in `docs/operations.md`.

## Design

Carbon and lime: paper `#F7F7F3`, ink `#181D1D`, graphite `#313B3B`, lime `#D5F08B`, sage `#9FB0A8`, mist `#A8B2AD`.
Archivo (width axis) for type, IBM Plex Mono for ranks. Tokens live in `apps/web/app/globals.css` and
`apps/web/lib/design/tokens.ts`.

## Known limits

- Fleet 2016-2019 has five snapshots from the register general tables; motorcycles and mopeds are missing there (the
  tables count them together)
- Older register codes TR, RO and TH (pre-2008 tractors and tractor trailers) are classified by evidence, not by an
  official definition; confirmation from Transpordiamet is pending (methodology)
- Brand rankings combine new and used registrations (the source's TOP sheets), so there is no new/used split per brand
- Alfa Romeo has no free official mark: a monogram on the site, no mark on its share image
- Core Web Vitals: lab only so far (Lighthouse mobile, 27 Oct 2026: /et 70, brand page 89, /otsing 81; CLS 0). Field data comes
  from Search Console once Google has enough visits
- Supabase Postgres/Storage and Sentry need account credentials; Teabevärav vehicle-level CSVs are not imported
  (the slug API returned HTTP 500); Tableau dashboards are not a source
- Optional AI phrasing of the insights needs `OPENAI_API_KEY`; the site uses deterministic, evidence-backed sentences without it
- The trend analysis words its computed statements with Claude only when the trend-analyst Worker is deployed and
  `TREND_API_URL` is set (`docs/operations.md`); until then it shows the computed text
