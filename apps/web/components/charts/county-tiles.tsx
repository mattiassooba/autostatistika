"use client";

import { useState } from "react";
import { sequential, textOn } from "@/lib/design/tokens";

// Tile cartogram of Estonia's 15 counties, laid out to keep neighbours close:
// islands west, Harju north, Ida-Viru north-east, Võru south-east.
const LAYOUT: Record<string, [number, number]> = {
  harju: [2, 0],
  "laane-viru": [3, 0],
  "ida-viru": [4, 0],
  hiiu: [0, 1],
  laane: [1, 1],
  rapla: [2, 1],
  jarva: [3, 1],
  jogevamaa: [4, 1],
  saare: [0, 2],
  parnu: [1, 2],
  viljandi: [2, 2],
  tartu: [3, 2],
  polva: [4, 2],
  valga: [3, 3],
  voru: [4, 3],
};

export type CountyDatum = { code: string; name: string; value: number; share: number | null };

/**
 * Sequential lime ramp on a log scale (Harju alone holds ~40 % of most
 * stocks, so a linear scale would flatten every other county). The legend
 * states the bin edges so the encoding is never implicit.
 */
export function CountyTiles({
  rows,
  formatValue,
  formatShare,
  selected,
  onSelect,
  label,
  legendLabel,
}: {
  rows: CountyDatum[];
  formatValue: (value: number) => string;
  formatShare: (value: number | null) => string;
  selected: string | null;
  onSelect: (code: string | null) => void;
  label: string;
  legendLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const values = rows.map((row) => row.value).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lmin = Math.log(min);
  const lmax = Math.log(max);
  const bins = sequential.length;
  const edges = Array.from({ length: bins + 1 }, (_, i) => Math.exp(lmin + ((lmax - lmin) * i) / bins));
  const binOf = (value: number) =>
    lmax === lmin ? bins - 1 : Math.min(bins - 1, Math.floor(((Math.log(value) - lmin) / (lmax - lmin)) * bins));
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const focus = hover ?? selected;

  return (
    <div>
      <div className="grid aspect-[5/4] w-full max-w-[460px] grid-cols-5 grid-rows-4 gap-1.5" role="group" aria-label={label}>
        {Object.entries(LAYOUT).map(([code, [col, row]]) => {
          const datum = byCode.get(code);
          if (!datum) {
            return <div key={code} style={{ gridColumn: col + 1, gridRow: row + 1 }} className="hatch rounded-[8px] text-graphite/15" aria-hidden="true" />;
          }
          const fill = sequential[binOf(datum.value)];
          const isFocus = focus === code;
          const dim = focus != null && !isFocus;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelect(selected === code ? null : code)}
              onPointerEnter={() => setHover(code)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(code)}
              onBlur={() => setHover(null)}
              aria-pressed={selected === code}
              aria-label={`${datum.name}: ${formatValue(datum.value)}, ${formatShare(datum.share)}`}
              style={{ gridColumn: col + 1, gridRow: row + 1, background: fill, color: textOn(fill) }}
              className={`relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[8px] p-1.5 text-left transition-[opacity,transform,box-shadow] duration-200 sm:p-2 ${
                dim ? "opacity-45" : "opacity-100"
              } ${isFocus ? "z-10 scale-[1.04] shadow-[0_10px_24px_-10px_rgb(24_29_29/0.5)] ring-2 ring-ink" : ""}`}
            >
              <span className="truncate text-[10.5px] font-semibold leading-tight sm:text-[12px]" style={{ fontVariationSettings: '"wdth" 96' }}>
                {datum.name}
              </span>
              <span className="tabular text-[10px] leading-none opacity-80 sm:text-[11.5px]">{formatShare(datum.share)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 max-w-[460px]">
        <p className="text-[12px] text-muted">{legendLabel}</p>
        <div className="mt-1.5 flex gap-[2px]" aria-hidden="true">
          {sequential.map((fill) => (
            <span key={fill} className="h-2.5 flex-1 first:rounded-l-[3px] last:rounded-r-[3px]" style={{ background: fill }} />
          ))}
        </div>
        <div className="tabular mt-1 flex justify-between text-[11px] text-muted">
          <span>{formatValue(edges[0])}</span>
          <span>{formatValue(Math.exp((lmin + lmax) / 2))}</span>
          <span>{formatValue(edges[bins])}</span>
        </div>
      </div>
    </div>
  );
}
