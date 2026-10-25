"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./chart";
import { axisLabel, base, splitLine, tipHtml, tooltipBase } from "./theme";
import { color } from "@/lib/design/tokens";
import type { InspectionOutcome } from "@/lib/data/views";

const toIndex = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return y * 12 + (m - 1);
};
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const REPEAT = "#D06A2C";

/**
 * Two small multiples on one continuous month axis: inspection events (bars)
 * and the share sent to repeat inspection (line). Two panels instead of a
 * dual-axis chart, so neither scale distorts the other. Missing months stay
 * empty. Clicking a month selects it.
 */
export function InspectionTrend({
  rows,
  selected,
  onSelect,
  formatValue,
  formatShare,
  formatPeriod,
  labels,
}: {
  rows: InspectionOutcome[];
  selected: string;
  onSelect: (period: string) => void;
  formatValue: (value: number) => string;
  formatShare: (value: number) => string;
  formatPeriod: (period: string) => string;
  labels: { total: string; repeatShare: string; chart: string; missing: string };
}) {
  const months = useMemo(() => {
    if (!rows.length) return [] as string[];
    const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
    const start = toIndex(sorted[0].period);
    const end = toIndex(sorted[sorted.length - 1].period);
    return Array.from({ length: end - start + 1 }, (_, i) => fromIndex(start + i));
  }, [rows]);
  const byPeriod = useMemo(() => new Map(rows.map((row) => [row.period, row])), [rows]);

  const option = useMemo<EChartsOption>(() => {
    const selectedIndex = months.indexOf(selected);
    const yearLabels = {
      ...axisLabel(),
      interval: (_: number, value: string) => value.endsWith("-01"),
      formatter: (value: string) => value.slice(0, 4),
    };
    const marker =
      selectedIndex >= 0
        ? { silent: true, symbol: "none", lineStyle: { color: "#B7D65F", width: 2, type: "solid" as const }, label: { show: false }, data: [{ xAxis: selected }] }
        : undefined;
    return {
      ...base(),
      grid: [
        { left: 4, right: 12, top: 12, height: "46%", containLabel: true },
        { left: 4, right: 12, top: "62%", bottom: 24, containLabel: true },
      ],
      xAxis: [
        { type: "category", gridIndex: 0, data: months, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { lineStyle: { color: color.ink } } },
        { type: "category", gridIndex: 1, data: months, axisLabel: yearLabels, axisTick: { show: false }, axisLine: { lineStyle: { color: color.ruleStrong } } },
      ],
      yAxis: [
        { type: "value", gridIndex: 0, splitNumber: 3, axisLabel: { ...axisLabel(), formatter: (v: number) => formatValue(v) }, splitLine: splitLine() },
        { type: "value", gridIndex: 1, splitNumber: 2, min: 0, axisLabel: { ...axisLabel(), formatter: (v: number) => formatShare(v) }, splitLine: splitLine() },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: {
        ...tooltipBase(),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: color.ruleStrong } },
        formatter: (params: unknown) => {
          const index = (params as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0;
          const row = byPeriod.get(months[index]);
          if (!row || row.total == null) return tipHtml({ title: formatPeriod(months[index]), rows: [{ label: labels.missing, value: "" }] });
          return tipHtml({
            title: formatPeriod(row.period),
            rows: [
              { color: color.graphite, label: labels.total, value: formatValue(row.total) },
              { color: REPEAT, line: true, label: labels.repeatShare, value: row.repeatShare == null ? "—" : formatShare(row.repeatShare), strong: false },
            ],
          });
        },
      },
      series: [
        {
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          barCategoryGap: "20%",
          cursor: "pointer",
          data: months.map((month, i) => {
            const row = byPeriod.get(month);
            return row?.total == null
              ? "-"
              : { value: row.total, itemStyle: { color: i === selectedIndex ? color.ink : "#9FB0A8", borderRadius: [2, 2, 0, 0] } };
          }),
          markLine: marker,
        },
        {
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          connectNulls: false,
          showSymbol: false,
          symbolSize: 7,
          lineStyle: { width: 2, color: REPEAT },
          itemStyle: { color: REPEAT },
          data: months.map((month) => {
            const share = byPeriod.get(month)?.repeatShare;
            return share == null ? "-" : Number(share.toFixed(2));
          }),
          markLine: marker,
        },
      ],
    } as EChartsOption;
  }, [months, byPeriod, selected, formatValue, formatShare, formatPeriod, labels]);

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const month = months[(params as { dataIndex: number }).dataIndex];
        if (month && byPeriod.get(month)?.total != null) onSelect(month);
      },
    }),
    [months, byPeriod, onSelect],
  );

  return <Chart option={option} height={340} label={labels.chart} onEvents={onEvents} />;
}
