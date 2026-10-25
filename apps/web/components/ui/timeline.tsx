"use client";

import { motion } from "motion/react";
import { useRef, type KeyboardEvent } from "react";
import { fmtGap } from "@/lib/format";
import { motion as tokens } from "@/lib/design/tokens";

/**
 * Coverage timeline with a broken axis. Each imported period is a stop; the
 * time between stops is drawn as a hatched gap labelled with its length, so
 * the reader always sees that the months are not consecutive.
 */
export function CoverageTimeline({
  stops,
  value,
  onChange,
  formatStop,
  label,
  gapTitle,
  locale,
  tone = "light",
}: {
  stops: string[];
  value: string;
  onChange: (stop: string) => void;
  formatStop: (stop: string) => { top: string; bottom: string };
  label: string;
  gapTitle: (from: string, to: string, distance: string) => string;
  locale: string;
  tone?: "light" | "dark";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const dark = tone === "dark";
  const activeIndex = Math.max(0, stops.indexOf(value));

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(stops.length - 1, index + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = stops.length - 1;
    else return;
    event.preventDefault();
    onChange(stops[next]);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={`relative ${dark ? "on-dark" : ""}`}>
      <div className="flex items-start">
        {stops.map((stop, index) => {
          const active = index === activeIndex;
          const passed = index <= activeIndex;
          const text = formatStop(stop);
          const next = stops[index + 1];
          return (
            <div key={stop} className={`flex items-start ${next ? "flex-1" : ""}`}>
              <button
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(stop)}
                onKeyDown={(event) => onKey(event, index)}
                className="group relative flex min-w-11 cursor-pointer flex-col items-center gap-2 rounded-md px-1 pb-1 pt-0.5"
              >
                <span className="relative flex h-5 w-5 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId={`tl-${label}`}
                      transition={tokens.spring}
                      className={`absolute inset-0 rounded-full ${dark ? "bg-lime/20" : "bg-ink/10"}`}
                    />
                  )}
                  <span
                    className={`relative block rounded-full transition-all duration-300 ${
                      active
                        ? `h-3 w-3 ${dark ? "bg-lime" : "bg-ink"}`
                        : passed
                          ? `h-2 w-2 ${dark ? "bg-paper/80" : "bg-graphite"}`
                          : `h-2 w-2 ${dark ? "bg-paper/35 group-hover:bg-paper/70" : "bg-mist group-hover:bg-graphite"}`
                    }`}
                  />
                </span>
                <span className="flex flex-col items-center leading-tight">
                  <span
                    className={`tabular whitespace-nowrap text-[12px] transition-colors ${
                      active ? (dark ? "font-semibold text-paper" : "font-semibold text-ink") : dark ? "text-paper/55" : "text-muted"
                    }`}
                  >
                    {text.top}
                  </span>
                  <span className={`tabular text-[11px] ${dark ? "text-paper/40" : "text-muted/80"}`}>{text.bottom}</span>
                </span>
              </button>
              {next && (
                <div
                  className="relative mx-0.5 mt-[9px] flex h-[3px] flex-1 items-center"
                  title={gapTitle(stop, next, fmtGap(stop, next, locale, false))}
                >
                  <span
                    className={`hatch absolute inset-x-0 top-1/2 h-[7px] -translate-y-1/2 rounded-[2px] ${
                      dark ? "text-paper/25" : "text-graphite/30"
                    }`}
                  />
                  <span
                    className={`relative mx-auto -mt-5 whitespace-nowrap rounded px-1 text-[10.5px] tabular ${
                      dark ? "bg-ink text-paper/50" : "bg-paper text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {fmtGap(stop, next, locale)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
