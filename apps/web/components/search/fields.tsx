"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Combobox, type ComboOption } from "../ui/combobox";
import { Popover } from "../ui/popover";

/** A filter that picks several values from a searchable list (Popover + Combobox). */
export function MultiPick({
  label,
  options,
  values,
  onChange,
  summary,
  placeholder,
  anyText,
  emptyText,
  disabledText,
}: {
  label: string;
  options: ComboOption[];
  values: string[];
  onChange: (values: string[]) => void;
  /** Trigger text when something is chosen. */
  summary: string;
  placeholder: string;
  /** Trigger text when nothing is chosen. */
  anyText: string;
  emptyText: string;
  /** When set the field is disabled and explains why. */
  disabledText?: string;
}) {
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[12.5px] text-muted">{label}</span>
      <Popover
        label={label}
        width="w-80"
        block
        trigger={({ open, toggle: toggleOpen, id, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggleOpen}
            disabled={Boolean(disabledText)}
            aria-expanded={open}
            aria-controls={id}
            aria-haspopup="dialog"
            title={disabledText}
            className={`press flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3.5 text-left text-[14.5px] ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
              open ? "bg-paper ring-2 ring-ink" : values.length ? "bg-lime-wash text-ink ring-ink/30 hover:ring-ink/60" : "bg-paper text-graphite ring-rule-strong hover:ring-ink/50"
            }`}
          >
            <span className="truncate">{disabledText ?? (values.length ? summary : anyText)}</span>
            <CaretDown size={13} weight="bold" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      >
        <div className="p-2">
          <Combobox options={options} selected={values} onPick={toggle} placeholder={placeholder} label={label} emptyText={emptyText} autoFocus />
        </div>
      </Popover>
    </div>
  );
}

/** Min–max number input. Commits on blur or Enter so typing never searches half a number. */
export function RangeField({
  label,
  unit,
  value,
  onChange,
  minLabel,
  maxLabel,
  note,
}: {
  label: string;
  unit?: string;
  value: [number | null, number | null] | undefined;
  onChange: (value: [number | null, number | null] | undefined) => void;
  minLabel: string;
  maxLabel: string;
  note?: string;
}) {
  const [low, setLow] = useState(value?.[0]?.toString() ?? "");
  const [high, setHigh] = useState(value?.[1]?.toString() ?? "");
  useEffect(() => {
    setLow(value?.[0]?.toString() ?? "");
    setHigh(value?.[1]?.toString() ?? "");
  }, [value]);
  function commit(nextLow = low, nextHigh = high) {
    const read = (text: string) => {
      const number = Number(text.replace(",", ".").replace(/\s/g, ""));
      return text.trim() === "" || !Number.isFinite(number) ? null : number;
    };
    const a = read(nextLow);
    const b = read(nextHigh);
    const next: [number | null, number | null] | undefined = a == null && b == null ? undefined : [a, b];
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
  };
  const input = `h-11 w-full min-w-0 rounded-[10px] px-3 text-[14.5px] text-ink ring-1 tabular placeholder:text-muted hover:ring-ink/50 focus:outline-none focus:ring-2 focus:ring-ink ${
    value ? "bg-lime-wash ring-ink/30" : "bg-paper ring-rule-strong"
  }`;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 block text-[12.5px] text-muted">
        {label}
        {unit ? <span className="text-muted/80"> · {unit}</span> : null}
      </legend>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          inputMode="decimal"
          aria-label={`${label}, ${minLabel}`}
          placeholder={minLabel}
          value={low}
          onChange={(event) => setLow(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKey}
          className={input}
        />
        <input
          inputMode="decimal"
          aria-label={`${label}, ${maxLabel}`}
          placeholder={maxLabel}
          value={high}
          onChange={(event) => setHigh(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKey}
          className={input}
        />
      </div>
      {note && <p className="mt-1 text-[11.5px] text-muted">{note}</p>}
    </fieldset>
  );
}
