# Methodology

Autostatistika republishes official Transpordiamet statistics. It does not estimate missing months and it does not reconstruct history from a current register extract.

## Flows versus stocks

- **Registrations are flows.** A September 2026 first-registration count is vehicles first entered in the Estonian register during that month.
- **The fleet is a stock.** A 31.12.2020 bus file is the register as it stood that day, including suspended records when the source says so.
- Adding snapshot counts across dates is invalid.
- Counting `Esm reg aasta` in a current fleet file is not a first-registration time series. Vehicles leave the register.

## First registrations versus new vehicles

Modern Infoleht üldtabel rows:

- `Kokku` — first registrations in Estonia that month
- `sh uued` — of which new vehicles
- `neist uued omanik era` — of which new vehicles registered to a private owner

Used-vehicle first registrations are `Kokku - sh uued` when both cells are present. That remainder is an import/first-entry of a used vehicle, not a domestic ownership transfer.

`Järelturg` sheets are ownership transfers and are stored under a separate metric. They are never added to first registrations.

## Year columns on ranking sheets

`Esm_sõidu-TOP10` columns labelled `2026`, `2025`, … are the vehicle's own first-registration year. They describe the age mix of vehicles first registered in Estonia in the reporting month. Autostatistika:

- stores each year cell with `vehicle_first_reg_year`
- publishes brand totals as the sum of those cells for the reporting month
- never treats those columns as a calendar time series of monthly events

## Percentages

Every share names its denominator.

- New-vehicle share = new / first registrations for the same category and month
- Repeat-inspection share = inspections marked `Kordus` / all inspections in that population and month
- Brand share = brand first registrations / category first registrations for the same month

Missing is not zero. Empty source cells stay null.

## Inspections

2010-2019 monthly workbooks count events at inspection stations. National figures are the sum of station rows after dropping total/subtotal rows.

- Periodic (`korraline`) inspections are stored separately from all inspections when the source splits them
- Repeat (`kordus`) is an outcome of an inspection event, not a unique failed vehicle
- These workbooks have no brand or model. Brand reliability claims are not shown
- Tractor inspections are a separate population

Teabevärav `yv_*.csv` files, when imported, are aggregated to the same metrics plus defect-group counts. Event-level rows are not published.

Infoleht workbooks also contain “arvel olevad” county and age tables. Those sheets mix grains (counties, age bands, and brand rows). Autostatistika never adds those grains together. A national stock figure is published only from a single grain that also passes an Estonia-scale plausibility check. Dedicated bus-register files (31.12.2010, 31.12.2020) are the verified fleet snapshots in the current sample import.

## Fleet status

If the source includes `Üldstaatus` (registered, suspended, temporarily deleted), Autostatistika keeps that dimension. A headline "registered fleet" uses only statuses the source marks as registered. Mixed-status totals are labelled as such.

## Coverage

Each dataset publishes a coverage matrix: metric × year × category × geography. The UI hides filters the current tab cannot support.

## Insights

Candidate findings are calculated in Python from published facts. An optional language model only rewrites approved numbers. Every published insight stores its evidence rows. If the model is missing or fails validation, a deterministic Estonian and English sentence is used instead.

## Disclaimer

Autostatistika is an independent project. It is not an official service of Transpordiamet or the Estonian government.


## Rules added with the 2006-2026 backfill (25 Oct 2026)

- **Brand month totals** are the source's own `Kokku` column. Summing year columns alone drops the `Vanemad`
  (older) bucket. Rows naming one brand twice ("VOLKSWAGEN", "VOLKSWAGEN, VW") are summed. A brand total can never
  exceed its category's first registrations for the month; if it does, that sheet's brand table is dropped.
- **Facts that normalise to one key are summed, never overwritten** (CNG + LPG -> gas, a model listed per body type).
- **The reporting month comes from the leaflet's own title**, not the file name (`infoleht-1114_detsember_2014...`
  is December). Partial-month leaflets are skipped. Inspection reports use their `Periood:` line.
- **Inspection national figures are the report's `Kokku` rows**; station rows must reconcile with them (>1 % gap
  blocks the import). The 2010 single-sheet layout holds a vehicles table and a tractors table; they are separate
  populations. Station identity is bureau + point code.
- **Legacy stock tables** (Infoleht 2006-2015) are read only from register sheets (`arvel`, county, age). Flow sheets
  in the same workbook are never stock. Month-end and first-of-next-month dates are one snapshot. County splits,
  age bands and the stated total reconcile exactly for every date.
- **Status scope**: from 12/2014 the age sheet notes that suspended records are included; earlier leaflets do not say
  and the series continues without a break. Those stocks are labelled "in the register, incl. suspended" where stated.
  31.12.2014 also has a registered-only sheet: 552 022 registered + 100 928 suspended passenger cars.
- **"Enim arvel olevad" brand tables are top lists** (top 17-21), published with `complete: false`; shares use the
  snapshot stock as denominator and the remainder is stated as not listed.

## Rules added with the parser fixes (26 Oct 2026)

Each rule has a test in `ingestion/tests/test_parsers.py` that reproduces the source layout.

- **Total labels**: `Kokku`, `Total`, `Summa`, `Grand Total` and `Üldkokkuvõte` mark a total, never a brand or a car.
- **TOP lists read brands from the `Mark` column**, not the first column (08/2024 adds a `jrkNr` rank column before it).
- **New-car model lists end at their own total.** Only the list's own columns count: 2024 leaflets put a pivot of the
  same cars beside the list, and its `KOKKU` row shared a row with stray cells (once read as 1 820 BMW X7s).
  A count with no description at all is an unlabelled total (2007-2017) and also ends the list.
- **Pivot layouts (05-12/2010)** print category, brand and model once per group: they carry down to the following rows,
  and `AUDI kokku`-style subtotals are skipped. The list's category column is the first `KAT`/`KATEG`/`KATEGOORIA`
  header (09/2010 and 03-12/2015 head it `Kategooria`).
- **Safeguard**: a model list that adds up to more than the stated new passenger cars (+1 %) is dropped rather than
  published doubled.
- Result: all 231 model months match the stated new-car total within 1 % (07/2024 lists one car fewer than its general
  table; the leaflet's own list total says the same).

## Register snapshots (from 2020, added 26 Oct 2026)

- Source: the open dataset "Sõidukite staatused Eestis", one row per vehicle in the register. Rows are counted;
  individual vehicles are not published.
- Status is the source's general status `YLDINE_STAATUS`: registered or suspended. Both are in the register; the
  headline stock is their sum and is labelled as including suspended records, with the split beside it.
- Families follow the EU category (transpordiamet.ee/soidukite-ja-masinate-kategooriad): MS1/MS2 are off-road
  vehicles, C1-C5 and T4.x tractors, speed classes (T1a/T1b) keep their category, R1-R4 are tractor trailers (a
  separate family from road trailers O1-O4). Codes the page does not define (TR, TH, TR1, TR2, TH1, RO) stay
  "unclassified" and are never guessed.
- County is the responsible user's (or owner's) address county; records without one are "Maakond määramata".
- Age is full years from `ESMANE_REG` (first registration in any country) to the snapshot date, in the same bands as
  the Infoleht age sheet (0-2, 3-5, 6-10, over 10). The Infoleht sheet does not state its basis, so the two parts of
  the series are labelled separately. Vehicles without a valid date get no band.
- `EESTIS_ESMAREG` can be overwritten when a vehicle is re-registered and is not used as a registration series.
- 1 January 2020-2023 come from files queried in 2025 (the zip's README warns they may differ from the register on
  those dates); they are marked on the site.
- Applying the register's category codes to the registration leaflets also restored rows that were dropped before:
  off-road (MS1/MS2) fuel rows, M3G buses and tractor speed classes. Off-road fuel now matches the stated monthly
  total in every month that has both.

## Brand and month pages

- A brand gets a page with at least 12 ranked TOP-list months or at least 100 new cars in the model lists (57 brands).
- New-car counts per brand come from the model lists and only from months that reconcile with the stated new-vehicle
  total within 1 %. There, a brand without rows really had zero new cars; elsewhere the month is left empty.
- 12-month figures need all 12 months to reconcile; yearly bars mark years with fewer months as partial.
- Brand names follow the source; the only merge is a pure rename: `TESLA MOTORS` (to 06/2019) counts as Tesla.
- The TOP lists rank first registrations (new and used together); a brand outside the list is "not ranked", and a
  month without any list shows "—", not "not ranked".

## Cross-check

Monthly first registrations 2006-2014 were compared with Transpordiamet's consolidated
`esmased-yldtabel_2006-2014.xlsx`: 764 month x category values, 728 identical. All 36 differences trace to that
table, not to the monthly leaflets: its 2008 sheet repeats September as October and shifts the rest of the year,
and its 2012 sheet inserts a Mopeedid column from June. The original monthly leaflets are the published values.
