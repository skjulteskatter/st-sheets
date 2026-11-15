import { type Chord, LET, pickVoicing, type VoiceNote } from "./chords";
import { bbox, glyph, type Ink, mk, stroke } from "./draw";
import { GLYPHS } from "./glyphs";
import type { BarKind, Layout, System } from "./layout";

/**
 * Adds a second staff under every system of a sheet page, with each chord as a block of
 * stacked notes (like in printed chord sheets). The page's own elements are shifted down to
 * make room and the viewBox grows accordingly.
 */

/** Carried between the pages of one sheet. */
export type ChordStaffState = { carry: Chord | null; prevMean: number | null };

type NoteKind = BarKind | "half" | "quarter";

const KIND_OF_EIGHTHS: Record<number, NoteKind> = {
    2: "quarter",
    3: "dottedQuarter",
    4: "half",
    6: "dotted",
    8: "whole",
    12: "dottedWhole",
};

/**
 * Divides a bar (u eighths) between the chords. Every share must be a single note value
 * and a multiple of q (quarter, in 6/8 a dotted quarter); picks the split closest to the
 * actual shares. null when none fits.
 */
function splitBar(fracs: number[], u: number, q: number): number[] | null {
    let best: number[] | null = null;
    let bestCost = Infinity;
    const rec = (i: number, left: number, acc: number[], cost: number) => {
        if (i === fracs.length) {
            if (left === 0 && cost < bestCost) {
                bestCost = cost;
                best = [...acc];
            }
            return;
        }
        const remaining = fracs.length - i - 1;
        for (let e = q; e <= left; e += q) {
            if (!KIND_OF_EIGHTHS[e]) continue;
            const rest = left - e;
            if (remaining === 0 ? rest !== 0 : rest < remaining * q) continue;
            acc.push(e);
            rec(i + 1, rest, acc, cost + Math.abs(e - fracs[i] * u));
            acc.pop();
        }
    };
    rec(0, u, [], 0);
    return best;
}

type BlockCtx = {
    topY: number;
    sp: number;
    keyAcc: Record<string, number>;
    measureAcc: Record<number, number>;
    left: number;
    ink: Ink;
};

function drawBlock(
    parent: Element,
    x0: number,
    voicing: VoiceNote[],
    kind: NoteKind,
    ctx: BlockCtx
) {
    const { topY, sp, keyAcc, measureAcc, ink } = ctx;
    let x = x0;
    const k = sp / 10;
    const yOf = (n: number) => topY + 4 * sp - (n * sp) / 2;
    // whole, dottedWhole: whole note; half, dotted: half (dotted half); quarter, dottedQuarter: quarter
    const noStem = kind === "whole" || kind === "dottedWhole";
    const headName = noStem
        ? "whole"
        : kind === "quarter" || kind === "dottedQuarter"
        ? "filled"
        : "open";
    const hasDot =
        kind === "dotted" || kind === "dottedWhole" || kind === "dottedQuarter";
    const colW = GLYPHS.filled.w * k;
    const headW = GLYPHS[headName].w * k;

    // Seconds: the upper head goes to the right of the stem
    const cols: number[] = [];
    voicing.forEach((v, i) => {
        cols.push(
            i > 0 && v.n - voicing[i - 1].n === 1 && cols[i - 1] === 0 ? 1 : 0
        );
    });

    // An accidental only where it differs from what already holds there: the key signature
    // (at the line start) or one on the same height in the same measure.
    type Acc = {
        name: "sharp" | "flat" | "natural" | "dsharp";
        times: number;
        col: number;
        w: number;
    } | null;
    const accs: Acc[] = [];
    let accCount = 0;
    let extent = 0;
    voicing.forEach((v) => {
        const inEffect = measureAcc[v.n] ?? (keyAcc[LET[v.li]] || 0);
        measureAcc[v.n] = v.acc;
        if (v.acc === inEffect) {
            accs.push(null);
            return;
        }
        // Double sharp as its own mark (the sheets have no glyph for it), double flat as two flats
        const name =
            v.acc > 1
                ? "dsharp"
                : v.acc > 0
                ? "sharp"
                : v.acc < 0
                ? "flat"
                : "natural";
        const times = v.acc < -1 ? 2 : 1;
        const w = (name === "dsharp" ? 8 : GLYPHS[name].w) * k;
        const col = accCount % 2;
        accCount++;
        accs.push({ name, times, col, w });
        extent = Math.max(
            extent,
            2.5 * k + w + col * (w + 1.5 * k) + (times - 1) * (w + 1)
        );
    });
    // Room on the left so accidentals don't hit the bar line, time or key signature
    x += Math.max(0, ctx.left + 3 - (x - extent));

    const g = mk("g", {});
    voicing.forEach((v, i) => {
        const y = yOf(v.n);
        const hx = x + cols[i] * colW;
        const ledgers: number[] = [];
        if (v.n <= -2) for (let n = -2; n >= v.n; n -= 2) ledgers.push(n);
        else if (v.n >= 10) for (let n = 10; n <= v.n; n += 2) ledgers.push(n);
        for (const n of ledgers)
            g.append(
                stroke(hx - 3 * k, yOf(n), hx + headW + 3 * k, yOf(n), 1, ink)
            );

        g.append(glyph(headName, hx, y, k, ink));

        const a = accs[i];
        if (a && a.name === "dsharp") {
            const cx = hx - 2.5 * k - a.w / 2 - a.col * (a.w + 1.5 * k);
            const r = 3.2 * k;
            g.append(
                mk("path", {
                    d: `M${cx - r} ${y - r}L${cx + r} ${y + r}M${cx + r} ${
                        y - r
                    }L${cx - r} ${y + r}`,
                    stroke: ink,
                    "stroke-width": 2 * k,
                    fill: "none",
                })
            );
        } else if (a) {
            for (let t = 0; t < a.times; t++) {
                const ax =
                    hx -
                    2.5 * k -
                    a.w -
                    a.col * (a.w + 1.5 * k) -
                    t * (a.w + 1);
                g.append(
                    glyph(a.name as "sharp" | "flat" | "natural", ax, y, k, ink)
                );
            }
        }
    });

    const lowY = yOf(voicing[0].n);
    const highY = yOf(voicing[voicing.length - 1].n);
    if (!noStem) {
        const sx = x + colW - 0.75 * k;
        g.append(stroke(sx, lowY, sx, highY - 3.5 * sp, 1.5, ink));
    }
    if (hasDot) {
        const dx = x + headW + (cols.includes(1) ? colW : 0) + 4.5 * k;
        voicing.forEach((v) => {
            const y = yOf(v.n) - (v.n % 2 === 0 ? sp / 2 : 0);
            g.append(glyph("dot", dx, y, k, ink));
        });
    }
    parent.append(g);
}

type Placed = {
    k: number;
    mid: string;
    left: number;
    chord: Chord;
    kind: NoteKind;
    x: number;
};

/** Adds the chord staff. `layout` comes from readLayout for the same page. */
export function addChordStaff(
    svg: SVGSVGElement,
    layout: Layout,
    state: ChordStaffState
) {
    const { systems, sp, keyAcc, ink } = layout;
    if (!systems.some((s) => s.chords.length)) return;
    const vb = (svg.getAttribute("viewBox") || "")
        .trim()
        .split(/\s+/)
        .map(Number);
    if (vb.length !== 4 || vb.some(Number.isNaN)) return;

    // Top level: the systems and everything else (measure numbers, title ...)
    const items: { el: Element; bb: DOMRect; sys: number }[] = [];
    for (const el of Array.from(svg.children)) {
        const bb = bbox(el);
        if (bb)
            items.push({ el, bb, sys: systems.findIndex((s) => s.el === el) });
    }
    const ADD = 8 * sp;
    // What is no system and starts more than 1.5 spacings below the previous system belongs
    // to the next one (measure numbers sit above their system).
    const bandOf = (top: number) => {
        let s = 0;
        for (let k = 1; k < systems.length; k++)
            if (top >= systems[k - 1].y0 + 5.5 * sp) s = k;
        return s;
    };
    systems.forEach((s, k) => {
        s.dy = k * ADD;
    });

    // Line start (clef, key, time signature) and bar lines, copied per system
    const clones: Element[] = [];
    systems.forEach((s) => {
        for (const p of s.prefix) {
            const c = p.el.cloneNode(true) as Element;
            const old = c.getAttribute("transform");
            c.setAttribute(
                "transform",
                `translate(0 ${s.dy + 7 * sp})` + (old ? ` ${old}` : "")
            );
            clones.push(c);
        }
        for (const m of s.measures) {
            for (const r of Array.from(m.el.children)) {
                if (r.tagName !== "rect") continue;
                const b = bbox(r);
                if (!b || b.height < 3.5 * sp) continue;
                const c = r.cloneNode(false) as Element;
                c.setAttribute("y", String(b.y + s.dy + 7 * sp));
                c.removeAttribute("transform");
                clones.push(c);
            }
        }
        const x1 = Math.min(...s.measures.map((m) => m.x));
        const x2 = Math.max(...s.measures.map((m) => m.x2));
        for (let j = 0; j < 5; j++) {
            clones.push(
                mk("path", {
                    d: `M${x1} ${s.y0 + s.dy + 7 * sp + j * sp} H${x2}`,
                    stroke: ink,
                    "stroke-width": 1,
                    fill: "none",
                })
            );
        }
        clones.push(
            mk("rect", {
                x: x1,
                y: s.y0 + s.dy,
                width: 1,
                height: 11 * sp,
                fill: ink,
            })
        );
    });

    // Place the chords into measures
    const out: Placed[] = [];
    let carry = state.carry;
    systems.forEach((s, k) => {
        s.measures.forEach((m, mi) => {
            const lo = mi === 0 ? Math.max(m.x, s.prefixEnd) : m.x;
            const inMeasure = s.chords
                .filter((c) => c.x >= m.x - 0.5 && c.x < m.x2)
                .sort((a, b) => a.x - b.x);
            const width = m.x2 - lo;
            // The chords sounding in this measure. Without a symbol of its own (or when the
            // first comes late) the previous one carries on.
            const entries: { chord: Chord; x: number }[] = [];
            if (
                carry &&
                (inMeasure.length === 0 || inMeasure[0].x - lo > 0.3 * width)
            ) {
                entries.push({ chord: carry, x: lo });
            }
            inMeasure.forEach((c) => entries.push({ chord: c.chord, x: c.x }));
            if (entries.length === 0) return;
            // A measure is always filled: one chord = one block of the whole bar's value; when
            // the chord changes, each gets the note value closest to its share, together the bar.
            const spans = entries.map((e, i) =>
                Math.max(
                    1,
                    (i + 1 < entries.length ? entries[i + 1].x : m.x2) - e.x
                )
            );
            const total = spans.reduce((a, b) => a + b, 0);
            let parts: number[] | null = null;
            if (entries.length > 1 && layout.barUnits > 0) {
                parts = splitBar(
                    spans.map((span) => span / total),
                    layout.barUnits,
                    layout.compound ? 3 : 2
                );
            }
            if (parts) {
                entries.forEach((e, i) => {
                    out.push({
                        k,
                        mid: `${k}:${mi}`,
                        left: lo,
                        chord: e.chord,
                        kind: KIND_OF_EIGHTHS[parts![i]],
                        x: i === 0 ? lo + (mi === 0 ? 12 : 17) : e.x + 4,
                    });
                });
            } else {
                // One chord (or no fitting split): the one sounding longer
                let pick = entries[0];
                let best = -1;
                entries.forEach((e, i) => {
                    if (spans[i] > best + 0.5) {
                        best = spans[i];
                        pick = e;
                    }
                });
                out.push({
                    k,
                    mid: `${k}:${mi}`,
                    x: lo + (mi === 0 ? 12 : 17),
                    left: lo,
                    chord: pick.chord,
                    kind: layout.barKind,
                });
            }
            carry = entries[entries.length - 1].chord;
        });
    });
    state.carry = carry;

    // Shift and insert
    items.forEach((i) => {
        const band = i.sys >= 0 ? i.sys : bandOf(i.bb.y);
        let dy = systems[band].dy;
        // Plain text below the last system (footer, verses) moves below the new staff
        const textOnly =
            i.el.tagName === "text" ||
            (i.el.querySelector("text") && !i.el.querySelector("path"));
        if (
            i.sys < 0 &&
            band === systems.length - 1 &&
            textOnly &&
            i.bb.y > systems[band].y0 + 5 * sp
        )
            dy += ADD;
        if (dy) {
            const old = i.el.getAttribute("transform");
            i.el.setAttribute(
                "transform",
                `translate(0 ${dy})` + (old ? ` ${old}` : "")
            );
        }
    });
    vb[3] += systems.length * ADD;
    svg.setAttribute("viewBox", vb.join(" "));
    for (const c of clones) svg.append(c);

    // An accidental holds for the rest of the measure at the same height
    let curMeasure: string | null = null;
    let measureAcc: Record<number, number> = {};
    for (const o of out) {
        const s: System = systems[o.k];
        const v = pickVoicing(o.chord, state.prevMean);
        if (!v) continue;
        state.prevMean = v.reduce((sum, x) => sum + x.n, 0) / v.length;
        if (o.mid !== curMeasure) {
            curMeasure = o.mid;
            measureAcc = {};
        }
        drawBlock(svg, o.x, v, o.kind, {
            topY: s.y0 + s.dy + 7 * sp,
            sp,
            keyAcc,
            measureAcc,
            left: o.left,
            ink,
        });
    }
}
