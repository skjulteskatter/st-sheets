import { addChordStaff, type ChordStaffState } from "./chordStaff";
import { drawSecondVoice, type VoiceState } from "./secondVoice";
import { readLayout } from "./layout";

export { harmonyBelow } from "./secondVoice";

export type OverlayOptions = {
    /** a second staff under each system with the chords as block notes */
    chords: boolean;
    /** a second voice (third below, fitted to the chords) in the melody staff */
    voice: boolean;
    /** colour of the second voice */
    voiceColor: string;
};

/** Carried from page to page, in page order. */
export type OverlayState = { chords: ChordStaffState; voice: VoiceState };

export const newOverlayState = (): OverlayState => ({
    chords: { carry: null, prevMean: null },
    voice: { carry: null, prev: null },
});

/**
 * Adds the chosen extras to one rendered page. Returns false when the page can't be measured
 * yet (still hidden): call again once it is shown. A page that is no sheet page counts as done.
 */
export function enhancePage(
    svg: SVGSVGElement,
    options: OverlayOptions,
    state: OverlayState
): boolean {
    if (!options.chords && !options.voice) return true;
    if (svg.querySelectorAll("*").length < 30) return true; // an icon, not a page
    const layout = readLayout(svg);
    if (!layout) return false;
    // The second voice first: it reads the notes where they are, before the chord staff shifts them
    if (options.voice) drawSecondVoice(layout, options.voiceColor, state.voice);
    if (options.chords) addChordStaff(svg, layout, state.chords);
    return true;
}
