import { musicalKey } from "../services/transposer";
/** Instrument keys and the sheet transposition each one needs. */
export const transpositions: {
    key: number;
    display: string;
    alias?: string[];
}[] = [
    {
        key: 4,
        display: "Ab",
        alias: ["G#"],
    },
    {
        key: 3,
        display: "A",
    },
    {
        key: 2,
        display: "Bb",
        alias: ["A#"],
    },
    {
        key: 1,
        display: "B",
    },
    {
        key: 0,
        display: "C",
    },
    {
        key: -1,
        display: "Db",
        alias: ["C#"],
    },
    {
        key: -2,
        display: "D",
    },
    {
        key: 9,
        display: "Eb",
        alias: ["D#"],
    },
    {
        key: 8,
        display: "E",
    },
    {
        key: 7,
        display: "F",
    },
    {
        key: 6,
        display: "F#",
        alias: ["Gb"],
    },
    {
        key: 5,
        display: "G",
    },
];

/** Display name of an instrument transposition, e.g. "Bb". */
export function instrumentName(transposition: string | null) {
    const key = parseInt(transposition ?? "0") || 0;
    return musicalKey(transpositions.find((t) => t.key === key)?.display ?? transposition ?? "C");
}
