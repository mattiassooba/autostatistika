"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

type Props = {
  value: number | null;
  format: (value: number) => string;
  /** Count up from zero the first time the number scrolls into view. */
  reveal?: boolean;
  duration?: number;
  className?: string;
  fallback?: string;
};

/**
 * Renders the final value on the server (no layout shift, no hydration
 * mismatch) and animates only when the value genuinely changes, or once on
 * first reveal. Never restarts on unrelated re-renders. Text is driven by a
 * motion value, so frames never go through React reconciliation.
 */
export function AnimatedNumber({ value, format, reveal = false, duration = 0.9, className, fallback = "—" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const mv = useMotionValue(value ?? 0);
  const text = useTransform(mv, (latest) => formatRef.current(latest));
  const revealed = useRef(!reveal);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (value == null) return;
    let from = mv.get();
    if (!revealed.current) {
      if (!inView) return;
      revealed.current = true;
      from = 0;
    }
    if (reduce || from === value) {
      mv.jump(value);
      return;
    }
    mv.jump(from);
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, inView, reduce, duration, mv]);

  if (value == null) {
    return (
      <span ref={ref} className={className}>
        {fallback}
      </span>
    );
  }
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
