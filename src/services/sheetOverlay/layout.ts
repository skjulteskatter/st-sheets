import { FLAT_ORDER, parseChord, SHARP_ORDER, type Chord } from "./chords";
import { bbox } from "./draw";

/**
 * Reads the structure of a rendered sheet page. The renderer's SVG (VexFlow) has one
 * `g.staffline` per system with its measures (`g.vf-measure`: five lines, bar line, and at the
 * start of a line clef, key and time signature, plus the notes) and the chord symbols
 * (`g.vf-text`).
 */

export type Measure = { x: number; x2: number; el: SVGGElement };
export type PlacedChord = { chord: Chord; x: number; y: number };
export type System = {
    el: SVGGElement;
    /** y of the top staff line */
    y0: number;
    measures: Measure[];
    /** vertical offset applied to this system (set when the chord staff is added) */
    dy: number;
    chords: PlacedChord[];
    /** clef, key and time signature groups at the line start, with their boxes */
    prefix: { el: SVGGElement; bb: DOMRect }[];
    /** right edge of that line start */
    prefixEnd: number;
};

export type BarKind =
    | "half"
    | "dotted"
    | "whole"
    | "dottedQuarter"
    | "dottedWhole"
    | "quarter";

export type Layout = {
    systems: System[];
    /** staff-line spacing */
    sp: number;
    /** accidentals of the key signature by letter, e.g. { F: 1, C: 1 } */
    keyAcc: Record<string, number>;
    /** note value that fills one bar, bar length in eighths, whether the metre is compound */
    barKind: BarKind;
    barUnits: number;
    compound: boolean;
    /** the sheet's own ink colour (staff lines), so drawn notes match it */
    ink: string;
};

// Time signature digit glyphs (width x height rounded to 0.1). The number of path commands
// varies between renderer versions, the size doesn't.
const DIGITS: Record<string, string> = {
    "13.2x19.4": "2",
    "11.8x19.4": "3",
    "13.5x19.4": "4",
    "13.7x19.4": "6",
    "14.1x19.4": "8",
};
const BAR_KIND: Record<string, BarKind> = {
    "2/4": "half",
    "3/4": "dotted",
    "4/4": "whole",
    "2/2": "whole",
    "3/8": "dottedQuarter",
    "6/8": "dotted",
    "9/8": "dottedWhole",
    "12/8": "dottedWhole",
    "6/4": "dottedWhole",
};
const BAR_UNITS: Record<string, number> = {
    "2/4": 4,
    "3/4": 6,
    "4/4": 8,
    "2/2": 8,
    "3/8": 3,
    "6/8": 6,
    "9/8": 9,
    "12/8": 12,
    "6/4": 12,
};
const COMPOUND = new Set(["3/8", "6/8", "9/8", "12/8"]);

const has = (el: Element, cls: string) =>
    !!el.classList && el.classList.contains(cls);
const glyphKey = (b: DOMRect) => {
    const n = (v: number) => Math.round(v * 10) / 10;
    return `${n(b.width)}x${n(b.height)}`;
};

/** null when the page is not measurable (yet): hidden, or not a sheet page. */
export function readLayout(svg: SVGSVGElement): Layout | null {
    const systems: System[] = [];
    let sp = 0;
    for (const sg of Array.from(svg.children)) {
        if (sg.tagName !== "g" || !has(sg, "staffline")) continue;
        const measures: Measure[] = [];
        let y0 = Infinity;
        let y4 = -Infinity;
        for (const me of Array.from(sg.children)) {
            if (!has(me, "vf-measure")) continue;
            let x = Infinity;
            let x2 = -Infinity;
            for (const p of Array.from(me.children)) {
                if (p.tagName !== "path") continue;
                const b = bbox(p);
                if (!b || b.height !== 0 || b.width <= 20) continue; // a staff line
                x = Math.min(x, b.x);
                x2 = Math.max(x2, b.x + b.width);
                y0 = Math.min(y0, b.y);
                y4 = Math.max(y4, b.y);
            }
            if (Number.isFinite(x))
                measures.push({ x, x2, el: me as SVGGElement });
        }
        if (!measures.length) continue;
        measures.sort((a, b) => a.x - b.x);
        sp = (y4 - y0) / 4;
        systems.push({
            el: sg as SVGGElement,
            y0,
            measures,
            dy: 0,
            chords: [],
            prefix: [],
            prefixEnd: 0,
        });
    }
    if (!systems.length || !(sp > 3 && sp < 30)) return null;

    for (const s of systems) {
        for (const c of Array.from(s.el.children)) {
            if (!has(c, "vf-text")) continue;
            for (const t of Array.from(c.querySelectorAll("text"))) {
                const chord = parseChord(t.textContent ?? "");
                const x = parseFloat(t.getAttribute("x") ?? "");
                const y = parseFloat(t.getAttribute("y") ?? "");
                if (chord && Number.isFinite(x) && Number.isFinite(y))
                    s.chords.push({ chord, x, y });
            }
        }
        const first = s.measures[0];
        s.prefix = Array.from(first.el.children)
            .filter(
                (c) =>
                    c.tagName === "g" &&
                    (has(c, "vf-clef") ||
                        has(c, "vf-keysignature") ||
                        has(c, "vf-timesignature"))
            )
            .map((el) => ({ el: el as SVGGElement, bb: bbox(el) }))
            .filter(
                (p): p is { el: SVGGElement; bb: DOMRect } =>
                    !!p.bb && p.bb.width > 0
            );
        s.prefixEnd = s.prefix.length
            ? Math.max(...s.prefix.map((p) => p.bb.x + p.bb.width))
            : first.x;
    }

    // Ink: the staff lines' own colour
    let ink = "#000000";
    const line = systems[0].measures[0].el.querySelector("path");
    if (line) {
        const c = getComputedStyle(line).stroke;
        if (c && c !== "none") ink = c;
    }

    // Key signature (first system): sharps or flats from the first sign's height, count of signs
    const s0 = systems[0];
    const keyAcc: Record<string, number> = {};
    const keyEl = s0.prefix.find((p) => has(p.el, "vf-keysignature"));
    const keyPaths = keyEl ? Array.from(keyEl.el.querySelectorAll("path")) : [];
    if (keyPaths.length > 0) {
        const f = bbox(keyPaths[0]);
        if (f) {
            const centre = f.y + f.height / 2;
            const sharps =
                Math.abs(centre - s0.y0) < Math.abs(centre - (s0.y0 + 2 * sp));
            const order = sharps ? SHARP_ORDER : FLAT_ORDER;
            order.slice(0, Math.min(keyPaths.length, 7)).forEach((l) => {
                keyAcc[l] = sharps ? 1 : -1;
            });
        }
    }

    // Time signature from its digit glyphs (numerator above, denominator below)
    let barKind: BarKind = "whole";
    let barUnits = 8;
    let compound = false;
    const tsEl = s0.prefix.find((p) => has(p.el, "vf-timesignature"));
    const ts = tsEl
        ? Array.from(tsEl.el.querySelectorAll("path"))
              .map((el) => ({ el, bb: bbox(el) }))
              .filter((p): p is { el: SVGPathElement; bb: DOMRect } => !!p.bb)
        : [];
    const rowOf = (p: { bb: DOMRect }) =>
        p.bb.y + p.bb.height / 2 < s0.y0 + 2 * sp ? 0 : 1;
    const digits = [0, 1].map((r) =>
        ts
            .filter((p) => rowOf(p) === r)
            .sort((a, b) => a.bb.x - b.bb.x)
            .map((p) => DIGITS[glyphKey(p.bb)] ?? "?")
            .join("")
    );
    const sig = digits.join("/");
    barKind = BAR_KIND[sig] ?? barKind;
    barUnits = BAR_UNITS[sig] ?? 0;
    compound = COMPOUND.has(sig);
    if (!BAR_KIND[sig] && ts.length === 2) {
        // Unknown digits: as wide above as below like 4/4, otherwise 3/4
        barKind =
            Math.abs(ts[0].bb.width - ts[1].bb.width) < 0.5
                ? "whole"
                : "dotted";
        barUnits = barKind === "whole" ? 8 : 6;
    }

    return { systems, sp, keyAcc, barKind, barUnits, compound, ink };
}
