"use client";

import { useState } from "react";
import { fmtGap } from "@/lib/format";
import type { RegistrationPoint } from "@/lib/data/views";

const NEW = "bg-ink";
const USED = "bg-[#9FB0A8]";

function niceScale(value: number) {
  if (value <= 0) return { max: 1, step: 1 };
  const raw = value / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * exp >= raw) ?? 10) * exp;
  return { max: Math.ceil(value / step) * step, step };
}

/**
 * Signature interaction 3 (historical exploration): the imported months as
 * columns on a broken time axis. Each column splits into new and used first
 * registrations; the hatched gaps state how much time lies between them.
 * Selecting a column sets the explorer's reporting month.
 */
export function MonthColumns({
  points,
  selected,
  onSelect,
  locale,
  formatValue,
  formatPeriod,
  labels,
  renderReadout,
}: {
  points: RegistrationPoint[];
  selected: string;
  onSelect: (period: string) => void;
  locale: string;
  formatValue: (value: number) => string;
  formatPeriod: (period: string) => string;
  labels: { neu: string; used: string; select: (period: string, value: string) => string; gap: (distance: string) => string; chart: string };
  renderReadout: (point: RegistrationPoint) => React.ReactNode;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { max, step } = niceScale(Math.max(...points.map((p) => p.first ?? 0)));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const active = points.find((p) => p.period === (hover ?? selected)) ?? points[points.length - 1];
  const plotH = 248;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0" role="group" aria-label={labels.chart}>
        <div className="mb-4 flex items-center gap-5 text-[12.5px] text-muted">
          <span className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-[2px] ${NEW}`} aria-hidden="true" />
            {labels.neu}
          </span>
          <span className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-[2px] ${USED}`} aria-hidden="true" />
            {labels.used}
          </span>
        </div>
        <div className="relative pl-12" style={{ height: plotH + 56 }}>
          {/* gridlines */}
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute left-12 right-0 border-t border-rule"
              style={{ bottom: 56 + (tick / max) * plotH }}
              aria-hidden="true"
            >
              <span className="tabular absolute -left-12 -top-2 w-10 text-right text-[11px] text-muted">{formatValue(tick)}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-[56px] left-12 border-t border-ink" aria-hidden="true" />
          <div className="absolute bottom-0 left-12 right-0 flex items-end" style={{ height: plotH + 56 }}>
            {points.map((point, index) => {
              const next = points[index + 1];
              const isSelected = point.period === selected;
              const isHover = point.period === hover;
              const first = point.first ?? 0;
              const neu = point.neu ?? 0;
              const used = point.used ?? (point.neu == null ? first : 0);
              const totalH = (first / max) * plotH;
              const neuH = first ? (neu / first) * totalH : 0;
              const usedH = Math.max(0, totalH - neuH - (neu && used ? 2 : 0));
              return (
                <div key={point.period} className={`flex items-end ${next ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(point.period)}
                    onPointerEnter={() => setHover(point.period)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(point.period)}
                    onBlur={() => setHover(null)}
                    aria-pressed={isSelected}
                    aria-label={labels.select(formatPeriod(point.period), point.first == null ? "—" : formatValue(point.first))}
                    className="group relative flex w-[clamp(44px,7vw,76px)] shrink-0 cursor-pointer flex-col items-center justify-end"
                    style={{ height: plotH + 56 }}
                  >
                    <span
                      className={`tabular mb-2 text-[13px] font-semibold transition-colors ${isSelected ? "text-ink" : "text-muted group-hover:text-ink"}`}
                    >
                      {point.first == null ? "—" : formatValue(point.first)}
                    </span>
                    <span
                      className="flex w-full max-w-[44px] flex-col justify-end gap-[2px] transition-opacity duration-300"
                      style={{ opacity: isSelected || isHover ? 1 : 0.42 }}
                    >
                      <span className={`block w-full rounded-t-[4px] ${USED} transition-[height] duration-700 ease-[var(--ease-out)]`} style={{ height: usedH }} />
                      <span
                        className={`block w-full ${NEW} transition-[height] duration-700 ease-[var(--ease-out)] ${used ? "" : "rounded-t-[4px]"}`}
                        style={{ height: neuH }}
                      />
                    </span>
                    <span className="flex h-[56px] flex-col items-center justify-start pt-2.5">
                      <span
                        className={`block h-[3px] w-6 rounded-full transition-colors ${isSelected ? "bg-lime-deep" : "bg-transparent"}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`tabular mt-1.5 whitespace-nowrap text-[12px] ${isSelected ? "font-semibold text-ink" : "text-muted"}`}
                      >
                        {formatPeriod(point.period)}
                      </span>
                    </span>
                  </button>
                  {next && (
                    <div className="relative mb-[56px] flex h-6 flex-1 items-end" title={labels.gap(fmtGap(point.period, next.period, locale, false))}>
                      <span className="hatch absolute inset-x-1 bottom-0 h-3 rounded-t-[2px] text-graphite/25" aria-hidden="true" />
                      <span className="tabular relative mx-auto -mb-[30px] text-[10.5px] text-muted" aria-hidden="true">
                        {fmtGap(point.period, next.period, locale)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="lg:border-l lg:border-rule lg:pl-6" aria-live="polite">
        {active && renderReadout(active)}
      </div>
    </div>
  );
}
