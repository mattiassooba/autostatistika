"use client";

import { useEffect, useRef, useState } from "react";

// Year labels on monthly time axes. A label ("2026" at 11.5 px) is about 28 px, 36 px with its gap;
// the step grows (1, 2, 5, 10 years) until the labels fit the chart's width, so
// a phone shows 2010, 2015, 2020, 2025 instead of every year run together.

const LABEL_PX = 36;
const STEPS = [1, 2, 5, 10];

/** The smallest year step (at least `min`) whose labels fit in `width` pixels. */
export function yearStep(years: number, width: number, min = 1): number {
  for (const step of STEPS) {
    if (step < min) continue;
    if (Math.ceil(years / step) * LABEL_PX <= width) return step;
  }
  return STEPS[STEPS.length - 1];
}

/** Width of an element, kept up to date. Starts from the window width so the first frame is close. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1200 : window.innerWidth));
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
