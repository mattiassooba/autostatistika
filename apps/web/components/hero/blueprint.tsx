/**
 * Technical side elevation of a generic passenger car, drawn as hairlines with
 * centre marks and a dimension line. Pure decoration of the hero; aria-hidden.
 */
export function Blueprint({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 240" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {/* body */}
        <path
          className="draw-line"
          style={{ ["--len" as string]: 1700 }}
          d="M92 172H70q-12 0-12-12v-22q0-12 12-16l40-10c40-8 65-36 105-50l115-8q30-2 55 10l70 40 85 12q40 6 48 24l2 20q0 12-12 12h-60a48 48 0 0 0-96 0H218a48 48 0 0 0-96 0H92z"
        />
        {/* greenhouse and pillars */}
        <path className="draw-line" style={{ ["--len" as string]: 520 }} d="M205 104c20-20 40-32 65-36l60-4q22-1 40 8l50 32z" />
        <path d="M318 66l-6 38M110 120l435 2M300 106l-4 62M420 106l-6 54" opacity=".7" />
        {/* wheels */}
        <circle cx="170" cy="172" r="36" />
        <circle cx="170" cy="172" r="14" opacity=".6" />
        <circle cx="470" cy="172" r="36" />
        <circle cx="470" cy="172" r="14" opacity=".6" />
        {/* centre marks */}
        <path d="M144 172h52M170 146v52M444 172h52M470 146v52" strokeDasharray="6 3 1 3" opacity=".7" />
        {/* ground */}
        <path d="M16 208h608" />
        <path d="M16 214h608" opacity=".35" strokeDasharray="1 7" />
        {/* dimension: wheelbase */}
        <path d="M170 136V30M470 136V30" strokeDasharray="2 4" opacity=".55" />
        <path d="M170 36h300" />
        <path d="M170 36l9-4v8zM470 36l-9-4v8z" fill="currentColor" stroke="none" />
        {/* dimension: overall length */}
        <path d="M58 150v74M590 150v74" strokeDasharray="2 4" opacity=".4" />
        <path d="M58 228h532" opacity=".6" />
        <path d="M58 228l8-3.5v7zM590 228l-8-3.5v7z" fill="currentColor" stroke="none" opacity=".6" />
      </g>
    </svg>
  );
}
