from __future__ import annotations

import sqlite3

CATEGORIES = [
    ("passenger_car", "Sõiduautod", "Passenger cars", "M1,M1G"),
    ("truck", "Veoautod", "Trucks", "N1,N2,N3"),
    ("bus", "Bussid", "Buses", "M2,M3"),
    ("trailer", "Haagised", "Trailers", "O1,O2,O3,O4"),
    ("motorcycle", "Mootorrattad", "Motorcycles", "L3e,L4e,L5e"),
    ("moped", "Mopeedid", "Mopeds", "L1e,L2e"),
    ("l_other", "Muud L-kategooria", "Other L-category", "L6e,L7e"),
    ("offroad", "Maastikusõidukid", "Off-road vehicles", ""),
    ("tractor", "Traktorid", "Tractors", "T1,T2,T3,T4,T5"),
    ("self_propelled", "Liikurmasinad", "Self-propelled machines", "LM"),
    ("watercraft", "Veesõidukid", "Watercraft", ""),
    ("tractor_trailer", "Traktorihaagised", "Tractor trailers", "R1,R2,R3,R4"),
    ("unclassified", "Liigitamata", "Unclassified", ""),
]

FUELS = [
    ("petrol", "Bensiin", "Petrol"),
    ("petrol_catalyst", "Bensiin katalüsaatoriga", "Petrol with catalyst"),
    ("petrol_hybrid", "Bensiinihübriid", "Petrol hybrid"),
    ("diesel", "Diisel", "Diesel"),
    ("diesel_hybrid", "Diiselhübriid", "Diesel hybrid"),
    ("electric", "Elekter", "Electric"),
    ("gas", "Gaas", "Gas"),
    ("other", "Muu", "Other"),
]

REGIONS = [
    ("harju", "Harju maakond", "Harju County"),
    ("hiiu", "Hiiu maakond", "Hiiu County"),
    ("ida-viru", "Ida-Viru maakond", "Ida-Viru County"),
    ("jogevamaa", "Jõgeva maakond", "Jõgeva County"),
    ("jarva", "Järva maakond", "Järva County"),
    ("laane", "Lääne maakond", "Lääne County"),
    ("laane-viru", "Lääne-Viru maakond", "Lääne-Viru County"),
    ("polva", "Põlva maakond", "Põlva County"),
    ("parnu", "Pärnu maakond", "Pärnu County"),
    ("rapla", "Rapla maakond", "Rapla County"),
    ("saare", "Saare maakond", "Saare County"),
    ("tartu", "Tartu maakond", "Tartu County"),
    ("valga", "Valga maakond", "Valga County"),
    ("viljandi", "Viljandi maakond", "Viljandi County"),
    ("voru", "Võru maakond", "Võru County"),
]

STATUSES = [
    ("registered", "Registreeritud", "Registered"),
    ("suspended", "Peatatud registrikandega", "Suspended"),
    ("temporarily_deleted", "Ajutiselt kustutatud", "Temporarily deleted"),
    ("unknown", "Määramata", "Unspecified"),
]

METRICS = [
    ("first_registrations", "vehicles", "Esmaregistreerimised", "First registrations", "First entries into the Estonian register during the reporting month."),
    ("new_vehicles", "vehicles", "Uued sõidukid", "New vehicles", "New vehicles among first registrations."),
    ("used_first_registrations", "vehicles", "Kasutatud esmaresgistreerimised", "Used first registrations", "First registrations minus new vehicles."),
    ("new_private_owner", "vehicles", "Uued eraomanikule", "New private-owner vehicles", "New vehicles registered to a private owner."),
    ("ownership_transfers", "vehicles", "Omanikevahetused", "Ownership transfers", "Aftermarket owner changes. Not first registrations."),
    ("fleet_count", "vehicles", "Arvel olevad sõidukid", "Vehicles in register", "Stock count on a snapshot date."),
    ("inspections", "events", "Ülevaatused", "Inspections", "Technical inspection events."),
    ("inspections_pass", "events", "Korras ülevaatused", "Inspections in order", "Inspection events marked in order."),
    ("inspections_repeat", "events", "Kordusülevaatusele suunatud", "Directed to repeat inspection", "Inspection events directed to a repeat inspection."),
    ("periodic_inspections", "events", "Korralised ülevaatused", "Periodic inspections", "Periodic inspection events when the source splits them."),
]

SOURCES = [
    ("ta-infoleht", "Transpordiamet Infoleht", "https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika", "registrations", 40, "www.transpordiamet.ee"),
    ("ta-fleet-archive", "Transpordiamet historical fleet snapshots", "https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika", "vehicle_fleet", 400, "www.transpordiamet.ee"),
    ("ta-register-opendata", "Transpordiamet register snapshots (Sõidukite staatused Eestis)", "https://andmed.eesti.ee/datasets/soidukite-staatused-eestis", "vehicle_fleet", 31, "andmed.eesti.ee"),
    ("ta-inspections-xls", "Transpordiamet inspection monthlies 2010-2019", "https://www.transpordiamet.ee/tehnoulevaatuste-statistika", "inspections", 40, "www.transpordiamet.ee"),
]


def seed(conn: sqlite3.Connection) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO vehicle_categories(code, label_et, label_en, eu_codes) VALUES (?,?,?,?)",
        CATEGORIES,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO fuel_types(code, label_et, label_en) VALUES (?,?,?)",
        FUELS,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO regions(code, label_et, label_en) VALUES (?,?,?)",
        REGIONS,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO registration_statuses(code, label_et, label_en) VALUES (?,?,?)",
        STATUSES,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO metric_definitions(code, unit, label_et, label_en, definition) VALUES (?,?,?,?,?)",
        METRICS,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO data_sources(id, name, official_url, dataset_kind, expected_interval_days, trusted_host) VALUES (?,?,?,?,?,?)",
        SOURCES,
    )
    conn.commit()
