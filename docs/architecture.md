# Architecture

## Product

Autostatistika.ee is a bilingual statistics explorer for official Estonian vehicle data. The website never invents numbers. It only renders published, validated aggregates.

## Decisions

1. **Infoleht is the registration source of record.** Monthly Transpordiamet workbooks cover 2006-present and distinguish first registrations from new vehicles. Vehicle-level Teabevärav CSVs are an optional later adapter.
2. **Facts stay in a warehouse. The website reads published aggregates.** Python writes SQLite (or Postgres), then emits a versioned JSON bundle (`apps/web/data/published/bundle.json`, committed). `next build` turns that bundle into a fully static site; there is no server, API route or middleware at runtime.
3. **Tableau is not a source.** Embeds on transpordiamet.ee are documented and ignored by importers.
4. **Local-first.** The repo runs without Supabase credentials. `DATABASE_URL` and `SUPABASE_*` unlock archival storage and a hosted warehouse. Missing credentials are a documented limitation, not a mocked success.
5. **One explorer, three tabs.** Shared filter/URL contract. Each tab declares its own coverage.
6. **Static hosting only.** GitHub Pages serves `apps/web/out/`. Anything per-request (server rendering, API routes,
   middleware, redirects) is out; equivalents are built at export time or run in the browser.

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

## Web layer (`apps/web`)

| Piece | Where | Notes |
| --- | --- | --- |
| Home explorer `/[locale]` | `app/[locale]/page.tsx`, `components/explorer/*` | Pre-rendered with the default view; `DashboardProvider` applies a shared link's query in the browser and loads slices on demand |
| Data slices | `app/data/[generation]/[kind]/[file]/route.ts` | One static JSON file per brand category, month, fleet date and station month; the generation segment versions them |
| Hero | `components/hero/*` | `HeroProvider` holds one selected month, vehicle type and picked brands for the figures, ranking, timeline and duel |
| Brand and month pages | `app/[locale]/margid`, `app/[locale]/kuu`, `lib/data/pages.ts` | Read models over the bundle, tested in `lib/data/pages.test.ts` |
| Share images | `app/og/[locale]/[kind]/[file]/route.tsx` | 1200×630 PNG per page, rendered with `next/og` at build |
| Trend analysis | `components/explorer/trend-analysis.tsx`, `lib/analysis/*`, `workers/trend-analyst` | Card in the brand comparison. `trend.ts` computes every figure from the chart's rows, `render.ts` writes the sentences, `build.ts` runs both for a selection, `validate.ts` checks model text. The Worker shares `build.ts` and `validate.ts` and rebuilds the statements from `/data/<generation>/trend/<category>.json` (`app/data/[generation]/trend`), so requests carry a selection, never text. The engine loads on the first click. Optional AI wording through a Cloudflare Worker; the site itself stays static. Tested in `lib/analysis/*.test.ts` and `workers/trend-analyst/test` |
| Vehicle search | `app/[locale]/otsing`, `components/search/*`, `lib/search/*` | Static page; a Web Worker loads gzip-compressed column files from `/register/<date>/` (built by `ingestion/publishing/register_index.py`, shipped as the `register-index` release asset), filters and groups into variants in the browser. Tested in `lib/search/*.test.ts` |
| SEO | `lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts` | Canonical + hreflang, Open Graph, `Dataset` and `BreadcrumbList` JSON-LD |
| Brand marks | `public/logos`, `components/ui/brand-logo.tsx` | CSS-mask SVGs; monogram fallback |
| Site mark | `lib/brand/plate-mark.ts`, `components/brand/plate-mark.tsx`, `app/icon.svg`, `app/apple-icon.png` | AUTOSTATISTIKA.EE on a registration-plate shape, one builder for header, footer and share images. Lettering is outlined from Archivo into `lib/brand/plate-mark-paths.ts` by `scripts/build_plate_mark.py`; blue (`plate-blue`) is reserved for its country strip |

The explorer's URL query (`lib/url-state.ts`) is validated with zod: `tab` (`registreerimised` \| `soidukipark` \|
`ulevaatused`), `category`, `brands` (up to 8), `from`/`to` (`YYYY-MM`; `to` is the selected month, `from` the start of the brand
comparison window), `fuel`, `snapshot` (`YYYY-MM-DD`), `population`. Invalid values are dropped, never guessed; `lib/data/resolve.ts` falls back to what the data can show.

One optional per-request service sits beside the site: the trend analysis can call a Cloudflare Worker
(`workers/trend-analyst`) that holds the Anthropic key. It is not part of the build or the hosting; without it the
card shows its computed text.

## Cost

- GitHub Pages for the site (static export)
- Supabase free/pro for warehouse and private source-file storage
- GitHub Actions for scheduled discovery
- Optional OpenAI/Anthropic key for insight phrasing only
- Optional Cloudflare Worker (free plan) and Anthropic API usage (Claude Haiku) for the trend analysis wording

The site stays useful with zero AI spend.
