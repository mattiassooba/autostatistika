// Minimal technical glyphs for vehicle categories and datasets. Drawn on a
// 40×20 grid with hairline strokes so they read as engineering marks, not icons.

type GlyphProps = { className?: string; title?: string };

const WHEEL = (cx: number, cy: number, r = 2.6) => <circle cx={cx} cy={cy} r={r} />;

const CATEGORY_PATHS: Record<string, React.ReactNode> = {
  passenger_car: (
    <>
      <path d="M8.4 14H4a1 1 0 0 1-1-1v-2.6c0-.9.6-1.7 1.5-1.9L8 7.6l3.3-3.7c.5-.6 1.3-.9 2.1-.9h9.3c.7 0 1.3.2 1.8.6L29 7.2l6.4 1.3c.9.2 1.6 1 1.6 2V13a1 1 0 0 1-1 1h-3.4M13.6 14h13.8" />
      <path d="M11.6 7.4h15.6" />
      {WHEEL(11, 14)}
      {WHEEL(30, 14)}
    </>
  ),
  truck: (
    <>
      <path d="M8.4 14H4a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1h19V14h-9.4M23 6.8h6.2l4.4 4.3c.3.3.4.6.4 1V13a1 1 0 0 1-1 1h-1.4M26.4 14H23" />
      {WHEEL(11, 14)}
      {WHEEL(29, 14)}
    </>
  ),
  bus: (
    <>
      <path d="M7.4 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h30.4c.8 0 1.5.5 1.8 1.3L37 7v7a1 1 0 0 1-1 1h-3.4M12.6 15h14.8M3 9h34M9 3v6M15 3v6M21 3v6M27 3v6" />
      {WHEEL(10, 15)}
      {WHEEL(30, 15)}
    </>
  ),
  trailer: (
    <>
      <path d="M18.4 14H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h24a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-5.4M30 11h7" />
      {WHEEL(21, 14)}
    </>
  ),
  motorcycle: (
    <>
      <path d="M8 14l6.5-6.5h8.5L28 14M14.5 7.5 12.5 5H9.5M23 7.5l3.6-3h3M17.5 7.5 21 14" />
      {WHEEL(8, 14, 4)}
      {WHEEL(32, 14, 4)}
    </>
  ),
  moped: (
    <>
      <path d="M9 14h8l4-6h6l4 6M27 8l-1-4h-3M12 9.5h6" />
      {WHEEL(9, 14, 3)}
      {WHEEL(31, 14, 3)}
    </>
  ),
  offroad: (
    <>
      <path d="M5 10.5h30M12 10.5l3-4.5h10l3 4.5M18 6V3.5h4" />
      {WHEEL(9, 14.5, 3.5)}
      {WHEEL(31, 14.5, 3.5)}
    </>
  ),
  tractor: (
    <>
      <path d="M8 8.5V3h9l1.2 5.5M18.2 8.5H30l3.4 4.2v.8M16 13.6h13.4" />
      {WHEEL(11, 13, 5)}
      {WHEEL(32, 15.4, 2.4)}
    </>
  ),
  self_propelled: (
    <>
      <path d="M5 17.5a2 2 0 0 1 0-4h17a2 2 0 0 1 0 4zM8 13.5V7h8v6.5M16 10h4l8-6.5 6 5.5-2.6 2" />
    </>
  ),
  l_other: (
    <>
      <path d="M9.4 14H6a1 1 0 0 1-1-1v-3c0-.8.5-1.4 1.2-1.6L10 7.2l3-3c.4-.4.9-.6 1.4-.6h8.2c.6 0 1.1.3 1.5.7l3.4 3.7 4.2 1c.8.2 1.3.9 1.3 1.7V13a1 1 0 0 1-1 1h-2.4M14.6 14h10.8" />
      {WHEEL(12, 14)}
      {WHEEL(28, 14)}
    </>
  ),
  watercraft: <path d="M4 12h32l-4 4H8zM12 12V5l12 7" />,
};

export function CategoryGlyph({ code, className = "h-4 w-8", title }: GlyphProps & { code: string }) {
  return (
    <svg
      viewBox="0 0 40 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {CATEGORY_PATHS[code] ?? CATEGORY_PATHS.passenger_car}
    </svg>
  );
}

/* Dataset marks: flow (arrow into a register), stock (stacked bays), events (gauge). */
export function DatasetGlyph({ tab, className = "h-4 w-4" }: GlyphProps & { tab: string }) {
  const common = {
    viewBox: "0 0 20 20",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tab === "soidukipark") {
    return (
      <svg {...common}>
        <path d="M3 5.5h14M3 10h14M3 14.5h14M7 3v14M13 3v14" opacity=".55" />
        <rect x="8.6" y="6.9" width="2.8" height="1.8" rx=".5" fill="currentColor" stroke="none" />
        <rect x="14.2" y="11.4" width="2.8" height="1.8" rx=".5" fill="currentColor" stroke="none" />
        <rect x="3" y="11.4" width="2.8" height="1.8" rx=".5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (tab === "ulevaatused") {
    return (
      <svg {...common}>
        <path d="M3.5 14a6.5 6.5 0 1 1 13 0" />
        <path d="M10 14l3.2-4.2" />
        <circle cx="10" cy="14" r="1.1" fill="currentColor" stroke="none" />
        <path d="M5.2 9.6l1 .7M10 6.6v1.2M14.8 9.6l-1 .7" opacity=".6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="6" width="11" height="8" rx="1.5" />
      <path d="M5 10h6" opacity=".6" />
      <path d="M14.5 10h3.5M16 8l2 2-2 2" />
    </svg>
  );
}

/* Brand mark: a small plate-like monogram, never a manufacturer logo. */
export function BrandMonogram({ name, className = "" }: { name: string; className?: string }) {
  const letters = name
    .replace(/[^A-Za-zÀ-ž0-9 -]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-semibold tracking-wide ${className}`}
      style={{ fontVariationSettings: '"wdth" 112' }}
    >
      {letters}
    </span>
  );
}
