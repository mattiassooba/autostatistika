"use client";

import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";

const monthIndex = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return y * 12 + (m - 1);
};

/**
 * Continuous timeline for dense monthly data. Every available month is a
 * position on one track; months without data are hatched gaps on the same
 * track, so coverage stays honest at any density. Slider semantics: arrows
 * step one available month, PageUp/PageDown a year, Home/End the ends.
 */
export function TimeScrubber({
  stops,
  value,
  onChange,
  label,
  formatValue,
  tone = "dark",
}: {
  stops: string[];
  value: string;
  onChange: (stop: string) => void;
  label: string;
  formatValue: (stop: string) => string;
  tone?: "light" | "dark";
}) {
  const track = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";
  const sorted = useMemo(() => [...stops].sort(), [stops]);
  const first = monthIndex(sorted[0]);
  const last = monthIndex(sorted[sorted.length - 1]);
  const span = Math.max(1, last - first);
  const pos = (period: string) => ((monthIndex(period) - first) / span) * 100;
  const index = Math.max(0, sorted.indexOf(value));

  // Missing stretches between consecutive available months.
  const gaps = useMemo(() => {
    const out: Array<{ from: number; to: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = monthIndex(sorted[i - 1]);
      const b = monthIndex(sorted[i]);
      if (b - a > 1) out.push({ from: ((a - first) / span) * 100, to: ((b - first) / span) * 100 });
    }
    return out;
  }, [sorted, first, span]);

  const years = useMemo(() => {
    const startYear = Math.floor(first / 12);
    const endYear = Math.floor(last / 12);
    const step = endYear - startYear > 12 ? 5 : endYear - startYear > 5 ? 2 : 1;
    const out: number[] = [];
    for (let y = Math.ceil(startYear / step) * step; y <= endYear; y += step) out.push(y);
    return out;
  }, [first, last]);

  function nearest(clientX: number) {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return value;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const target = first + ratio * span;
    let best = sorted[0];
    for (const stop of sorted) if (Math.abs(monthIndex(stop) - target) < Math.abs(monthIndex(best) - target)) best = stop;
    return best;
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.type === "pointerdown") (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    if (event.type === "pointermove" && event.buttons !== 1) return;
    const stop = nearest(event.clientX);
    if (stop !== value) onChange(stop);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = index - 1;
    else if (event.key === "PageUp") next = sorted.findIndex((s) => monthIndex(s) >= monthIndex(value) + 12);
    else if (event.key === "PageDown") {
      const target = monthIndex(value) - 12;
      next = sorted.reduce((acc, s, i) => (monthIndex(s) <= target ? i : acc), 0);
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sorted.length - 1;
    else return;
    event.preventDefault();
    if (next < 0) next = sorted.length - 1;
    next = Math.min(sorted.length - 1, Math.max(0, next));
    onChange(sorted[next]);
  }

  return (
    <div className={dark ? "on-dark" : ""}>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={sorted.length - 1}
        aria-valuenow={index}
        aria-valuetext={formatValue(value)}
        onKeyDown={onKey}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        className="relative h-10 cursor-pointer touch-none select-none rounded-md"
      >
        <span className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full ${dark ? "bg-paper/25" : "bg-graphite/25"}`} />
        {gaps.map((gap) => (
          <span
            key={gap.from}
            className={`hatch absolute top-1/2 h-[9px] -translate-y-1/2 ${dark ? "bg-ink text-paper/40" : "bg-paper text-graphite/40"}`}
            style={{ left: `${gap.from}%`, width: `${gap.to - gap.from}%` }}
            aria-hidden="true"
          />
        ))}
        <span
          className={`absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full ${dark ? "bg-lime/70" : "bg-ink/70"}`}
          style={{ left: 0, width: `${pos(value)}%` }}
          aria-hidden="true"
        />
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-200 ease-out"
          style={{ left: `${pos(value)}%` }}
          aria-hidden="true"
        >
          <span className={`block h-5 w-5 rounded-full ring-4 ${dark ? "bg-lime ring-lime/20" : "bg-ink ring-ink/10"}`} />
        </span>
      </div>
      <div className="relative mt-1 h-4" aria-hidden="true">
        {years.map((year) => {
          const left = ((year * 12 - first) / span) * 100;
          if (left < 0 || left > 100) return null;
          return (
            <span
              key={year}
              className={`tabular absolute -translate-x-1/2 text-[11px] ${dark ? "text-paper/45" : "text-muted"}`}
              style={{ left: `${left}%` }}
            >
              {year}
            </span>
          );
        })}
      </div>
    </div>
  );
}
