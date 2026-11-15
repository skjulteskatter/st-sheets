import { GLYPHS } from "./glyphs";

const NS = "http://www.w3.org/2000/svg";

/** Colours for what is drawn: the sheet's own ink (so it follows dark sheets too). */
export type Ink = string;

export function mk(tag: string, attrs: Record<string, string | number>) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
}

/** A glyph drawn left-aligned at x, centred vertically on yCenter, scaled by k (= staff spacing / 10). */
export function glyph(
    name: keyof typeof GLYPHS,
    x: number,
    yCenter: number,
    k: number,
    ink: Ink
) {
    const g = GLYPHS[name];
    return mk("path", {
        d: g.d,
        fill: ink,
        transform: `translate(${x} ${yCenter}) scale(${k}) translate(${-g.x} ${-(
            g.y +
            g.h / 2
        )})`,
    });
}

export function stroke(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    ink: Ink
) {
    return mk("path", {
        d: `M${x1} ${y1}L${x2} ${y2}`,
        stroke: ink,
        "stroke-width": width,
        fill: "none",
    });
}

export function bbox(el: Element): DOMRect | null {
    try {
        return (el as SVGGraphicsElement).getBBox();
    } catch {
        return null;
    }
}
