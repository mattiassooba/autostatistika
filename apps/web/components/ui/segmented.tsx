"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion as tokens } from "@/lib/design/tokens";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  role?: "tablist" | "radiogroup";
  /** id prefix for aria-controls when used as tabs */
  controls?: string;
  className?: string;
  stretch?: boolean;
};

/**
 * Segmented control with a sliding active plate and roving focus.
 * Arrow keys move selection, Home/End jump. Works as tabs or a radio group.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "light",
  size = "md",
  role = "radiogroup",
  controls,
  className = "",
  stretch = false,
}: Props<T>) {
  const group = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((option) => !option.disabled);

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const currentEnabled = enabled.findIndex((option) => option.value === options[index].value);
    let next = currentEnabled;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (currentEnabled + 1) % enabled.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (currentEnabled - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    const target = enabled[next];
    onChange(target.value);
    refs.current[options.indexOf(target)]?.focus();
  }

  const dark = tone === "dark";
  const pad =
    size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-12 px-4 text-[15px] md:px-5" : "h-10 px-3 text-[13.5px] sm:px-3.5 sm:text-sm";

  return (
    <div
      role={role}
      aria-label={label}
      className={`relative inline-flex items-center gap-0.5 rounded-full p-1 ${
        dark ? "bg-ink-3/80 ring-1 ring-white/8" : "bg-paper-2 ring-1 ring-rule"
      } ${stretch ? "w-full" : ""} ${dark ? "on-dark" : ""} ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const itemRole = role === "tablist" ? "tab" : "radio";
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role={itemRole}
            aria-selected={role === "tablist" ? active : undefined}
            aria-checked={role === "radiogroup" ? active : undefined}
            aria-controls={controls ? `${controls}-${option.value}` : undefined}
            aria-label={option.ariaLabel}
            id={role === "tablist" ? `${group}-${option.value}` : undefined}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKey(event, index)}
            className={`press relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${pad} ${
              stretch ? "flex-1" : ""
            } ${
              active
                ? dark
                  ? "text-ink"
                  : "text-paper"
                : dark
                  ? "text-paper/70 hover:text-paper"
                  : "text-graphite hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                className={`absolute inset-0 -z-10 rounded-full ${dark ? "bg-lime" : "bg-ink"}`}
                transition={tokens.spring}
              />
            )}
            {option.icon}
            <span className="t-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
