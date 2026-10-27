import { WIDTH, plateMarkInner, type Size, type Tone } from "@/lib/brand/plate-mark";

/**
 * The site mark as inline SVG. Set the height with className; the width
 * follows the plate's ratio. Decorative unless `label` is given. Hover and
 * focus effects apply inside an ancestor with the `pm-hover` class; `intro`
 * plays the entrance once on mount (globals.css, .pm-*).
 */
export function PlateMark({
  tone = "light",
  size = "lg",
  intro = false,
  label,
  className = "",
}: {
  tone?: Tone;
  size?: Size;
  intro?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} 100`}
      className={`pm block w-auto ${intro ? "pm-intro" : ""} ${className}`}
      style={{ aspectRatio: `${WIDTH} / 100` }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
      dangerouslySetInnerHTML={{ __html: plateMarkInner({ tone, size }) }}
    />
  );
}
