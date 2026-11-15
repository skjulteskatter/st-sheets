import { bbox, glyph, mk, stroke } from "./draw";
import { GLYPHS } from "./glyphs";
import { type Chord, LET } from "./chords";
import type { Layout } from "./layout";

/**
 * A harmony voice under the melody: by default a diatonic third below (the key signature's
 * accidentals, so a major or minor third depending on the degree). When that note is not a
 * tone of the current chord, it is adjusted to the nearest chord tone below the melody.
 *
 *  1. The melody note is a chord tone and the diatonic third below is too: use the third.
 *  2. The melody note is a chord tone, the third is not: pick among the chord tones 1-5 steps
 *     below the melody. A minor or major third (3-4 semitones) is preferred, then a fourth,
 *     fifth, major second; a semitone clash or unison is excluded. Every step or semitone away
 *     from the diatonic third costs extra, as do big leaps from the previous second-voice note.
 *  3. The melody note is not a chord tone (passing or neighbour note): keep the diatonic third,
 *     the second voice moves in parallel.
 *
 * Steps are diatonic: E4 (the bottom line of the treble staff) is 0.
 */

const PC = [0, 2, 4, 5, 7, 9, 11];
const letterIndex = (n: number) => (((n + 2) % 7) + 7) % 7;
export const midiOf = (n: number, acc: number) =>
    12 * (5 + Math.floor((n + 2) / 7)) + PC[letterIndex(n)] + acc;

/** Cost by distance in semitones to the melody; any other distance is not allowed. */
const BASE_COST: Record<number, number> = {
    3: 0,
    4: 0,
    5: 1.5,
    7: 2.5,
    2: 3,
    6: 4,
};

export type Pitch = { n: number; acc: number };

export function harmonyBelow(
    note: Pitch,
    {
        chord = null,
        keyAcc = {},
        prev = null,
    }: {
        chord?: Chord | null;
        keyAcc?: Record<string, number>;
        prev?: Pitch | null;
    } = {}
): Pitch & { adjusted: boolean } {
    const dn = note.n - 2;
    const diat = { n: dn, acc: keyAcc[LET[letterIndex(dn)]] || 0 };
    if (!chord) return { ...diat, adjusted: false };

    const isTone = (n: number, acc: number) =>
        chord.notes.some((t) => t.li === letterIndex(n) && t.acc === acc);
    if (!isTone(note.n, note.acc)) return { ...diat, adjusted: false };
    if (isTone(diat.n, diat.acc)) return { ...diat, adjusted: false };

    const m = midiOf(note.n, note.acc);
    const dm = midiOf(diat.n, diat.acc);
    let best: Pitch | null = null;
    let bestCost = Infinity;
    for (let n = note.n - 5; n <= note.n - 1; n++) {
        for (const t of chord.notes) {
            if (t.li !== letterIndex(n)) continue;
            const pm = midiOf(n, t.acc);
            const base = BASE_COST[m - pm];
            if (base === undefined) continue;
            let cost = base + Math.abs(n - dn) + 0.5 * Math.abs(pm - dm);
            if (prev) cost += 0.1 * Math.abs(pm - midiOf(prev.n, prev.acc));
            if (cost < bestCost) {
                bestCost = cost;
                best = { n, acc: t.acc };
            }
        }
    }
    return best ? { ...best, adjusted: true } : { ...diat, adjusted: false };
}

/** Which accidental sign is this path? By its size relative to the staff spacing. */
function accidentalOf(b: DOMRect, k: number) {
    let best: { name: "sharp" | "flat" | "natural"; acc: number } | null = null;
    let bestD = 4; // at most 0.4 staff spacings off
    for (const [name, acc] of [
        ["sharp", 1],
        ["flat", -1],
        ["natural", 0],
    ] as const) {
        const d = Math.hypot(
            b.width / k - GLYPHS[name].w,
            b.height / k - GLYPHS[name].h
        );
        if (d < bestD) {
            bestD = d;
            best = { name, acc };
        }
    }
    return best;
}

/** Colours every filled area and existing stroke of an element tree. */
function tint(root: Element, color: string) {
    for (const e of Array.from(root.querySelectorAll("*"))) {
        const fill = e.getAttribute("fill");
        const stroke = e.getAttribute("stroke");
        if (fill !== "none") {
            e.setAttribute("fill", color);
            (e as SVGElement).style.setProperty("fill", color);
        }
        if (stroke && stroke !== "none") {
            e.setAttribute("stroke", color);
            (e as SVGElement).style.setProperty("stroke", color);
        }
    }
}

/** Carried between the pages of one sheet. */
export type VoiceState = { carry: Chord | null; prev: Pitch | null };

/**
 * Draws the second voice into the melody systems: a copy of each note head, moved to the new
 * pitch, with accidental, ledger lines and an extended stem. Returns how many notes it drew.
 */
export function drawSecondVoice(
    layout: Layout,
    color: string,
    state: VoiceState
) {
    const { systems, sp, keyAcc } = layout;
    const k = sp / 10;
    let drawn = 0;

    for (const s of systems) {
        const chords = [...s.chords].sort((a, b) => a.x - b.x);
        const yOf = (n: number) => s.y0 + 4 * sp - (n * sp) / 2;
        for (const m of s.measures) {
            const measureAcc: Record<number, number> = {};
            const notes = Array.from(m.el.querySelectorAll(".vf-stavenote"))
                .map((el) => {
                    // Rests have a notehead too, but are not about one staff spacing tall
                    const heads = Array.from(
                        el.querySelectorAll(".vf-notehead")
                    )
                        .map((h) => ({ el: h, b: bbox(h) }))
                        .filter(
                            (h): h is { el: Element; b: DOMRect } =>
                                !!h.b &&
                                h.b.width > 0 &&
                                h.b.height > 0.8 * sp &&
                                h.b.height < 1.25 * sp
                        );
                    return heads.length === 1 ? { el, head: heads[0] } : null;
                })
                .filter(
                    (
                        x
                    ): x is {
                        el: Element;
                        head: { el: Element; b: DOMRect };
                    } => !!x
                )
                .sort((a, b) => a.head.b.x - b.head.b.x);

            for (const { el, head } of notes) {
                const hb = head.b;
                const cy = hb.y + hb.height / 2;
                const n = Math.round((s.y0 + 4 * sp - cy) / (sp / 2));
                const letter = LET[letterIndex(n)];

                let melAcc: { name: string; acc: number; b: DOMRect } | null =
                    null;
                for (const p of Array.from(
                    el.querySelectorAll(
                        ".vf-modifiers path, .vf-accidental path"
                    )
                )) {
                    const b = bbox(p);
                    const a = b && accidentalOf(b, k);
                    if (a && b) {
                        melAcc = { ...a, b };
                        break;
                    }
                }
                const acc = melAcc
                    ? melAcc.acc
                    : measureAcc[n] ?? (keyAcc[letter] || 0);
                measureAcc[n] = acc;

                // The chord at this note: the last symbol at or just before it, else the one carried on
                let chord = state.carry;
                for (const c of chords) {
                    if (c.x <= hb.x + sp) chord = c.chord;
                    else break;
                }

                const h = harmonyBelow(
                    { n, acc },
                    { chord, keyAcc, prev: state.prev }
                );
                state.prev = h;

                const g = mk("g", {});
                const copy = head.el.cloneNode(true) as Element;
                const old = copy.getAttribute("transform");
                copy.setAttribute(
                    "transform",
                    `translate(0 ${((n - h.n) * sp) / 2})` +
                        (old ? ` ${old}` : "")
                );
                g.append(copy);

                const y = yOf(h.n);
                const ledgers: number[] = [];
                if (h.n <= -2)
                    for (let l = -2; l >= h.n; l -= 2) ledgers.push(l);
                else if (h.n >= 10)
                    for (let l = 10; l <= h.n; l += 2) ledgers.push(l);
                for (const l of ledgers)
                    g.append(
                        stroke(
                            hb.x - 3 * k,
                            yOf(l),
                            hb.x + hb.width + 3 * k,
                            yOf(l),
                            1,
                            color
                        )
                    );

                // An accidental only where it differs from what already holds at that height
                const inEffect =
                    measureAcc[h.n] ?? (keyAcc[LET[letterIndex(h.n)]] || 0);
                measureAcc[h.n] = h.acc;
                if (h.acc !== inEffect && Math.abs(h.acc) <= 1) {
                    const name =
                        h.acc > 0 ? "sharp" : h.acc < 0 ? "flat" : "natural";
                    const w = GLYPHS[name].w * k;
                    let ax = hb.x - 2.5 * k - w;
                    if (melAcc) ax = Math.min(ax, melAcc.b.x - 1.5 * k - w); // not onto the melody's accidental
                    g.append(glyph(name, ax, y, k, color));
                }

                // Stem up: extend it down to the new note; stem down passes the new note anyway
                const stem = el.querySelector(".vf-stem path");
                const sb = stem && bbox(stem);
                if (sb && sb.x + sb.width / 2 > hb.x + hb.width / 2) {
                    const sx = sb.x + sb.width / 2;
                    g.append(stroke(sx, cy, sx, y, 1.5, color));
                }

                tint(g, color);
                s.el.append(g);
                drawn++;
            }
            // The last chord of the measure carries into the next
            const last = chords.filter((c) => c.x < m.x2).pop();
            if (last) state.carry = last.chord;
        }
    }
    return drawn;
}
