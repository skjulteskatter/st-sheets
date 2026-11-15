import { reactive, watch } from "vue";

/**
 * What is added to the sheet besides the notes (see services/sheetOverlay). Remembered per
 * device; both are off until switched on in the Display menu.
 */
export const DEFAULT_VOICE_COLOR = "#2563eb";

type Display = {
    /** a second staff under each system with the chords as block notes */
    chords: boolean;
    /** a harmony voice, a third below the melody and fitted to the chords */
    voice: boolean;
    /** colour of the harmony */
    voiceColor: string;
};

const KEY = "display";

function load(): Display {
    const defaults: Display = {
        chords: false,
        voice: false,
        voiceColor: DEFAULT_VOICE_COLOR,
    };
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        return {
            chords: saved.chords === true,
            voice: saved.voice === true,
            voiceColor: /^#[0-9a-f]{6}$/i.test(saved.voiceColor)
                ? saved.voiceColor
                : defaults.voiceColor,
        };
    } catch {
        return defaults;
    }
}

export const display = reactive(load());

watch(display, (v) => localStorage.setItem(KEY, JSON.stringify(v)));
