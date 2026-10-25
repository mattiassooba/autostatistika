import type { ReactNode } from "react";

/**
 * Registration-plate motif: a lime country strip and a plate field. Used for
 * the site mark, the hero eyebrow and period badges. The strip is identity,
 * the field carries the information.
 */
export function Plate({
  strip = "EE",
  children,
  tone = "light",
  size = "md",
  className = "",
}: {
  strip?: ReactNode;
  children: ReactNode;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-[6px] ring-1 ${
        dark ? "bg-ink-2 text-paper ring-white/15" : "bg-paper text-ink ring-ink/80"
      } ${size === "sm" ? "h-6 text-[11px]" : "h-8 text-[13px]"} ${className}`}
    >
      <span
        className={`flex items-center bg-lime font-semibold text-ink ${size === "sm" ? "px-1.5 text-[9px]" : "px-2 text-[10px]"}`}
        style={{ fontVariationSettings: '"wdth" 112' }}
      >
        {strip}
      </span>
      <span
        className={`flex items-center font-medium tabular ${size === "sm" ? "px-2" : "px-3"}`}
        style={{ fontVariationSettings: '"wdth" 105', letterSpacing: "0.02em" }}
      >
        {children}
      </span>
    </span>
  );
}
