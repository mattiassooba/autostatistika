import { BRAND_LOGOS } from "@/lib/brand-logos";

/** "Mercedes-Benz" → "MB", "Jaguar" → "J". */
function monogram(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.[0] ?? "?").toUpperCase();
}

/**
 * A brand's official monochrome mark in a round frame, painted with the
 * current text colour through a CSS mask (sharp at any density, no JS).
 * Brands without a mark in public/logos get a typographic monogram in the
 * same frame. Decorative: the brand name is always written next to it.
 */
export function BrandLogo({
  slug,
  name,
  tone = "dark",
  className = "",
}: {
  slug: string;
  name: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const frame = tone === "dark" ? "bg-white/[0.05] ring-white/12" : "bg-paper-2 ring-rule";
  const scale = BRAND_LOGOS.get(slug);
  if (scale) {
    const mask = `url(/logos/${slug}.svg)`;
    return (
      <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ${frame} ${className}`}>
        <span
          className="block bg-current"
          style={{
            width: `${54 * scale}%`,
            height: `${54 * scale}%`,
            maskImage: mask,
            WebkitMaskImage: mask,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ${frame} ${className}`}
      style={{ fontVariationSettings: '"wdth" 112' }}
    >
      {/* Size comes from the frame's font-size (e.g. text-[11px] in className). */}
      <span className="font-bold leading-none tracking-[0.02em]">{monogram(name)}</span>
    </span>
  );
}
