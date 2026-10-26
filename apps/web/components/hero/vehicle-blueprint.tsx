// Technical side elevation of a generic modern passenger car: hairline body,
// detail lines, wheel construction and dimension guides (no invented figures).
// The intro is pure CSS (globals.css, .bp-*): the outline draws itself, details
// and guides fade in, one lime pass runs along the roof and bonnet, then the
// drawing stays still. Reduced motion shows the finished drawing.

const REAR = 196;
const FRONT = 540;
const AXLE = 176;
const GROUND = 212;

const BODY =
  "M96 182C86 182 80 176 80 166L80 146C80 132 88 122 102 116C118 110 134 106 146 102C168 86 196 70 226 62" +
  "C276 50 372 48 430 56C462 60 488 76 514 96C526 104 540 108 560 111C600 116 636 120 658 127" +
  "C672 131 680 140 682 152L684 166C684 176 678 182 668 182L585 182A45 45 0 0 0 495 182L241 182A45 45 0 0 0 151 182Z";

// Roof, windscreen and bonnet: the line the lime pass travels along.
const SWEEP =
  "M146 102C168 86 196 70 226 62C276 50 372 48 430 56C462 60 488 76 514 96C526 104 540 108 560 111C600 116 636 120 658 127";

function Wheel({ cx }: { cx: number }) {
  const spokes = [0, 72, 144, 216, 288].map((angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return `M${cx + Math.cos(rad) * 8} ${AXLE + Math.sin(rad) * 8}L${cx + Math.cos(rad) * 21} ${AXLE + Math.sin(rad) * 21}`;
  });
  return (
    <g>
      <circle className="bp-draw" pathLength={1} cx={cx} cy={AXLE} r="36" />
      <g className="bp-detail">
        <g opacity="0.6">
          <circle cx={cx} cy={AXLE} r="24" />
          <circle cx={cx} cy={AXLE} r="6" />
          <path d={spokes.join("")} />
        </g>
      </g>
    </g>
  );
}

function Arrow({ x, y, dir }: { x: number; y: number; dir: "left" | "right" | "up" | "down" }) {
  const d = {
    left: `M${x} ${y}l8 -3.5v7z`,
    right: `M${x} ${y}l-8 -3.5v7z`,
    up: `M${x} ${y}l-3.5 8h7z`,
    down: `M${x} ${y}l-3.5 -8h7z`,
  }[dir];
  return <path d={d} fill="currentColor" stroke="none" />;
}

export function VehicleBlueprint({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 14 720 230" className={className} fill="none" aria-hidden="true" focusable="false">
      {/* Dimension guides: overall length, wheelbase, height */}
      <g className="bp-guide">
      <g className="text-graphite" stroke="currentColor" strokeWidth="0.9" opacity="0.45">
        <path d={`M80 188V240M684 188V240`} strokeDasharray="2 4" />
        <path d="M80 234H684" />
        <Arrow x={80} y={234} dir="left" />
        <Arrow x={684} y={234} dir="right" />
        <path d={`M${REAR} 132V20M${FRONT} 132V20`} strokeDasharray="2 4" />
        <path d={`M${REAR} 26H${FRONT}`} />
        <Arrow x={REAR} y={26} dir="left" />
        <Arrow x={FRONT} y={26} dir="right" />
        <path d={`M380 49H714M690 ${GROUND}H714`} strokeDasharray="2 4" />
        <path d={`M707 49V${GROUND}`} />
        <Arrow x={707} y={49} dir="up" />
        <Arrow x={707} y={GROUND} dir="down" />
        {/* wheel centre marks */}
        <path
          d={`M${REAR - 48} ${AXLE}h96M${REAR} ${AXLE - 48}v96M${FRONT - 48} ${AXLE}h96M${FRONT} ${AXLE - 48}v96`}
          strokeDasharray="7 3 1 3"
        />
      </g>
      </g>

      {/* Ground */}
      <g className="bp-guide">
        <g className="text-graphite" stroke="currentColor" strokeWidth="1">
          <path d={`M24 ${GROUND}H700`} opacity="0.6" />
          <path d={`M24 ${GROUND + 6}H700`} opacity="0.3" strokeDasharray="1 7" />
        </g>
      </g>

      <g className="text-ink" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Body outline */}
        <path className="bp-draw" pathLength={1} d={BODY} strokeWidth="1.6" opacity="0.85" />
        <Wheel cx={REAR} />
        <Wheel cx={FRONT} />

        {/* Details */}
        <g className="bp-detail">
        <g strokeWidth="1.1" opacity="0.55">
          {/* side glass and pillars */}
          <path d="M160 104C184 90 208 78 234 72C280 62 368 60 424 66C448 69 468 80 490 98L492 102C400 104 260 106 166 110Z" />
          <path d="M330 62L326 104M244 70C238 84 234 96 232 108" />
          {/* shoulder and character lines */}
          <path d="M104 118C250 112 420 108 560 112M108 148C300 142 480 140 676 148" />
          {/* door cuts and sill */}
          <path d="M492 102C504 128 506 156 500 178M326 104L322 178M232 108C240 140 244 162 242 178M248 172H488" />
          {/* handles and mirror */}
          <path d="M290 124h18M452 120h18" strokeWidth="2" />
          <path d="M490 100l16 -5c6 -2 10 2 8 7l-4 6h-16z" />
          {/* lights */}
          <path d="M82 132C92 124 108 118 124 114L122 122C108 126 94 130 84 138Z" />
        </g>
        </g>

        {/* Headlamp: the one lime detail that stays */}
        <path
          className="bp-detail"
          d="M636 122C652 124 668 128 676 136L674 142C660 140 646 136 636 130Z"
          fill="var(--color-lime)"
          strokeWidth="1.1"
        />
      </g>

      {/* One lime pass along the roof and bonnet, then gone */}
      <path className="bp-sweep" pathLength={1} d={SWEEP} stroke="var(--color-lime-deep)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
