"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import type { ChartEvents } from "./chart-impl";

const ChartImpl = dynamic(() => import("./chart-impl"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
  return (
    <div className="absolute inset-0 flex items-end gap-[6%] px-[6%] pb-8" aria-hidden="true">
      {[0.55, 0.8, 0.4, 0.95, 0.6, 0.7].map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t-[4px] bg-paper-3/70"
          style={{ height: `${h * 70}%`, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Chart container. Reserves its height before the chart code loads (no layout
 * shift), exposes an accessible name, and keeps ECharts in merge mode so data
 * changes morph instead of re-mounting.
 */
export function Chart({
  option,
  height,
  label,
  onEvents,
  className = "",
}: {
  option: EChartsOption;
  height: number;
  label: string;
  onEvents?: ChartEvents;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={`relative w-full ${className}`} style={{ height }}>
      <ChartImpl option={option} height={height} onEvents={onEvents} />
    </div>
  );
}
