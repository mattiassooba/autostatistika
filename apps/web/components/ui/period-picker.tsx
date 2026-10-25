"use client";

import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Popover } from "./popover";

type Props = {
  /** Available values: "YYYY-MM" periods or "YYYY-MM-DD" stock dates. */
  items: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  formatValue: (value: string) => string;
  /** Render the grid inline (bottom sheet) instead of in a popover. */
  inline?: boolean;
  prevLabel: string;
  nextLabel: string;
};

/**
 * Year × month grid for picking a reporting period. Months without data are
 * visibly empty, so coverage is legible at a glance. Arrow buttons step to the
 * previous / next available value; arrow keys move within the grid.
 */
export function PeriodPicker({ items, value, onChange, label, formatValue, inline = false, prevLabel, nextLabel }: Props) {
  const sorted = useMemo(() => [...items].sort(), [items]);
  const index = sorted.indexOf(value);
  const prev = index > 0 ? sorted[index - 1] : null;
  const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null;

  const stepper = (
    <div className="inline-flex items-center rounded-full bg-paper ring-1 ring-rule-strong">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && onChange(prev)}
        aria-label={prevLabel}
        className="press flex h-10 w-9 cursor-pointer items-center justify-center rounded-l-full text-graphite hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <CaretLeft size={14} weight="bold" />
      </button>
      {inline ? (
        <span className="tabular min-w-[8.5rem] px-1 text-center text-[14px] font-medium">{formatValue(value)}</span>
      ) : (
        <Popover
          label={label}
          width="w-[22.5rem]"
          trigger={({ open, toggle, id, ref }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={id}
              aria-haspopup="dialog"
              aria-label={`${label}: ${formatValue(value)}`}
              className={`press tabular inline-flex h-10 min-w-[9rem] cursor-pointer items-center justify-center gap-2 px-2 text-[14px] font-medium transition-colors ${
                open ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"
              }`}
            >
              {formatValue(value)}
              <CaretDown size={12} weight="bold" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        >
          {(close) => (
            <Grid
              items={sorted}
              value={value}
              onPick={(picked) => {
                onChange(picked);
                close();
              }}
              label={label}
            />
          )}
        </Popover>
      )}
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onChange(next)}
        aria-label={nextLabel}
        className="press flex h-10 w-9 cursor-pointer items-center justify-center rounded-r-full text-graphite hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <CaretRight size={14} weight="bold" />
      </button>
    </div>
  );

  if (!inline) return stepper;
  return (
    <div className="flex flex-col gap-3">
      {stepper}
      <Grid items={sorted} value={value} onPick={onChange} label={label} />
    </div>
  );
}

function Grid({ items, value, onPick, label }: { items: string[]; value: string; onPick: (value: string) => void; label: string }) {
  const locale = useLocale();
  const scroller = useRef<HTMLDivElement>(null);
  const byMonth = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.slice(0, 7), item);
    return map;
  }, [items]);
  const years = useMemo(() => [...new Set(items.map((item) => Number(item.slice(0, 4))))].sort((a, b) => b - a), [items]);
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale === "et" ? "et-EE" : "en-GB", { month: "narrow", timeZone: "UTC" }).format(
          new Date(Date.UTC(2020, i, 1)),
        ),
      ),
    [locale],
  );

  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>("[aria-checked='true']")?.scrollIntoView({ block: "center" });
  }, []);

  function onKey(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const flat = items.map((item) => item.slice(0, 7));
    const i = flat.indexOf(key);
    let target = -1;
    if (event.key === "ArrowRight") target = i + 1;
    else if (event.key === "ArrowLeft") target = i - 1;
    else if (event.key === "ArrowUp") target = flat.findIndex((k) => k >= shiftYear(key, 1));
    else if (event.key === "ArrowDown") target = findLastIndex(flat, (k) => k <= shiftYear(key, -1));
    else return;
    event.preventDefault();
    if (target < 0 || target >= flat.length) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-key='${flat[target]}']`);
    el?.focus();
  }

  return (
    <div ref={scroller} role="radiogroup" aria-label={label} className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain p-2">
      <div className="sticky top-0 z-10 grid grid-cols-[3rem_repeat(12,minmax(0,1fr))] gap-1 bg-paper pb-1 text-center text-[11px] text-muted">
        <span />
        {monthNames.map((name, i) => (
          <span key={i}>{name}</span>
        ))}
      </div>
      {years.map((year) => (
        <div key={year} className="grid grid-cols-[3rem_repeat(12,minmax(0,1fr))] items-center gap-1 py-[2px]">
          <span className="tabular text-[12.5px] font-medium text-graphite">{year}</span>
          {Array.from({ length: 12 }, (_, m) => {
            const key = `${year}-${String(m + 1).padStart(2, "0")}`;
            const item = byMonth.get(key);
            const active = item === value;
            if (!item) {
              return <span key={key} className="hatch block h-7 rounded-[5px] text-graphite/15" aria-hidden="true" />;
            }
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                data-key={key}
                tabIndex={active ? 0 : -1}
                onClick={() => onPick(item)}
                onKeyDown={(event) => onKey(event, key)}
                aria-label={item}
                className={`h-7 cursor-pointer rounded-[5px] text-[11px] font-medium transition-colors ${
                  active ? "bg-ink text-lime" : "bg-paper-2 text-graphite hover:bg-lime-wash hover:text-ink"
                }`}
              >
                <span aria-hidden="true">{m + 1}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function shiftYear(key: string, delta: number) {
  return `${Number(key.slice(0, 4)) + delta}${key.slice(4)}`;
}

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean) {
  for (let i = list.length - 1; i >= 0; i--) if (predicate(list[i])) return i;
  return -1;
}
