// Labels for the register's own codes (open register file, README in the
// dataset). A code without an entry shows the source's text in sentence case.

import { BREAKDOWN_LABELS, FUEL_LABELS, STATUS_LABELS } from "@/lib/data/labels";

type Labels = Record<string, { et: string; en: string }>;

const ENGINE: Labels = {
  BENSIIN: FUEL_LABELS.petrol,
  BENSIIN_KATALYSAATOR: FUEL_LABELS.petrol_catalyst,
  BENSIIN_HYBRIID: FUEL_LABELS.petrol_hybrid,
  DIISEL: FUEL_LABELS.diesel,
  DIISEL_HYBRIID: FUEL_LABELS.diesel_hybrid,
  ELEKTER: FUEL_LABELS.electric,
  CNG: { et: "Surugaas (CNG)", en: "Compressed gas (CNG)" },
  LPG: { et: "Vedelgaas (LPG)", en: "Liquefied gas (LPG)" },
  GAAS: FUEL_LABELS.gas,
};

const STATUS: Labels = {
  REGISTREERITUD: STATUS_LABELS.registered,
  PEATATUD: STATUS_LABELS.suspended,
};

const STATUS_DETAIL: Labels = {
  REGISTRIS_OLEV_SOIDUK: { et: "Registris olev sõiduk", en: "Vehicle in the register" },
  KANNE_PEATATUD: { et: "Kanne peatatud", en: "Record suspended" },
  VOORANDATUD: { et: "Võõrandatud", en: "Transferred" },
  AJUTISELT_REGISTRIST_KUSTUT: { et: "Ajutiselt registrist kustutatud", en: "Temporarily deleted" },
  REG_YLEVAATUSE_LABINUD_REGISTR: { et: "Registreerimiseelse ülevaatuse läbinud", en: "Passed pre-registration inspection" },
  EKSPERTIISI_KONTROLLIMINE: { et: "Ekspertiisi kontrollimine", en: "Under expert examination" },
  AJUTISELT_REGISTREERITUD: { et: "Ajutiselt registreeritud", en: "Temporarily registered" },
  VOORANDATUD_RM_LABINUD: { et: "Võõrandatud, registreerimiseelse ülevaatuse läbinud", en: "Transferred, passed pre-registration inspection" },
  REGISTRIST_KUSTUTATUD: { et: "Registrist kustutatud", en: "Deleted from the register" },
};

const OWNER: Labels = {
  FYYSILINE: { et: "Eraisik", en: "Private person" },
  JURIIDILINE: { et: "Juriidiline isik", en: "Legal entity" },
};

const HYBRID: Labels = {
  NOVC_HEV: { et: "Hübriid (pistikuta)", en: "Hybrid (not plug-in)" },
  OVC_HEV: { et: "Pistikhübriid", en: "Plug-in hybrid" },
  NOVC_FCHV: { et: "Kütuseelemendiga hübriid", en: "Fuel-cell hybrid" },
};

const FUEL_COMBINATION: Labels = {
  YHEKYTUSELINE: { et: "Ühekütuseline", en: "Single fuel" },
  HYBRIIDSOIDUK: { et: "Hübriidsõiduk", en: "Hybrid vehicle" },
  ELEKTRISOIDUK: { et: "Elektrisõiduk", en: "Electric vehicle" },
  KAHEKYTUSELINE: { et: "Kahekütuseline", en: "Bi-fuel" },
  SEGAKYTUSELINE: { et: "Segakütuseline", en: "Flex-fuel" },
  MITMEKYTUSELINE: { et: "Mitmekütuseline", en: "Multi-fuel" },
  SEGAKAHEKYTUSELINE: { et: "Sega- ja kahekütuseline", en: "Flex-fuel and bi-fuel" },
};

const BODY: Labels = {
  UNIVERSAAL: { et: "Universaal", en: "Estate" },
  SEDAAN: { et: "Sedaan", en: "Saloon" },
  LUUKPÄRA: { et: "Luukpära", en: "Hatchback" },
  MAHTUNIVERSAAL: { et: "Mahtuniversaal", en: "MPV" },
  "MITMEOTSTARBELINE SÕIDUK": { et: "Mitmeotstarbeline sõiduk", en: "Multi-purpose vehicle" },
  KUPEE: { et: "Kupee", en: "Coupé" },
  KABRIOLETT: { et: "Kabriolett", en: "Convertible" },
  PIKAP: { et: "Pikap", en: "Pick-up" },
  LIMUSIIN: { et: "Limusiin", en: "Limousine" },
  KAUBIK: { et: "Kaubik", en: "Van" },
  MADEL: { et: "Madel", en: "Flatbed trailer" },
  "JÄIGA RAAMIGA": { et: "Jäiga raamiga", en: "Rigid frame" },
  MOOTORRATAS: { et: "Mootorratas", en: "Motorcycle" },
  MOPEED: { et: "Mopeed", en: "Moped" },
  PAADIVEOK: { et: "Paadiveok", en: "Boat trailer" },
  SIHTOTSTARBELINE: { et: "Sihtotstarbeline", en: "Special purpose" },
  KALLUR: { et: "Kallur", en: "Tipper" },
  SADUL: { et: "Sadul", en: "Tractor unit" },
  ELAMU: { et: "Elamu", en: "Motorhome / caravan" },
  LAHTINE: { et: "Lahtine", en: "Open" },
  FURGOON: { et: "Furgoon", en: "Box body" },
  KVADRIK: { et: "Kvadrik", en: "Quadricycle" },
  BUSS: { et: "Buss", en: "Bus" },
  MOOTORSAAN: { et: "Mootorsaan", en: "Snowmobile" },
  RATASMAASTIKUSÕIDUK: { et: "Ratasmaastikusõiduk", en: "Wheeled off-road vehicle" },
  MOTOROLLER: { et: "Motoroller", en: "Scooter" },
  ENDUURO: { et: "Enduuro", en: "Enduro" },
  MUU: { et: "Muu", en: "Other" },
};

// The register's bare county names (VKOM_MAAKOND) → the county codes used elsewhere.
const COUNTY_CODES: Record<string, string> = {
  Harju: "harju",
  Hiiu: "hiiu",
  "Ida-Viru": "ida-viru",
  Jõgeva: "jogevamaa",
  Järva: "jarva",
  Lääne: "laane",
  "Lääne-Viru": "laane-viru",
  Põlva: "polva",
  Pärnu: "parnu",
  Rapla: "rapla",
  Saare: "saare",
  Tartu: "tartu",
  Valga: "valga",
  Viljandi: "viljandi",
  Võru: "voru",
};

export function countyCode(value: string): string {
  return COUNTY_CODES[value] ?? (value ? value.toLowerCase() : "unassigned");
}

function sentence(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const BY_DIMENSION: Record<string, Labels | ((value: string) => Labels[string] | undefined)> = {
  engine: ENGINE,
  status: STATUS,
  status_detail: STATUS_DETAIL,
  owner: OWNER,
  hybrid: HYBRID,
  fuel_combination: FUEL_COMBINATION,
  body: BODY,
  gearbox: (value) => BREAKDOWN_LABELS.gearbox[value.toLowerCase()],
  colour: (value) => BREAKDOWN_LABELS.colour[value.toLowerCase()],
  county: (value) => BREAKDOWN_LABELS.county[countyCode(value)],
};

/** Label for a register value; empty values are "not stated in the source", never guessed. */
export function valueLabel(dimension: string, value: string, locale: string, notStated: string): string {
  if (!value) return notStated;
  const source = BY_DIMENSION[dimension];
  const entry = typeof source === "function" ? source(value) : source?.[value];
  if (entry) return locale === "en" ? entry.en : entry.et;
  return dimension === "euro" || dimension === "category" || dimension === "body_code" ? value : sentence(value);
}
