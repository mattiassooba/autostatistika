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
