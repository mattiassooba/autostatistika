// Design tokens shared by DOM components and ECharts options.
// Keep in sync with the @theme block in app/globals.css.

export const color = {
  paper: "#F7F7F3",
  paper2: "#EFEFE9",
  paper3: "#E6E7E0",
  ink: "#181D1D",
  ink2: "#1F2525",
  ink3: "#283030",
  graphite: "#313B3B",
  muted: "#5E6965",
  lime: "#D5F08B",
  limeDeep: "#B7D65F",
  limeWash: "#EEF7D3",
  mist: "#A8B2AD",
  rule: "#DDE1DB",
  ruleStrong: "#C5CCC6",
  ruleDark: "#333D3D",
} as const;

// Categorical slots for compared entities (brands). Validated with the dataviz
// six-checks: light adjacent CVD ΔE 9.9 / normal 18.8; dark CVD 11.9 / normal 17.3.
// The first three also pass all-pairs. Comparison is capped at four entities.
export const series = {
  light: ["#008A7B", "#D06A2C", "#5563D0", "#B04A86"],
  dark: ["#1BA391", "#D6722F", "#7B89F0", "#CF6AA3"],
} as const;

export const MAX_COMPARE = 4;

// Ordinal ramp (one hue, light → dark), validated with --ordinal on paper.
// Used for ordered bands such as vehicle age.
export const ordinal = ["#9FB0A8", "#6E827A", "#46594F", "#22302B"] as const;

// Sequential ramp for magnitude on the county tile map (lime family).
export const sequential = ["#EEF7D3", "#D5F08B", "#A9C95A", "#6F8F2C", "#3E5715"] as const;

// Motion tokens (seconds, for Motion for React).
export const motion = {
  press: 0.16,
  ui: 0.24,
  tab: 0.32,
  reveal: 0.6,
  chart: 0.7,
  rank: 0.85,
  easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
  easeStandard: [0.2, 0, 0, 1] as [number, number, number, number],
  spring: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as const,
  springSoft: { type: "spring", stiffness: 220, damping: 30 } as const,
};

// ECharts durations in ms.
export const chartMotion = {
  update: 700,
  rank: 850,
  enter: 900,
  easing: "cubicOut",
} as const;

export function seriesColor(index: number, dark = false): string {
  const slots = dark ? series.dark : series.light;
  return slots[index % slots.length];
}

// Pick ink or paper text for a label sitting inside a filled mark.
export function textOn(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.36 ? color.ink : color.paper;
}
