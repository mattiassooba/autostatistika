"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./chart";
import { axisLabel, base, splitLine, tipHtml, tooltipBase } from "./theme";
import { color } from "@/lib/design/tokens";
import type { FuelMixRow } from "@/lib/data/views";

const NEW = color.ink;
const USED = "#9FB0A8";

/** Fuel composition: new and used first registrations stacked per fuel. */
export function FuelChart({
  rows,
  fuelLabel,
  labels,
  formatValue,
  formatShare,
  highlight,
  onSelect,
}: {
  rows: FuelMixRow[];
  fuelLabel: (code: string) => string;
  labels: { neu: string; used: string; total: string; share: string; chart: string };
  formatValue: (value: number) => string;
  formatShare: (value: number | null) => string;
  highlight?: string;
  onSelect?: (code: string) => void;
}) {
  const height = rows.length * 38 + 30;
  const option = useMemo<EChartsOption>(() => {
    const names = rows.map((row) => fuelLabel(row.code));
    const opacity = (code: string) => (highlight && highlight !== code ? 0.3 : 1);
    return {
      ...base(),
      grid: { left: 4, right: 92, top: 4, bottom: 20, containLabel: true },
      xAxis: {
        type: "value",
        splitNumber: 3,
        axisLabel: { ...axisLabel(), formatter: (v: number) => formatValue(v) },
        splitLine: splitLine(),
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: names,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: color.ink, fontSize: 13.5, margin: 14 },
      },
      tooltip: {
        ...tooltipBase(),
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(24,29,29,0.04)" } },
        formatter: (params: unknown) => {
          const index = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0;
          const row = rows[index];
          if (!row) return "";
          return tipHtml({
            title: fuelLabel(row.code),
            rows: [
              { label: labels.total, value: formatValue(row.first), sub: formatShare(row.share) },
              { color: NEW, label: labels.neu, value: row.neu == null ? "—" : formatValue(row.neu), strong: false },
              { color: USED, label: labels.used, value: row.used == null ? "—" : formatValue(row.used), strong: false },
            ],
          });
        },
      },
      series: [
        {
          name: labels.neu,
          type: "bar",
          stack: "fuel",
          barMaxWidth: 20,
          cursor: onSelect ? "pointer" : "default",
          data: rows.map((row) => ({
            value: row.neu ?? 0,
            itemStyle: { color: NEW, opacity: opacity(row.code), borderColor: color.paper, borderWidth: 1 },
          })),
        },
        {
          name: labels.used,
          type: "bar",
          stack: "fuel",
          barMaxWidth: 20,
          cursor: onSelect ? "pointer" : "default",
          data: rows.map((row) => ({
            value: row.used ?? (row.neu == null ? row.first : 0),
            itemStyle: {
              color: USED,
              opacity: opacity(row.code),
              borderColor: color.paper,
              borderWidth: 1,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: {
            show: true,
            position: "right",
            color: color.ink,
            fontSize: 12.5,
            formatter: (p: unknown) => {
              const row = rows[(p as { dataIndex: number }).dataIndex];
              return row ? `{v|${formatValue(row.first)}}  {s|${formatShare(row.share)}}` : "";
            },
            rich: {
              v: { fontWeight: 600, color: color.ink, fontSize: 12.5 },
              s: { color: color.muted, fontSize: 12 },
            },
          },
        },
      ],
    } as EChartsOption;
  }, [rows, fuelLabel, labels, formatValue, formatShare, highlight, onSelect]);

  const onEvents = useMemo(
    () =>
      onSelect
        ? {
            click: (params: unknown) => {
              const row = rows[(params as { dataIndex: number }).dataIndex];
              if (row) onSelect(row.code);
            },
          }
        : undefined,
    [rows, onSelect],
  );

  return <Chart option={option} height={height} label={labels.chart} onEvents={onEvents} />;
}
