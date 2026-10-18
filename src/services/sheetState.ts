import { computed, ref, watch } from "vue";
import { songService } from "./hiddentreasures";

/**
 * What the viewer is showing. Lives outside Sheets.vue so band sync can read
 * and drive it. `instrument` is the instrument offset from Settings;
 * `sheetTransposition` is the sheet API transposition currently rendered
 * (TranspositionSelector), reset to the instrument offset on song change.
 */

function persisted(key: string) {
    const value = ref(localStorage.getItem(key));
    watch(value, (v) => {
        if (v) {
            localStorage.setItem(key, v);
        } else {
            localStorage.removeItem(key);
        }
    });
    return value;
}

export const collectionId = persisted("collection");
export const songId = persisted("song");
export const instrument = persisted("transposition");
export const sheetTransposition = ref(instrument.value ?? "0");

export type Clef = "treble" | "bass" | "alto";
const _clef = persisted("clef");
/** Clef to render in (Settings). */
export const clef = computed<Clef>({
    get: () => (_clef.value as Clef | null) ?? "treble",
    set: (v) => (_clef.value = v === "treble" ? null : v),
});

const _octave = persisted("octave");
/** Octave shift applied on top of the transposition when rendering (not band synced). */
export const octave = computed<number>({
    get: () => parseInt(_octave.value ?? "0") || 0,
    set: (v) => (_octave.value = v ? v.toString() : null),
});

const resolvedSong = ref(null as { key: string; number: number | null } | null);

function songKey(collection: string | null, song: string | null) {
    return `${collection}:${song}`;
}

/** Number of the current song in the current collection; null until resolved. */
export const songNumber = computed(() => {
    const resolved = resolvedSong.value;
    return resolved && resolved.key === songKey(collectionId.value, songId.value)
        ? resolved.number
        : null;
});

let resolvingSongNumber = false;

/**
 * Starts resolving songNumber. Called from Sheets.vue (mounted only when logged
 * in): the API needs an auth token, so this must not run at module load.
 */
export function startSongNumberResolver() {
    if (resolvingSongNumber) return;
    resolvingSongNumber = true;

    watch(
        [collectionId, songId],
        async ([collection, song]) => {
            const key = songKey(collection, song);
            if (!collection || !song || resolvedSong.value?.key === key) {
                return;
            }
            try {
                const s = await songService.get(song);
                if (key === songKey(collectionId.value, songId.value)) {
                    resolvedSong.value = { key, number: s.getNumber(collection) };
                }
            } catch (e) {
                console.error(e);
            }
        },
        { immediate: true },
    );
}

// --- user actions ---

export function selectCollection(id: string | null) {
    collectionId.value = id;
    songId.value = null;
}

export function selectSong(id: string | null) {
    songId.value = id;
    sheetTransposition.value = instrument.value ?? "0";
}

export function selectInstrument(value: string | null) {
    instrument.value = value;
    sheetTransposition.value = value ?? "0";
}

// --- band sync ---

/** Shows a song resolved from a band session, without the user-action resets. */
export function applyRemoteSong(payload: {
    collectionId: string;
    songId: string;
    songNumber: number;
    sheetTransposition: number;
}) {
    resolvedSong.value = {
        key: songKey(payload.collectionId, payload.songId),
        number: payload.songNumber,
    };
    collectionId.value = payload.collectionId;
    songId.value = payload.songId;
    sheetTransposition.value = payload.sheetTransposition.toString();
}

export function applyRemoteTransposition(value: number) {
    sheetTransposition.value = value.toString();
}
