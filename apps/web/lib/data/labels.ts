export const METRIC_LABELS: Record<string, { et: string; en: string }> = {
  first_registrations: { et: "Esmaregistreerimised", en: "First registrations" },
  new_vehicles: { et: "Uued sõidukid", en: "New vehicles" },
  used_first_registrations: { et: "Kasutatud esmased", en: "Used first entries" },
  new_private_owner: { et: "Uued eraisikutele", en: "New, private owner" },
  inspections: { et: "Ülevaatused", en: "Inspections" },
  inspections_pass: { et: "Korras", en: "Passed" },
  inspections_repeat: { et: "Kordusülevaatusele", en: "Directed to repeat" },
  periodic_inspections: { et: "Korralised", en: "Periodic inspections" },
  fleet_count: { et: "Arvel olevad", en: "In the register" },
};

export const FUEL_LABELS: Record<string, { et: string; en: string }> = {
  diesel: { et: "Diisel", en: "Diesel" },
  diesel_hybrid: { et: "Diiselhübriid", en: "Diesel hybrid" },
  petrol: { et: "Bensiin", en: "Petrol" },
  petrol_catalyst: { et: "Bensiin, katalüsaator", en: "Petrol, catalyst" },
  petrol_hybrid: { et: "Bensiinhübriid", en: "Petrol hybrid" },
  electric: { et: "Elekter", en: "Electric" },
  gas: { et: "Gaas", en: "Gas" },
};

export const STATUS_LABELS: Record<string, { et: string; en: string }> = {
  registered: { et: "Registreeritud", en: "Registered" },
  suspended: { et: "Peatatud kanne", en: "Suspended record" },
  temporarily_deleted: { et: "Ajutiselt kustutatud", en: "Temporarily deleted" },
};

export const POPULATION_LABELS: Record<string, { et: string; en: string }> = {
  vehicles: { et: "Sõidukid", en: "Vehicles" },
  tractors: { et: "Traktorid", en: "Tractors" },
};

export const AGE_LABELS: Record<string, { et: string; en: string }> = {
  "0-2": { et: "0–2 aastat", en: "0–2 years" },
  "3-5": { et: "3–5 aastat", en: "3–5 years" },
  "6-10": { et: "6–10 aastat", en: "6–10 years" },
  "over-10": { et: "üle 10 aasta", en: "over 10 years" },
};

/** New-vehicle breakdowns (Infoleht "Uued sõidukid"); codes are set by the parser. */
export const BREAKDOWN_LABELS: Record<string, Record<string, { et: string; en: string }>> = {
  county: {
    harju: { et: "Harju", en: "Harju" },
    hiiu: { et: "Hiiu", en: "Hiiu" },
    "ida-viru": { et: "Ida-Viru", en: "Ida-Viru" },
    jogevamaa: { et: "Jõgeva", en: "Jõgeva" },
    jarva: { et: "Järva", en: "Järva" },
    laane: { et: "Lääne", en: "Lääne" },
    "laane-viru": { et: "Lääne-Viru", en: "Lääne-Viru" },
    polva: { et: "Põlva", en: "Põlva" },
    parnu: { et: "Pärnu", en: "Pärnu" },
    rapla: { et: "Rapla", en: "Rapla" },
    saare: { et: "Saare", en: "Saare" },
    tartu: { et: "Tartu", en: "Tartu" },
    valga: { et: "Valga", en: "Valga" },
    viljandi: { et: "Viljandi", en: "Viljandi" },
    voru: { et: "Võru", en: "Võru" },
    unassigned: { et: "Maakond määramata", en: "County not set" },
  },
  power_band: {
    "0-70": { et: "kuni 70 kW", en: "up to 70 kW" },
    "71-100": { et: "71–100 kW", en: "71–100 kW" },
    "101-150": { et: "101–150 kW", en: "101–150 kW" },
    "151-200": { et: "151–200 kW", en: "151–200 kW" },
    "201-300": { et: "201–300 kW", en: "201–300 kW" },
    "over-300": { et: "üle 300 kW", en: "over 300 kW" },
  },
  gearbox: {
    automaat: { et: "Automaat", en: "Automatic" },
    manuaal: { et: "Manuaal", en: "Manual" },
    cvt: { et: "Variaator (CVT)", en: "CVT" },
    dct: { et: "Topeltsidur (DCT)", en: "Dual-clutch (DCT)" },
    amt: { et: "AMT", en: "AMT" },
    automat_manuaal: { et: "Automatiseeritud manuaal", en: "Automated manual" },
    konstantne_ylekanne: { et: "Konstantne ülekanne", en: "Constant ratio" },
    hydrauliline: { et: "Hüdrauliline", en: "Hydraulic" },
    rummusisene: { et: "Rummusisene", en: "Hub gear" },
    muu: { et: "Muu", en: "Other" },
  },
  colour: {
    must: { et: "Must", en: "Black" },
    hall: { et: "Hall", en: "Grey" },
    helehall: { et: "Helehall", en: "Light grey" },
    tumehall: { et: "Tumehall", en: "Dark grey" },
    valge: { et: "Valge", en: "White" },
    hobedane: { et: "Hõbedane", en: "Silver" },
    sinine: { et: "Sinine", en: "Blue" },
    helesinine: { et: "Helesinine", en: "Light blue" },
    tumesinine: { et: "Tumesinine", en: "Dark blue" },
    punane: { et: "Punane", en: "Red" },
    tumepunane: { et: "Tumepunane", en: "Dark red" },
    helepunane: { et: "Helepunane", en: "Light red" },
    roheline: { et: "Roheline", en: "Green" },
    heleroheline: { et: "Heleroheline", en: "Light green" },
    tumeroheline: { et: "Tumeroheline", en: "Dark green" },
    pruun: { et: "Pruun", en: "Brown" },
    helepruun: { et: "Helepruun", en: "Light brown" },
    tumepruun: { et: "Tumepruun", en: "Dark brown" },
    beez: { et: "Beež", en: "Beige" },
    helebeez: { et: "Helebeež", en: "Light beige" },
    kollane: { et: "Kollane", en: "Yellow" },
    helekollane: { et: "Helekollane", en: "Light yellow" },
    tumekollane: { et: "Tumekollane", en: "Dark yellow" },
    oranz: { et: "Oranž", en: "Orange" },
    kuldne: { et: "Kuldne", en: "Gold" },
    lilla: { et: "Lilla", en: "Purple" },
    roosa: { et: "Roosa", en: "Pink" },
  },
};

export const UNKNOWN_LABEL = { et: "Allikas ei märgi", en: "Not stated in the source" };

export function localizedLabel(
  map: Record<string, { et: string; en: string }>,
  code: string,
  locale: string,
  fallback?: string,
): string {
  const entry = map[code];
  if (!entry) return fallback ?? code;
  return locale === "en" ? entry.en : entry.et;
}
