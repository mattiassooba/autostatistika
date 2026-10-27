"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  DatasetComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

// Tree-shaken ECharts: only the series and components the product uses.
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  DatasetComponent,
  SVGRenderer,
]);

export type ChartEvents = Record<string, (params: unknown) => void>;

export default function ChartImpl({
  option,
  height,
  onEvents,
}: {
  option: EChartsOption;
  height: number;
  onEvents?: ChartEvents;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge={false}
      lazyUpdate
      opts={{ renderer: "svg" }}
      style={{ height, width: "100%" }}
      onEvents={onEvents}
    />
  );
}
