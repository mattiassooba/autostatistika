"use client";

import { useState } from "react";

const GAP_MONTHS = 13;

function monthIndex(key: string) {
  return Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
}

/**
 * Compact column strip for one value over many dates (stock snapshots).
 * Columns sit on a time axis, so monthly and yearly snapshots keep their real
 * spacing; stretches longer than a year without any snapshot are hatched.
 * Each column is a button; the selected one is ink, hover/focus shows the
 * value in the readout line, so nothing depends on a floating tooltip.
 */
export function MiniColumns({
  items,
  selected,
  onSelect,
  formatValue,
  formatLabel,
  label,
  gapLabel,
  height = 120,
}: {
  items: Array<{ key: string; value: number }>;
  selected: string;
  onSelect: (key: string) => void;
  formatValue: (value: number) => string;
  formatLabel: (key: string) => string;
  label: string;
  /** Accessible text for a hatched stretch without snapshots, e.g. "2016–2019: no snapshot". */
  gapLabel?: (from: string, to: string) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((item) => item.value));
  const min = Math.min(...items.map((item) => item.value));
  const focus = items.find((item) => item.key === (hover ?? selected)) ?? items[items.length - 1];
  if (!items.length) return null;

  const months = items.map((item) => monthIndex(item.key));
  const start = months[0];
  const slots = months[months.length - 1] - start + 1;
  const pct = (slot: number) => `${(slot / slots) * 100}%`;
  // Each button reaches halfway to its neighbours (at most half a year), so
  // isolated yearly snapshots stay easy to hit without covering a gap.
  const reach = (index: number, side: -1 | 1) => {
    const neighbour = months[index + side];
    if (neighbour == null) return 0.5;
    return Math.min(6, Math.abs(neighbour - months[index]) / 2);
  };
  const gaps = months.slice(1).flatMap((month, index) =>
    month - months[index] > GAP_MONTHS ? [{ from: months[index] + 1, to: month - 1, fromKey: items[index].key, toKey: items[index + 1].key }] : [],
  );
  const firstYear = Math.floor(start / 12);
  const lastYear = Math.floor((start + slots - 1) / 12);
  const step = lastYear - firstYear > 16 ? 4 : lastYear - firstYear > 8 ? 2 : 1;
  const yearLabels = [];
  for (let year = Math.ceil(firstYear / step) * step; year <= lastYear; year += step) yearLabels.push(year);

  return (
    <div>
      <p className="tabular flex items-baseline justify-between gap-3 text-[13px]" aria-live="polite">
        <span className="text-muted">{focus ? formatLabel(focus.key) : ""}</span>
        <span className="font-semibold text-ink">{focus ? formatValue(focus.value) : ""}</span>
      </p>
      <div className="relative mt-2" style={{ height }} role="group" aria-label={label}>
        {gaps.map((gap) => (
          <span
            key={gap.from}
            role="img"
            aria-label={gapLabel?.(gap.fromKey, gap.toKey)}
            aria-hidden={gapLabel ? undefined : true}
            className="hatch absolute bottom-0 top-[18%] rounded-[3px] text-graphite/20"
            style={{ left: pct(gap.from - start + 0.5), width: pct(gap.to - gap.from) }}
          />
        ))}
        {items.map((item, index) => {
          const active = item.key === selected;
          const left = months[index] - start + 0.5 - reach(index, -1);
          const width = reach(index, -1) + reach(index, 1);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              onPointerEnter={() => setHover(item.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(item.key)}
              onBlur={() => setHover(null)}
              aria-pressed={active}
              aria-label={`${formatLabel(item.key)}: ${formatValue(item.value)}`}
              className="group absolute bottom-0 top-0 cursor-pointer"
              style={{ left: pct(left), width: pct(width) }}
            >
              <span
                className={`absolute bottom-0 block rounded-t-[2px] transition-colors ${
                  active ? "bg-ink" : item.key === hover ? "bg-graphite" : "bg-[#9FB0A8] group-hover:bg-graphite"
                }`}
                style={{
                  height: `${Math.max(4, (item.value / max) * 100)}%`,
                  // The column covers its own month: one slot minus a hairline, never thinner than 3px.
                  left: `${((reach(index, -1) - 0.5) / width) * 100}%`,
                  width: `max(3px, calc(${100 / width}% - 1px))`,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted" aria-hidden="true">
        {yearLabels.map((year) => (
          <span key={year} className="tabular absolute" style={{ left: pct(Math.max(0, year * 12 - start)) }}>
            {year}
          </span>
        ))}
      </div>
      {min !== max && <span className="sr-only">{`${formatValue(min)} – ${formatValue(max)}`}</span>}
    </div>
  );
}
