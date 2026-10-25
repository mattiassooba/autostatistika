"use client";

import { useState } from "react";

/**
 * Compact column strip for one value over many dates (stock snapshots).
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
  height = 120,
}: {
  items: Array<{ key: string; value: number }>;
  selected: string;
  onSelect: (key: string) => void;
  formatValue: (value: number) => string;
  formatLabel: (key: string) => string;
  label: string;
  height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((item) => item.value));
  const min = Math.min(...items.map((item) => item.value));
  const focus = items.find((item) => item.key === (hover ?? selected)) ?? items[items.length - 1];
  const years = items.filter((item, index) => index === 0 || item.key.slice(0, 4) !== items[index - 1].key.slice(0, 4));

  return (
    <div>
      <p className="tabular flex items-baseline justify-between gap-3 text-[13px]" aria-live="polite">
        <span className="text-muted">{focus ? formatLabel(focus.key) : ""}</span>
        <span className="font-semibold text-ink">{focus ? formatValue(focus.value) : ""}</span>
      </p>
      <div className="mt-2 flex items-end gap-[2px]" style={{ height }} role="group" aria-label={label}>
        {items.map((item) => {
          const active = item.key === selected;
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
              className="group flex h-full min-w-[3px] flex-1 cursor-pointer items-end"
            >
              <span
                className={`block w-full rounded-t-[2px] transition-colors ${
                  active ? "bg-ink" : item.key === hover ? "bg-graphite" : "bg-[#9FB0A8] group-hover:bg-graphite"
                }`}
                style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted" aria-hidden="true">
        {years
          .filter((_, i) => years.length < 12 || i % 2 === 0)
          .map((item) => (
            <span
              key={item.key}
              className="tabular absolute -translate-x-0"
              style={{ left: `${(items.indexOf(item) / items.length) * 100}%` }}
            >
              {item.key.slice(0, 4)}
            </span>
          ))}
      </div>
      {min !== max && <span className="sr-only">{`${formatValue(min)} – ${formatValue(max)}`}</span>}
    </div>
  );
}
