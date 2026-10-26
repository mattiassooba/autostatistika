# Data dictionary

Canonical codes are stable. Original source strings are stored beside them.

## Metrics

| code | unit | meaning |
| --- | --- | --- |
| `first_registrations` | vehicles | First entries into the Estonian register during the reporting month |
| `new_vehicles` | vehicles | New vehicles among first registrations |
| `used_first_registrations` | vehicles | `first_registrations - new_vehicles` when both exist |
| `new_private_owner` | vehicles | New vehicles registered to a private owner |
| `ownership_transfers` | vehicles | Aftermarket changes of owner. Not a first registration |
| `fleet_count` | vehicles | Vehicles in the register on a snapshot date |
| `inspections` | events | Technical inspection events |
| `inspections_pass` | events | Inspections marked in order (`Korras`) |
| `inspections_repeat` | events | Inspections directed to repeat inspection (`Kordus`) |
| `periodic_inspections` | events | Periodic (`korraline`) inspections when split |

## Vehicle families

| code | ET | EN | typical source labels |
| --- | --- | --- | --- |
| `passenger_car` | Sõiduautod | Passenger cars | Sõiduautod, M1, M1G |
| `truck` | Veoautod | Trucks | Veoautod, N1, N2, N3, N1G, N2G, N3G |
| `bus` | Bussid | Buses | Bussid, Autobussid, M2, M3 |
| `trailer` | Haagised | Trailers | Haagised, O1-O4 |
| `motorcycle` | Mootorrattad | Motorcycles | Mootorrattad, L3e, L4e, L5e |
| `moped` | Mopeedid | Mopeds | Mopeedid, L1e, L2e |
| `l_other` | Muud L-kategooria | Other L-category | L6e, L7e |
| `offroad` | Maastikusõidukid | Off-road vehicles | Maastikusõidukid, MS1, MS2 |
| `tractor` | Traktorid | Tractors | Traktorid, T1-T5 (incl. a/b speed classes), C1-C5 |
| `self_propelled` | Liikurmasinad | Self-propelled machines | LM, Liikurmasinad |
| `watercraft` | Veesõidukid | Watercraft | Esm-vees6iduk |
| `tractor_trailer` | Traktorihaagised | Tractor trailers | R1a-R4b, Traktorihaagised |
| `unclassified` | Liigitamata | Unclassified | register codes without an official definition (TR, TH, RO, …) |

EU category codes (`M1`, `L3e`) are stored on facts when the sheet has them. Family is the dashboard filter.

## Fuel

| code | ET | EN | source examples |
| --- | --- | --- | --- |
| `petrol` | Bensiin | Petrol | BENSIIN, Bensiin |
| `petrol_catalyst` | Bensiin katalüsaatoriga | Petrol with catalyst | BENSIIN_KATALYSAATOR |
| `petrol_hybrid` | Bensiinihübriid | Petrol hybrid | BENSIIN_HYBRIID |
| `diesel` | Diisel | Diesel | DIISEL, Diisel |
| `diesel_hybrid` | Diiselhübriid | Diesel hybrid | DIISEL_HYBRIID |
| `electric` | Elekter | Electric | ELEKTER |
| `gas` | Gaas | Gas | CNG, LPG, GAAS |
| `other` | Muu | Other | unmapped values, flagged |

## New-vehicle breakdowns

`registration_facts.dimension` / `dimension_value`, metric `new_vehicles`:

| dimension | values |
| --- | --- |
| `county` | county codes as for the fleet (`harju`, …, `unassigned`) |
| `power_band` | `0-70`, `71-100`, `101-150`, `151-200`, `201-300`, `over-300` (kW), `unknown` |
| `gearbox` | source codes in lowercase ASCII (`automaat`, `manuaal`, `cvt`, `dct`, `amt`, `automat_manuaal`, `konstantne_ylekanne`, `hydrauliline`, `rummusisene`, `muu`), `unknown` |
| `colour` | source colour names in lowercase ASCII (`must`, `hobedane`, `beez`, …), `unknown` |

## Registration status

| code | ET | EN |
| --- | --- | --- |
| `registered` | Registreeritud | Registered |
| `suspended` | Peatatud registrikandega | Suspended |
| `temporarily_deleted` | Ajutiselt kustutatud | Temporarily deleted |
| `unknown` | Määramata | Unspecified |

## Reporting periods

- Registration and inspection facts use `YYYY-MM` (`period_start` = first day of month, `period_end` = last day).
- Fleet facts use `snapshot_date`.
- `imported_at` is when Autostatistika processed the file. It is never shown as the statistical date.
