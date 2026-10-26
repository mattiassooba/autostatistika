# Source inventory

Inspected 25 October 2026. Every file path, sheet name, and column below was read from an official download or HTML page. Nothing here is inferred from outdated documentation.

## 1. First registrations (flows)

### A. Transpordiamet monthly Infoleht

| Field | Verified value |
| --- | --- |
| Official page | https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika |
| Teabevärav catalogue (same leaflets) | https://andmed.eesti.ee/datasets/esmaselt-registreeritud-soidukid is the public listing; API UUID `9d2f4b4d-9eab-45f7-97b2-543600621aff` is titled *Infoleht (esmaste ja uute sõidukite statistika)* |
| File type | XLS (historical and most 2021-2025 months), XLSX (selected 2024 months and 2026) |
| Size | ~60 KB (2006) to ~2.7 MB (late 2024) |
| Earliest / latest | January 2006 (`infoleht01-06.xls`) through September 2026 (`INFOLEHT-092026.xlsx`) |
| Update mechanism | New workbook added to the Drupal page each month. Filenames and folder dates vary. |
| Expected frequency | Monthly. GitHub Actions must not assume a fixed day. |
| Automation | Yes. Discover `/sites/default/files/documents/...` links from the official page. Trusted hosts: `transpordiamet.ee`, `www.transpordiamet.ee`. |
| Licence | Public sector open data under the Estonian Public Information Act / ODD. Attribution to Transpordiamet is required. Autostatistika is not an official government service. |

Inspected files:

| File | Official URL | Layout |
| --- | --- | --- |
| INFOLEHT-092026.xlsx | `/sites/default/files/documents/2026-10/INFOLEHT-092026.xlsx` | `modern_v1` |
| INFOLEHT-112025.xls | `/sites/default/files/documents/2025-12/INFOLEHT-112025.xls` | `modern_v1` |
| infoleht01-10.xls | `/sites/default/files/documents/2021-11/infoleht01-10.xls` | `legacy_2010` |
| infoleht01-06.xls | `/sites/default/files/documents/2021-11/infoleht01-06.xls` | `legacy_2006` |

#### `modern_v1` sheets (Nov 2025 and Sep 2026)

- `Sõidu-uus` — new passenger cars: `KAT`, `MARK`, `MUDEL`, `KERE NIMETUS`, `KERETÜÜP`, `MOOTORI VÕIMSUS`, `KOKKU`
- `Uued sõidukid` — new vehicles across categories: `Kategooria`, `Mark`, `Mudel`, `Tüüp`, `Kere nimetus`, `Keretüüp`, `Esm reg aasta`, `Kütusekombinatsioon` (row-level, not a ranking)
- `Sõidu-MM` — same calendar month across years: `Aasta`, `Esmased`, `sh uued`, `Uute osakaal %`
- `Esm(üldtabel)` — monthly totals by family: passenger cars, trucks, buses, trailers, motorcycles, mopeds, off-road vehicles. Rows: `Kokku`, `sh uued`, `neist uued omanik era`
- `Esm_sõidu-TOP10` / `Esm_veo-TOP15` / `Esm-moto` — brand counts split by the vehicle's own first-registration year
- `Trak_ja_LM` — tractors and self-propelled machines
- `Kytus_esm_ ( sh uued)` — category × engine type, first registrations and new-vehicle subset
- `Esm-vees6iduk` — watercraft (out of road-vehicle scope unless explicitly shown)
- `Järelturg` — ownership transfers. **Not first registrations.**

Critical layout rule: year columns on TOP sheets (`2026`, `2025`, …) are the vehicle's original first-registration year, not a monthly time series. The reporting month is in the title. Brand totals for that month are the sum of the year columns.

#### `legacy_2006` / `legacy_2010`

These leaflets mix **stock** and **flow** in one workbook.

Stock sheets (fleet, not registrations): `maakond`, `vanus`, `TOP 17`/`TOP20`, `VEO TOP 10`/`veo TOP`, `arvel10sõidu`.

Flow sheets: `esm-06`/`esm-10` (same üldtabel idea), `uued`, `TOP 10`, `uus-sõidu`, `Sõidu01-10`.

`load` is driving-licence issuance and is out of scope.

### B. Teabevärav vehicle-level first registrations

| Field | Verified value |
| --- | --- |
| Official page | https://andmed.eesti.ee/datasets/esmaselt-registreeritud-soidukid |
| Resources seen | Annual CSVs labelled 2023, 2024, 2025, 2026. Daily update cadence claimed. Temporal coverage from 2023-01-01. |
| Automation | Catalogue UI is JS-rendered. Slug API `/api/v2/datasets/esmaselt-registreeritud-soidukid` returned HTTP 500 on 25 Oct 2026. UUID API for the Infoleht dataset works. Vehicle-level distribution IDs were not stably resolved in this pass. |
| Decision | Primary registration importer uses Transpordiamet Infoleht files. Vehicle-level CSVs are a future adapter, aggregated before publish. |

## 2. Vehicle fleet (stocks)

### A. Open register snapshots ("Sõidukite staatused Eestis") — imported

| Field | Verified value (26 Oct 2026) |
| --- | --- |
| Official page | https://andmed.eesti.ee/datasets/soidukite-staatused-eestis |
| Catalogue API | `https://andmed.eesti.ee/api/datasets/slug/soidukite-staatused-eestis` works; `/api/v2/datasets/<slug>` returns HTTP 500 |
| Description | One row per vehicle in the register, 46 columns (README in the dataset). `M1+M1G` = passenger cars, `muu` = all other categories |
| Licence | **CC BY-SA 4.0** (per distribution). Derived figures name Transpordiamet and carry the same licence |
| Files used | `ar_2026-10-01_*` (current month, on `pilv.transpordiamet.ee`), `ar_2024/2025/2026-01-01_*`, and the zip `ar_2020-2023.zip` (1 January 2020-2023). About 300 MB per date |
| Files not used | `kat M1 ja M1G 31.12.2022`, `va M1 ja M1G 31.12.2022`, `… 31.12.2023`: older layout, same moments as 1.1.2023 and 1.1.2024 |
| Caveat | The zip's README: the 2020-2023 files were queried from the register in 2025 and may differ from the state on those dates. The site marks those dates "päritud tagantjärgi" |
| No identifiers | No registration plate, VIN or owner. Owner data is limited to county (`VKOM_MAAKOND`) and private/legal type (`VKOM_TYYP`) |
| Update | Monthly; the catalogue replaces the monthly file, so every file is also kept in the repository release `register-archive` |
| Importer | `ingestion/discovery/opendata.py`, `ingestion/parsers/register.py` |

1 October 2026 check: 788 081 passenger-car rows, 680 843 registered (`YLDINE_STAATUS`) and 107 238 suspended;
429 592 rows in other categories. Field fill rates for passenger cars: brand, model, dates, body, colour, masses,
engine size and power 100 %; county 97.1 %; gearbox 90.0 %; Euro class 72.3 %; CO2 NEDC 63.4 %, WLTP 21.3 %.

### B. Historical "Arvel olevad" workbooks

Published on the same Transpordiamet Infoleht page. Examples verified:

| File | Snapshot date | Grain |
| --- | --- | --- |
| `bussid-311220.xlsx` | 2020-12-31 | One row per bus. Title: 5235 buses, including suspended and temporarily deleted records. Columns: `Üldstaatus`, `Kategooria`, `Mark`, `Mudel`, `Keretüüp`, `Esm reg aasta`, `Registrimass`, `Täismass` |
| `arvel_olevad_bussid_seisuga_31.12.2010.xls` | 2010-12-31 | Already aggregated: `Kat`, `Mark`, `Mudel`, `Väljalaske aasta`, `Mootori tüüp`, `Keretüüp`, `Arv` |

Passenger-car snapshots exist (e.g. 31.12.2021, ~55 MB). Register rows are counted into facts; the /otsing search files keep vehicle attributes without identifiers or exact dates (see methodology, "Vehicle search").

### C. Transpordiamet "Sõidukite statistika"

https://www.transpordiamet.ee/soidukite-statistika embeds Tableau Public (`Sidukitestaatusedkodulehele`). No licensed machine-readable export was verified. **Do not scrape Tableau.**

## 3. Technical inspections

### A. Historical monthly workbooks, 2010-2019

| Field | Verified value |
| --- | --- |
| Official page | https://www.transpordiamet.ee/tehnoulevaatuste-statistika |
| Files | `kuuaruanne_YYYY_MM.xls` under `/sites/default/files/documents/2021-02/` |
| Size | 40-72 KB |
| Automation | Yes, same HTML discovery as Infoleht. |

Inspected:

| File | Sheets | Grain |
| --- | --- | --- |
| `kuuaruanne_2010_01.xls` | `temptehno` | Inspection **stations**. Columns: bureau, point, name, inspection count, of which in order, of which repeat, periodic inspections, of which in order |
| `kuuaruanne_2019_04.xls` | `Sõidukid`, `Traktorid` | Same station grain, split by vehicle vs tractor population. Columns: bureau code, point code, point name, inspections total / in order / repeat, periodic inspections |

These files do **not** contain brand or model. They count inspection events at stations, not unique vehicles.

### B. Teabevärav inspection event CSVs

| Field | Verified value |
| --- | --- |
| Official page | https://andmed.eesti.ee/datasets/maismaasoidukite-tehnoulevaatused-eestis |
| Description | Confirmed inspection results. Files `yv_[year].csv` from 2010, current year through the start of the running month. `rike.csv` is the defect-code dictionary. Metadata JSON describes columns. Monthly updates. Last modified 2026-02-05. Annual files 45-76 MB. |
| Automation | Yes once distribution IDs resolve. Event-level files must be aggregated. |
| Tableau | https://public.tableau.com/app/profile/transpordiamet/viz/Tehnolevaatusteriketestatistika_16523533529790/Rikkeddetailselt is a visualisation, not an import source. |

## 4. Licensing and attribution

- Teabevärav marks the Infoleht dataset with `dcatap_applicableLegislation: ODD_LEGAL_ACT` and `dct_accessRights: PUBLIC`.
- Estonian open-data practice allows reuse with attribution. Autostatistika cites Transpordiamet and the original URL on every chart.
- No owner names, plates, or VINs were present in the inspected aggregate leaflets. Vehicle-level fleet/inspection CSVs must be aggregated and those fields dropped if they appear.
- Disclaimer: Autostatistika is not an official service of Transpordiamet or the Estonian government.

## 5. Automation verdict

| Source | Automatable now | Blocker |
| --- | --- | --- |
| Infoleht registrations 2006-present | Yes | Layout variants. Parser adapters required. |
| Fleet snapshots on Infoleht archive | Yes for linked workbooks | Coverage is irregular by category and year. |
| Open register snapshots 2020+ | Yes | — (imported since 26 Oct 2026) |
| Inspection workbooks 2010-2019 | Yes | Station-level only. |
| Inspection CSVs 2010-present | Partial | Same Teabevärav ID listing issue. |
| Tableau dashboards | No | No verified licensed export. |

## 6. Known gaps

- 2006-c.2020 Infoleht files mix stock and flow. Parsers must classify sheets, not files.
- Brand strings vary (`VOLKSWAGEN` / `VOLKSWAGEN, VW`, `ŠKODA` / `SKODA`). Uncertain aliases are flagged, not merged.
- Mopeds appear in modern üldtabel; 2006 üldtabel has tractors instead.
- Watercraft sheets exist and are stored only if explicitly in scope. Default dashboards are land vehicles.
- Inspection repeat share is events directed to repeat inspection, not a brand reliability score.
- Fleet stock 2016-2019: no register snapshots in the open data (it starts 2020-01-01). Irregular extracts on the
  Infoleht page (e.g. `arvel-m1-310717.csv`, `arvel-m1_311217.xlsx`) are not imported yet.
