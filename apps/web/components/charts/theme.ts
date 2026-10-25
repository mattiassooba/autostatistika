// Chart design system: one place for type, axes, gridlines, tooltips and
// motion so every chart reads as part of the same product.

import { chartMotion, color } from "@/lib/design/tokens";

export function chartFont(): string {
  if (typeof window === "undefined") return "Archivo, sans-serif";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim();
  return value ? `${value}, sans-serif` : "Archivo, sans-serif";
}

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function base(dark = false) {
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: chartFont(), color: dark ? color.paper : color.ink },
    animationDuration: chartMotion.enter,
    animationDurationUpdate: chartMotion.update,
    animationEasing: "cubicOut" as const,
    animationEasingUpdate: "cubicInOut" as const,
  };
}

export function axisLabel(dark = false) {
  return {
    color: dark ? color.mist : color.muted,
    fontSize: 11.5,
    fontFamily: chartFont(),
  };
}

export function splitLine(dark = false) {
  return { lineStyle: { color: dark ? "rgba(247,247,243,0.08)" : color.rule, width: 1, type: "solid" as const } };
}

export function tooltipBase(dark = false) {
  return {
    backgroundColor: dark ? color.paper : color.ink,
    borderWidth: 0,
    padding: [10, 12],
    textStyle: { color: dark ? color.ink : color.paper, fontFamily: chartFont(), fontSize: 12.5 },
    extraCssText:
      "border-radius:12px;box-shadow:0 16px 40px -12px rgba(24,29,29,.45);pointer-events:none;",
    transitionDuration: 0.18,
    confine: true,
  };
}

export type TipRow = { color?: string; label: string; value: string; sub?: string; line?: boolean; strong?: boolean };

/** Tooltip body: value leads, label follows; series keyed by a short line. */
export function tipHtml({ title, rows, foot, dark = false }: { title: string; rows: TipRow[]; foot?: string; dark?: boolean }) {
  const muted = dark ? "#5E6965" : "#A8B2AD";
  const body = rows
    .map((row) => {
      const key = row.color
        ? row.line
          ? `<span style="display:inline-block;width:12px;height:2px;border-radius:2px;background:${row.color};margin-right:8px;vertical-align:middle"></span>`
          : `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${row.color};margin-right:8px;vertical-align:middle"></span>`
        : "";
      return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:18px;margin-top:5px">
        <span style="color:${muted};white-space:nowrap">${key}${esc(row.label)}</span>
        <span style="font-variant-numeric:tabular-nums;font-weight:${row.strong === false ? 500 : 600};white-space:nowrap">${esc(row.value)}${
          row.sub ? `<span style="color:${muted};font-weight:400;margin-left:6px">${esc(row.sub)}</span>` : ""
        }</span>
      </div>`;
    })
    .join("");
  return `<div style="min-width:180px">
    <div style="font-weight:600;letter-spacing:-.005em">${esc(title)}</div>
    ${body}
    ${foot ? `<div style="margin-top:8px;padding-top:7px;border-top:1px solid ${dark ? "#DDE1DB" : "#333D3D"};color:${muted};font-size:11.5px;max-width:240px;white-space:normal">${esc(foot)}</div>` : ""}
  </div>`;
}
