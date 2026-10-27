import { color } from "@/lib/design/tokens";
import { DOMAIN_PATH, NAME_PATH, STRIP_PATH } from "./plate-mark-paths";

// The site mark: AUTOSTATISTIKA.EE on a registration-plate shape (the approved
// "Modern plate"). A blue country strip with EE, a lime seam, a hairline rim;
// the name in Archivo width 74 / weight 720, .EE lighter at 460. Lettering is
// outlined (plate-mark-paths.ts, from scripts/build_plate_mark.py), so the
// mark needs no web font. No EU stars and no "EST": it is not an official plate.
//
// One builder for every surface: the PlateMark component (header, footer) and
// the Open Graph images. Units: the plate is 100 tall and WIDTH wide.

export const WIDTH = 669;
export const RATIO = WIDTH / 100;

export type Tone = "light" | "dark";
/** "sm" is the master for marks under 40 px tall: heavier rim and seam, larger strip letters. */
export type Size = "sm" | "lg";

const STRIP_END = 40.5;
const RADIUS = 16;

export function plateMarkInner({ tone = "light", size = "lg" }: { tone?: Tone; size?: Size } = {}): string {
  const dark = tone === "dark";
  const rim = size === "sm" ? 3.5 : 2.5;
  const seam = size === "sm" ? 4.5 : 3;
  const x0 = rim / 2;
  const y1 = 100 - rim / 2;
  const plate = `M${x0 + RADIUS} ${x0}H${WIDTH - x0 - RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${WIDTH - x0} ${x0 + RADIUS}V${y1 - RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${WIDTH - x0 - RADIUS} ${y1}H${x0 + RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${x0} ${y1 - RADIUS}V${x0 + RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${x0 + RADIUS} ${x0}Z`;
  const strip = `M${x0 + RADIUS} ${x0}H${STRIP_END}V${y1}H${x0 + RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${x0} ${y1 - RADIUS}V${x0 + RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${x0 + RADIUS} ${x0}Z`;
  const rimColor = dark ? `rgba(247,247,243,${size === "sm" ? 0.34 : 0.26})` : color.ink;

  return [
    // Hidden by attribute, not CSS, so standalone renders (OG images) never paint it.
    `<path class="pm-halo" opacity="0" d="${plate}" fill="none" stroke="${dark ? color.paper : color.ink}" stroke-width="${rim + 9}"/>`,
    `<path class="pm-fade" d="${plate}" fill="${dark ? color.ink2 : color.paper}"/>`,
    `<path class="pm-strip" d="${strip}" fill="${color.plateBlue}"/>`,
    `<rect class="pm-seam" x="${STRIP_END}" y="${x0}" width="${seam}" height="${y1 - x0}" fill="${color.lime}"/>`,
    `<path class="pm-strip-text" d="${STRIP_PATH[size]}" fill="#FFFFFF"/>`,
    `<g class="pm-word"><path d="${NAME_PATH}" fill="${dark ? color.paper : color.ink}"/><path d="${DOMAIN_PATH}" fill="${dark ? color.mist : color.graphite}"/></g>`,
    `<path class="pm-fade" d="${plate}" fill="none" stroke="${rimColor}" stroke-width="${rim}"/>`,
  ].join("");
}

/** Standalone SVG document, e.g. for an <img> data URI in the Open Graph images. */
export function plateMarkSvg(options: { tone?: Tone; size?: Size } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 100">${plateMarkInner(options)}</svg>`;
}
