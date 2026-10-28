"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./chart";
import { axisLabel, base, splitLine, tipHtml, tooltipBase } from "./theme";
import { useWidth, yearStep } from "./year-axis";
import { color } from "@/lib/design/tokens";

export type CompareSeries = {
  id: string;
  name: string;
  color: string;
  values: Array<number | null>;
};

/**
 * Slope chart for compared brands across imported months. Points are the data;
 * connectors only join neighbouring imported months, and a month where the
 * brand is not in the source top list stays empty (never zero).
 */
export function CompareChart({
  periods,
  periodLabels,
  series,
  formatValue,
  formatAxis,
  label,
  missingLabel,
  focus,
  onFocus,
}: {
  periods: string[];
  periodLabels: string[];
  series: CompareSeries[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  label: string;
  missingLabel: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
}) {
  const dense = periodLabels.length > 12;
  // Year labels on the dense axis: every year when they fit, otherwise every 2, 5 or 10.
  // The plot is the width minus the y-axis labels and the 108 px kept for brand names.
  const [axisRef, axisWidth] = useWidth<HTMLDivElement>();
  const years = periods.length ? Number(periods[periods.length - 1].slice(0, 4)) - Number(periods[0].slice(0, 4)) + 1 : 0;
  const step = yearStep(years, axisWidth - 56 - 108);
  const option = useMemo<EChartsOption>(() => {
    return {
      ...base(),
      grid: { left: 8, right: 108, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: periodLabels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: color.ruleStrong } },
        axisLabel: dense
          ? {
              ...axisLabel(),
              interval: (_: number, value: string) => {
                const period = periods[periodLabels.indexOf(value)];
                return Boolean(period?.endsWith("-01")) && Number(period.slice(0, 4)) % step === 0;
              },
              formatter: (value: string) => periods[periodLabels.indexOf(value)]?.slice(0, 4) ?? value,
            }
          : { ...axisLabel(), color: color.graphite, fontSize: 12, margin: 14, lineHeight: 16 },
        axisPointer: { show: true, type: "line", lineStyle: { color: color.ruleStrong, width: 1 }, label: { show: false } },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 4,
        axisLabel: { ...axisLabel(), formatter: (v: number) => formatAxis(v) },
        splitLine: splitLine(),
      },
      tooltip: {
        ...tooltipBase(),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: color.ruleStrong } },
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number; seriesId: string }>;
          if (!list.length) return "";
          const index = list[0].dataIndex;
          return tipHtml({
            title: periodLabels[index].replace("\n", " "),
            rows: series.map((s) => ({
              color: s.color,
              line: true,
              label: s.name,
              value: s.values[index] == null ? missingLabel : formatValue(s.values[index] as number),
              strong: s.values[index] != null,
            })),
          });
        },
      },
      series: series.map((s) => {
        const dim = focus != null && focus !== s.id;
        const lastIndex = s.values.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
        return {
          id: s.id,
          name: s.name,
          type: "line",
          data: s.values.map((v) => (v == null ? "-" : v)),
          connectNulls: false,
          symbol: "circle",
          symbolSize: dense ? 7 : 10,
          showSymbol: !dense,
          showAllSymbol: !dense,
          lineStyle: { width: dense ? 1.75 : 2, color: s.color, opacity: dim ? 0.18 : 1, cap: "round", join: "round" },
          // Dense axis: the name sits on the brand's last listed month. Not `endLabel`: while the
          // line draws in, ECharts places that label at the first data point, which is NaN for
          // a brand not listed in the window's first month (Tesla, KIA over every month).
          markPoint:
            dense && lastIndex >= 0
              ? {
                  silent: true,
                  symbol: "circle",
                  symbolSize: 1,
                  itemStyle: { color: "transparent" },
                  label: { show: true, position: "right", distance: 8, color: color.ink, fontSize: 12.5, fontWeight: 600, opacity: dim ? 0.35 : 1, formatter: () => s.name },
                  data: [{ coord: [lastIndex, s.values[lastIndex] as number] }],
                }
              : undefined,
          itemStyle: { color: s.color, borderColor: color.paper, borderWidth: 2, opacity: dim ? 0.25 : 1 },
          emphasis: { focus: "series", scale: 1.3, lineStyle: { width: 2.5 } },
          blur: { lineStyle: { opacity: 0.15 }, itemStyle: { opacity: 0.2 } },
          z: dim ? 1 : 3,
          label: {
            show: !dense,
            position: "right",
            distance: 10,
            color: color.ink,
            fontSize: 12.5,
            fontWeight: 600,
            opacity: dim ? 0.35 : 1,
            formatter: (p: unknown) => ((p as { dataIndex: number }).dataIndex === lastIndex ? s.name : ""),
          },
          labelLayout: { hideOverlap: true },
        };
      }),
    } as EChartsOption;
  }, [periodLabels, periods, dense, series, formatValue, formatAxis, missingLabel, focus, step]);

  const onEvents = useMemo(
    () => ({
      mouseover: (params: unknown) => {
        const p = params as { seriesId?: string };
        if (p.seriesId) onFocus(p.seriesId);
      },
      mouseout: () => onFocus(null),
      globalout: () => onFocus(null),
    }),
    [onFocus],
  );

  return (
    <div ref={axisRef}>
      <Chart option={option} height={360} label={label} onEvents={onEvents} />
    </div>
  );
}
