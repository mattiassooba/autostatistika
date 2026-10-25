# Architecture

## Product

Autostatistika.ee is a bilingual statistics explorer for official Estonian vehicle data. The website never invents numbers. It only renders published, validated aggregates.

## Decisions

1. **Infoleht is the registration source of record.** Monthly Transpordiamet workbooks cover 2006-present and distinguish first registrations from new vehicles. Vehicle-level Teabevärav CSVs are an optional later adapter.
2. **Facts stay in a warehouse. The website reads published aggregates.** Python writes SQLite or Postgres, then emits a versioned JSON bundle. Next.js server routes read that bundle (and optionally Postgres). The public site does not talk to Supabase from the browser.
3. **Tableau is not a source.** Embeds on transpordiamet.ee are documented and ignored by importers.
4. **Local-first.** The repo runs without Supabase credentials. `DATABASE_URL` and `SUPABASE_*` unlock archival storage and a hosted warehouse. Missing credentials are a documented limitation, not a mocked success.
5. **One explorer, three tabs.** Shared filter/URL contract. Each tab declares its own coverage.

## Runtime

```
Transpordiamet HTML ──► discovery ──► download ──► archive
Teabevärav API   ─┘                      │
                                         ▼
                                   parser adapters
                                         ▼
                                   normalize + validate
                                         ▼
                              SQLite / Postgres facts
                                         ▼
                         publish JSON + deterministic insights
                                         ▼
                              Next.js /et /en explorer
```

Ingestion never runs as part of the site build; GitHub Actions runs it and commits the published bundle.

## Repository

```
apps/web          Next.js App Router, next-intl, ECharts
ingestion         Python CLI and pipeline
supabase          Postgres migrations + RLS
docs              methodology and operations
data              local warehouse and downloads (not committed)
```

## Data grain

| Table | Grain |
| --- | --- |
| `registration_facts` | One metric value for a reporting month, metric, and the dimensions present on that sheet |
| `vehicle_fleet_facts` | One metric value for a snapshot date and stock dimensions. Snapshots are not additive across dates |
| `inspection_facts` | One metric value for a reporting month, population (`vehicles` / `tractors`), and optional station |

Every fact stores `source_file_id`, `metric_code`, `unit`, `publication_status`. Unique constraints make reruns idempotent.

## Query contract

Public API routes accept a validated `DashboardQuery`:

- `tab`: `registreerimised` \| `soidukipark` \| `ulevaatused`
- `from`, `to`: `YYYY-MM`
- `category`, `brands`, `models`, `fuel`, `region`, `status`
- Unknown or unsupported filters are ignored and listed in the response `ignored` array. They are not silently filled.

## Cost

- GitHub Pages for the site (static export)
- Supabase free/pro for warehouse and private source-file storage
- GitHub Actions for scheduled discovery
- Optional OpenAI/Anthropic key for insight phrasing only

The site stays useful with zero AI spend.
