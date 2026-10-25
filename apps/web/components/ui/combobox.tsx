"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, MagnifyingGlass } from "@phosphor-icons/react";

export type ComboOption = { value: string; label: string; meta?: string; swatch?: string };

/**
 * Searchable listbox (ARIA 1.2 combobox pattern). Typing filters, arrows move
 * the active option, Enter picks. Accent- and case-insensitive matching so
 * "skoda" finds "ŠKODA" and "citroen" finds "CITROËN".
 */
export function Combobox({
  options,
  selected,
  onPick,
  placeholder,
  label,
  emptyText,
  limitText,
  atLimit = false,
  autoFocus = false,
}: {
  options: ComboOption[];
  selected: string[];
  onPick: (value: string) => void;
  placeholder: string;
  label: string;
  emptyText: string;
  limitText?: string;
  atLimit?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const filtered = useMemo(() => {
    const needle = normalize(text.trim());
    return needle ? options.filter((option) => normalize(option.label).includes(needle)) : options;
  }, [options, text]);

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) onPick(option.value);
    }
  }

  return (
    <div className="flex flex-col">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={filtered[active] ? `${id}-${filtered[active].value}` : undefined}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="h-11 w-full rounded-[10px] bg-paper-2 pl-9 pr-3 text-[15px] text-ink placeholder:text-muted focus:bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </label>
      {atLimit && limitText && <p className="px-1 pt-2 text-[12.5px] text-muted">{limitText}</p>}
      <ul id={`${id}-list`} role="listbox" aria-label={label} className="mt-1.5 max-h-72 overflow-y-auto overscroll-contain py-1">
        {filtered.length === 0 && <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>}
        {filtered.map((option, index) => {
          const isSelected = selected.includes(option.value);
          const disabled = atLimit && !isSelected;
          return (
            <li
              key={option.value}
              id={`${id}-${option.value}`}
              role="option"
              aria-selected={isSelected}
              aria-disabled={disabled || undefined}
              onPointerEnter={() => setActive(index)}
              onClick={() => !disabled && onPick(option.value)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] px-3 text-[14.5px] transition-colors ${
                index === active ? "bg-paper-2" : ""
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-rule-strong"
                style={{ background: option.swatch ?? "transparent" }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{option.label}</span>
              {option.meta && <span className="tabular text-[12.5px] text-muted">{option.meta}</span>}
              <span className="flex w-4 justify-end">{isSelected && <Check size={15} weight="bold" />}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
