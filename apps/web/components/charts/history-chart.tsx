"use client";

import { useMemo, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./chart";
import { axisLabel, base, splitLine, tipHtml, tooltipBase } from "./theme";
import { useWidth, yearStep } from "./year-axis";
import { color } from "@/lib/design/tokens";
import type { RegistrationPoint } from "@/lib/data/views";

const NEW = color.ink;
const USED = "#9FB0A8";

const toIndex = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return y * 12 + (m - 1);
};
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

/**
 * Monthly first registrations as stacked columns (new + used) on a continuous
 * month axis. Months without an imported leaflet stay empty and are shaded,
 * never interpolated. Clicking a month selects it for the whole explorer.
 */
export function HistoryChart({
  points,
  selected,
  onSelect,
  formatValue,
  formatPeriod,
  labels,
  readout,
}: {
  points: RegistrationPoint[];
  selected: string;
  onSelect: (period: string) => void;
  formatValue: (value: number) => string;
  formatPeriod: (period: string) => string;
  labels: { neu: string; used: string; total: string; newShare: string; chart: string; missing: string };
  readout: ReactNode;
}) {
  const months = useMemo(() => {
    if (!points.length) return [] as string[];
    const start = toIndex(points[0].period);
    const end = toIndex(points[points.length - 1].period);
    return Array.from({ length: end - start + 1 }, (_, i) => fromIndex(start + i));
  }, [points]);
  const byPeriod = useMemo(() => new Map(points.map((p) => [p.period, p])), [points]);
  // Every second year on wide screens for long series (as before), wider steps when narrow.
  const [axisRef, axisWidth] = useWidth<HTMLDivElement>();
  const years = months.length ? Number(months[months.length - 1].slice(0, 4)) - Number(months[0].slice(0, 4)) + 1 : 0;
  const step = yearStep(years, axisWidth - 56, months.length > 120 ? 2 : 1);

  const option = useMemo<EChartsOption>(() => {
    const selectedIndex = months.indexOf(selected);
    const missing: Array<[{ xAxis: string }, { xAxis: string }]> = [];
    let runStart: string | null = null;
    months.forEach((month, i) => {
      const has = byPeriod.get(month)?.first != null;
      if (!has && runStart == null) runStart = month;
      if ((has || i === months.length - 1) && runStart != null) {
        missing.push([{ xAxis: runStart }, { xAxis: has ? months[i - 1] : month }]);
        runStart = null;
      }
    });
    const dim = (i: number) => (selectedIndex < 0 || i === selectedIndex ? 1 : 0.62);
    return {
      ...base(),
      grid: { left: 4, right: 12, top: 16, bottom: 24, containLabel: true },
      xAxis: {
        type: "category",
        data: months,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: color.ink } },
        axisLabel: {
          ...axisLabel(),
          interval: (_: number, value: string) => value.endsWith("-01") && Number(value.slice(0, 4)) % step === 0,
          formatter: (value: string) => value.slice(0, 4),
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: { ...axisLabel(), formatter: (v: number) => formatValue(v) },
        splitLine: splitLine(),
      },
      tooltip: {
        ...tooltipBase(),
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(213,240,139,0.35)" } },
        formatter: (params: unknown) => {
          const index = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0;
          const point = byPeriod.get(months[index]);
          if (!point || point.first == null) return tipHtml({ title: formatPeriod(months[index]), rows: [{ label: labels.missing, value: "" }] });
          return tipHtml({
            title: formatPeriod(point.period),
            rows: [
              { label: labels.total, value: formatValue(point.first) },
              { color: NEW, label: labels.neu, value: point.neu == null ? "—" : formatValue(point.neu), strong: false },
              { color: USED, label: labels.used, value: point.used == null ? "—" : formatValue(point.used), strong: false },
              { label: labels.newShare, value: point.newShare == null ? "—" : `${point.newShare.toFixed(1)} %`, strong: false },
            ],
          });
        },
      },
      series: [
        {
          name: labels.neu,
          type: "bar",
          stack: "first",
          barCategoryGap: "18%",
          cursor: "pointer",
          data: months.map((month, i) => {
            const p = byPeriod.get(month);
            return p?.neu == null ? "-" : { value: p.neu, itemStyle: { color: NEW, opacity: dim(i) } };
          }),
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(49,59,59,0.06)" },
            data: missing,
          },
          markLine: selectedIndex >= 0
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: "#B7D65F", width: 2, type: "solid" },
                label: { show: false },
                data: [{ xAxis: selected }],
              }
            : undefined,
        },
        {
          name: labels.used,
          type: "bar",
          stack: "first",
          cursor: "pointer",
          data: months.map((month, i) => {
            const p = byPeriod.get(month);
            const used = p?.used ?? (p && p.neu == null ? p.first : null);
            return used == null ? "-" : { value: used, itemStyle: { color: USED, opacity: dim(i), borderRadius: [2, 2, 0, 0] } };
          }),
        },
      ],
    } as EChartsOption;
  }, [months, byPeriod, selected, formatValue, formatPeriod, labels, step]);

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const month = months[(params as { dataIndex: number }).dataIndex];
        if (month && byPeriod.get(month)?.first != null) onSelect(month);
      },
    }),
    [months, byPeriod, onSelect],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-5 text-[12.5px] text-muted">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-ink" aria-hidden="true" />
            {labels.neu}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-[#9FB0A8]" aria-hidden="true" />
            {labels.used}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-[2px] bg-lime-deep" aria-hidden="true" />
            {formatPeriod(selected)}
          </span>
        </div>
        <div ref={axisRef}>
          <Chart option={option} height={320} label={labels.chart} onEvents={onEvents} />
        </div>
      </div>
      <div className="lg:border-l lg:border-rule lg:pl-6" aria-live="polite">
        {readout}
      </div>
    </div>
  );
}
