"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./chart";
import { axisLabel, base, splitLine, tipHtml, tooltipBase } from "./theme";
import { chartMotion, color } from "@/lib/design/tokens";

export type RankItem = {
  id: string;
  name: string;
  value: number | null; // null = not listed for this period (never drawn as zero)
  color?: string; // entity colour when the item is part of a comparison
  tip?: Array<{ label: string; value: string }>;
};

/**
 * Horizontal ranking with animated re-ordering. The y-axis holds every entity
 * that appears in any period; ECharts' realtime sort moves bars to their new
 * rank when values change, and the axis window shows only listed entities.
 */
export function RankChart({
  items,
  visible,
  label,
  formatValue,
  onSelect,
  selected = [],
  tipTitle,
  tipFoot,
}: {
  items: RankItem[];
  visible: number;
  label: string;
  formatValue: (value: number) => string;
  onSelect?: (id: string) => void;
  selected?: string[];
  tipTitle?: (item: RankItem) => string;
  tipFoot?: string;
}) {
  const rows = Math.max(1, visible);
  const height = rows * 34 + 28;
  const option = useMemo<EChartsOption>(() => {
    const byName = new Map(items.map((item) => [item.name, item]));
    return {
      ...base(),
      grid: { left: 4, right: 72, top: 4, bottom: 20, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { ...axisLabel(), formatter: (v: number) => formatValue(v) },
        splitLine: splitLine(),
        splitNumber: 4,
      },
      yAxis: {
        type: "category",
        inverse: true,
        max: rows - 1,
        data: items.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: color.ink,
          fontSize: 13.5,
          margin: 14,
          width: 130,
          overflow: "truncate",
        },
        animationDuration: 300,
        animationDurationUpdate: chartMotion.rank,
      },
      tooltip: {
        ...tooltipBase(),
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { name: string };
          const item = byName.get(p.name);
          if (!item || item.value == null) return "";
          return tipHtml({
            title: tipTitle ? tipTitle(item) : item.name,
            rows: [{ label: label, value: formatValue(item.value) }, ...(item.tip ?? []).map((row) => ({ ...row, strong: false }))],
            foot: tipFoot,
          });
        },
      },
      series: [
        {
          type: "bar",
          realtimeSort: true,
          barMaxWidth: 20,
          barMinHeight: 2,
          cursor: onSelect ? "pointer" : "default",
          data: items.map((item) => ({
            value: item.value ?? 0,
            itemStyle: {
              color: item.color ?? (selected.length ? "#9FB0A8" : color.graphite),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: {
            show: true,
            position: "right",
            valueAnimation: true,
            color: color.ink,
            fontSize: 12.5,
            fontWeight: 600,
            formatter: (p: unknown) => formatValue((p as { value: number }).value),
          },
          emphasis: { itemStyle: { color: color.ink }, focus: "none" },
          animationDuration: chartMotion.enter,
          animationDurationUpdate: chartMotion.rank,
          animationEasingUpdate: "cubicInOut",
        },
      ],
    } as EChartsOption;
  }, [items, rows, formatValue, selected, label, tipTitle, tipFoot, onSelect]);

  const onEvents = useMemo(
    () =>
      onSelect
        ? {
            click: (params: unknown) => {
              const p = params as { name?: string };
              const item = items.find((row) => row.name === p.name);
              if (item && item.value != null) onSelect(item.id);
            },
          }
        : undefined,
    [items, onSelect],
  );

  return <Chart option={option} height={height} label={label} onEvents={onEvents} />;
}
