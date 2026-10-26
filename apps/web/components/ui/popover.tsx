"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion as tokens } from "@/lib/design/tokens";

type Props = {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    id: string;
    ref: (el: HTMLButtonElement | null) => void;
  }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end" | "center";
  side?: "bottom" | "top";
  tone?: "light" | "dark";
  width?: string;
  label: string;
  /** Fill the parent's width (form fields) instead of sizing to the trigger. */
  block?: boolean;
};

/**
 * Lightweight disclosure popover: click/Enter to open, Escape or outside click
 * to close, focus returns to the trigger. Content is a labelled dialog region.
 */
export function Popover({ trigger, children, align = "start", side = "bottom", tone = "light", width = "w-80", label, block = false }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const focusable = panelRef.current?.querySelector<HTMLElement>("input, button, a, [tabindex='0']");
      focusable?.focus({ preventScroll: true });
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const alignClass = align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";
  const sideClass = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const dark = tone === "dark";

  return (
    <div className={`relative ${block ? "flex w-full" : "inline-flex"}`}>
      {trigger({
        open,
        toggle: () => setOpen((value) => !value),
        id,
        ref: (el) => {
          triggerRef.current = el;
        },
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: side === "top" ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
            transition={{ duration: tokens.ui, ease: tokens.easeOut }}
            className={`absolute z-50 ${alignClass} ${sideClass} ${width} max-w-[calc(100vw-2rem)] origin-top rounded-[14px] p-1 shadow-[0_18px_50px_-12px_rgb(24_29_29/0.35)] ring-1 ${
              dark ? "on-dark bg-ink-2 text-paper ring-white/10" : "bg-paper text-ink ring-rule-strong/70"
            }`}
          >
            {typeof children === "function" ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small "i" disclosure for definitions next to figures and chart titles. */
export function InfoTip({ label, children, tone = "light", align = "start" }: { label: string; children: ReactNode; tone?: "light" | "dark"; align?: "start" | "end" | "center" }) {
  return (
    <Popover
      label={label}
      tone={tone}
      align={align}
      width="w-72"
      trigger={({ open, toggle, id, ref }) => (
        <button
          ref={ref}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={label}
          onClick={toggle}
          className={`press inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
            tone === "dark"
              ? open
                ? "bg-lime text-ink"
                : "text-paper/60 ring-1 ring-white/20 hover:text-paper hover:ring-white/40"
              : open
                ? "bg-ink text-paper"
                : "text-muted ring-1 ring-rule-strong hover:text-ink hover:ring-ink/50"
          }`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          i
        </button>
      )}
    >
      <div className={`px-3.5 py-3 text-[13px] leading-relaxed ${tone === "dark" ? "text-paper/85" : "text-graphite"}`}>{children}</div>
    </Popover>
  );
}
