# Autostatistika.ee

Bilingual explorer for official Estonian vehicle statistics. Registrations, the vehicle fleet, and technical inspections are imported from Transpordiamet files, validated, then published as aggregates. The site does not invent numbers.

Autostatistika is not an official service of Transpordiamet or the Estonian government.

## Coverage (backfill of 25 Oct 2026)

- Registrations: every month 2006-01 to 2026-09 (249), brand rankings for 236 months, fuel 144, new-car models 221
- Vehicle fleet: 115 snapshot dates (monthly 2006-2015 from Infoleht, bus registers 2010 and 2020); county splits on 107, age on 113
- Inspections: 109 monthly reports 2010-01 to 2019-04 (three months are not published by the source)

See `docs/methodology.md` for the parsing rules and the cross-check against the official 2006-2014 table,
and `docs/operations.md` for the backfill commands.

## What is verified

Inspected official files (25 Oct 2026):

- Infoleht 09-2026 and 11-2025 (`modern_v1` registration workbooks)
- Infoleht 01-2006 and 01-2010 (legacy mixed stock/flow workbooks)
- Inspection monthlies 2010-01 and 2019-04
- Bus fleet snapshots 2010-12-31 and 2020-12-31

See `docs/source-inventory.md` and `docs/methodology.md`.

September 2026, passenger cars, from `Esm(üldtabel)`:

- 3639 first registrations
- 1670 new vehicles
- 1969 used first entries

## Stack

- Next.js App Router (static export), TypeScript, Tailwind, next-intl, Apache ECharts
- GitHub Pages hosting, GitHub Actions for deploys and the weekly data update
- Python ingestion (pandas, openpyxl, xlrd)
- SQLite locally, optional Supabase Postgres

## Run

```bash
python -m pip install pandas==2.3.3 openpyxl==3.1.5 xlrd==2.0.2 requests==2.32.5 beautifulsoup4==4.14.2 lxml==6.0.2 python-dotenv==1.1.1 pytest==8.4.2
set PYTHONPATH=.
python -m ingestion backfill --source samples

cd apps/web
npm install
npm run dev
```

## Design

Carbon and lime: paper `#F7F7F3`, ink `#181D1D`, graphite `#313B3B`, lime `#D5F08B`, mist `#A8B2AD`.

## What is still unverified

- Supabase Postgres/Storage and Sentry need account credentials.
- Teabevärav vehicle-level CSVs are not imported: the slug API returned HTTP 500 during discovery.
- Tableau inspection dashboards are not used as a machine-readable source.
- Optional AI phrasing needs `OPENAI_API_KEY`. The site uses deterministic evidence-backed sentences without it.
- Fleet snapshot files after 2015 (monthly vehicle-level register extracts, up to ~55 MB each) are not imported yet.
