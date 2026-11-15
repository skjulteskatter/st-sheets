/**
 * Chord symbols to notes, and the block-note voicing shown on the chord staff.
 * Steps are diatonic: E4 (the bottom line of the treble staff) is 0.
 */

export const LET = ["C", "D", "E", "F", "G", "A", "B"];
export const NATPC: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};
export const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

const CHORD =
    /^([A-G])([#b]?)(maj|min|dim|aug|sus2|sus4|m|M|\+)?(\d+)?(add\d+)?(?:\/([A-G])([#b]?))?$/;

const accOf = (s: string) => (s === "#" ? 1 : s === "b" ? -1 : 0);

/** A chord tone: `off` steps above the root, `li` the letter index (C = 0), `acc` its accidental. */
export type ChordNote = { off: number; li: number; acc: number };
export type Chord = {
    ri: number;
    notes: ChordNote[];
    bass: { li: number; acc: number } | null;
};
/** One note of a voicing: `n` is the diatonic step. */
export type VoiceNote = { n: number; li: number; acc: number };

export function parseChord(sym: string): Chord | null {
    const m = CHORD.exec(sym.trim());
    if (!m) return null;
    const [, rl, ra, q = "", num = "", add = "", bl, ba] = m;
    let tones: [number, number][];
    if (q === "sus2")
        tones = [
            [0, 0],
            [1, 2],
            [4, 7],
        ];
    else if (q === "sus4")
        tones = [
            [0, 0],
            [3, 5],
            [4, 7],
        ];
    else if (q === "dim")
        tones = [
            [0, 0],
            [2, 3],
            [4, 6],
        ];
    else if (q === "aug" || q === "+")
        tones = [
            [0, 0],
            [2, 4],
            [4, 8],
        ];
    else if (q === "m" || q === "min")
        tones = [
            [0, 0],
            [2, 3],
            [4, 7],
        ];
    else
        tones = [
            [0, 0],
            [2, 4],
            [4, 7],
        ];
    const maj = q === "maj" || q === "M";
    if (num === "5")
        tones = [
            [0, 0],
            [4, 7],
        ];
    else if (num === "6") tones.push([5, 9]);
    else if (num === "7") tones.push([6, maj ? 11 : q === "dim" ? 9 : 10]);
    else if (num === "9") tones.push([6, maj ? 11 : 10], [8, 14]);
    if (add === "add9") tones.push([8, 14]);

    const ri = LET.indexOf(rl);
    const rootPc = NATPC[rl] + accOf(ra);
    const spell = (li: number, pc: number) => {
        let acc = (((pc - NATPC[LET[li]]) % 12) + 12) % 12;
        if (acc > 6) acc -= 12;
        return acc;
    };
    const notes: ChordNote[] = tones.map(([off, semi]) => {
        const li = (ri + off) % 7;
        return { off, li, acc: spell(li, rootPc + semi) };
    });
    let bass: Chord["bass"] = null;
    if (bl) {
        const b = { li: LET.indexOf(bl), acc: accOf(ba) };
        bass = b;
        if (!notes.some((n) => n.li === b.li && n.acc === b.acc)) {
            notes.push({
                off: ((b.li - ri + 7) % 7) - 7,
                li: b.li,
                acc: b.acc,
            });
        }
    }
    return { ri, notes, bass };
}

/** Every inversion and octave position of the chord (bass note respected). */
function voicings(ch: Chord): VoiceNote[][] {
    const out: VoiceNote[][] = [];
    const want = (((ch.ri - 2) % 7) + 7) % 7;
    for (let n0 = -14; n0 <= 14; n0++) {
        if (((n0 % 7) + 7) % 7 !== want) continue;
        let set: VoiceNote[] = ch.notes.map((x) => ({
            n: n0 + x.off,
            li: x.li,
            acc: x.acc,
        }));
        set.sort((a, b) => a.n - b.n);
        for (let r = 0; r < set.length; r++) {
            const lo = set[0];
            if (!ch.bass || (lo.li === ch.bass.li && lo.acc === ch.bass.acc))
                out.push(set.map((x) => ({ ...x })));
            set = set.slice(1).concat({ ...lo, n: lo.n + 7 });
            set.sort((a, b) => a.n - b.n);
        }
    }
    return out;
}

/** The voicing closest to the previous one's mean height, preferring C4 to G5. */
export function pickVoicing(
    ch: Chord,
    prevMean: number | null
): VoiceNote[] | null {
    const target = prevMean ?? 1.5;
    let best: VoiceNote[] | null = null;
    let bestCost = Infinity;
    for (const v of voicings(ch)) {
        const lo = v[0].n;
        const hi = v[v.length - 1].n;
        if (lo < -5 || hi > 10) continue;
        // Outside C4 (-2) to G5 (7) only with a penalty, so inversions like F#/A# or C#m7/B survive
        const outside = Math.max(0, -2 - lo) + Math.max(0, hi - 7);
        const mean = v.reduce((s, x) => s + x.n, 0) / v.length;
        const cost = Math.abs(mean - target) + (hi - lo) * 0.05 + outside * 3;
        if (cost < bestCost) {
            bestCost = cost;
            best = v;
        }
    }
    return best;
}
