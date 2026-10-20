<template>
    <div>
        <label>Song</label>
        <Modal :title="title" v-model:show="showModal">
            <div class="flex flex-col gap-4">
                <input
                    ref="searchInput"
                    v-model="query"
                    type="search"
                    placeholder="Search by title or lyrics"
                    class="control control-default w-full px-3"
                />

                <template v-if="query.trim()">
                    <p v-if="searching && !results.length" class="text-sm opacity-70">Searching...</p>
                    <p v-else-if="searchError && !results.length" class="text-sm text-red-500">{{ searchError }}</p>
                    <p v-else-if="!results.length && query.trim().length < MIN_SEARCH_LENGTH" class="text-sm opacity-70">
                        Keep typing...
                    </p>
                    <p v-else-if="!results.length" class="text-sm opacity-70">No songs found</p>
                    <ul v-else class="flex flex-col gap-1.5">
                        <li v-for="r in results" :key="r.song.id">
                            <button
                                type="button"
                                class="control flex w-full items-center gap-3 px-3 text-left"
                                :class="r.song.id === song ? selectedClass : 'control-default'"
                                @click="openResult(r)"
                            >
                                <span class="w-10 shrink-0 font-medium tabular-nums">{{ r.number ?? "" }}</span>
                                <span class="truncate">{{ r.song.title }}</span>
                                <span v-if="r.collectionTitle" class="ml-auto shrink-0 text-xs opacity-60">
                                    {{ r.collectionTitle }}
                                </span>
                            </button>
                        </li>
                    </ul>
                </template>

                <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
                    <button
                        v-for="s in songs"
                        :key="s.id"
                        type="button"
                        class="control tabular-nums"
                        :class="s.id === song ? selectedClass : 'control-default'"
                        :title="s.title"
                        @click="setSong(s)"
                    >
                        {{ s.getNumber(collectionId) }}
                    </button>
                </div>
            </div>
        </Modal>
    </div>
</template>
<script lang="ts" setup>
import { Song } from "hiddentreasures-js";
import { computed, nextTick, ref, watch } from "vue";
import { getCollectionSongs } from "../services/collectionData";
import { collectionService, searchService, songService } from "../services/hiddentreasures";
import { online } from "../services/offline/network";
import Modal from "./Modal.vue";

const props = defineProps<{
    collectionId: string;
    song: string | null;
}>();

const emit = defineEmits<{
    (e: "update:song", song: string | null): void;
    /** A song from another collection was picked (search): switch to that collection. */
    (e: "open", collectionId: string, songId: string): void;
}>();

const SEARCH_DEBOUNCE_MS = 400;
const MAX_RESULTS = 10;
/** Shorter queries aren't sent (a song number still matches locally). */
const MIN_SEARCH_LENGTH = 2;
const selectedClass = "border-blue-600 bg-blue-500 text-white";

const sort = (songs: Song[]) => {
    return songs.sort((a, b) => {
        return (
            (a.getNumber(props.collectionId) ?? 0) -
            (b.getNumber(props.collectionId) ?? 0)
        );
    });
};

const showModal = ref(false);
const searchInput = ref(null as HTMLInputElement | null);

const songs = ref(sort(await getCollectionSongs(props.collectionId)));

const title = computed(() => {
    const song = songs.value.find((i) => i.id === props.song);
    if (!song) {
        return "Select song";
    }
    return song.getNumber(props.collectionId) + " - " + song.title;
});

const setSong = (song: Song) => {
    emit("update:song", song.id);
    showModal.value = false;
};

watch(
    () => props.collectionId,
    async (first) => {
        songs.value = sort(await getCollectionSongs(first));
    }
);

// --- search ---

type Result = {
    song: Song;
    /** The collection to open it in: the current one when the song is in it. */
    collectionId: string;
    number: number | null;
    /** Shown for songs outside the current collection. */
    collectionTitle: string | null;
};

const query = ref("");
const results = ref<Result[]>([]);
const searching = ref(false);
const searchError = ref("");
let searchGeneration = 0;
let debounce: ReturnType<typeof setTimeout> | undefined;

async function toResult(song: Song): Promise<Result | null> {
    if (song.getNumber(props.collectionId) !== null) {
        return { song, collectionId: props.collectionId, number: song.getNumber(props.collectionId), collectionTitle: null };
    }
    // Elsewhere: open it in the first song collection the user has that contains it
    const collections = (await collectionService.list()).filter((c) => c.type === "song");
    const entry = song.collections.find((c) => collections.some((col) => col.id === c.collectionId));
    if (!entry) return null;
    const collection = collections.find((c) => c.id === entry.collectionId)!;
    return { song, collectionId: collection.id, number: entry.number, collectionTitle: collection.title };
}

/** The song with this number in the current collection, if the text is a number. */
function songByNumber(text: string) {
    return /^\d+$/.test(text)
        ? songs.value.find((s) => s.getNumber(props.collectionId) === parseInt(text))
        : undefined;
}

/** Songs by id: from the open collection, the rest in one request. */
async function songsById(ids: string[]) {
    const known = new Map(songs.value.map((s) => [s.id, s]));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length) {
        for (const s of await songService.retrieve({ itemIds: missing })) known.set(s.id, s);
    }
    return ids.map((id) => known.get(id)).filter((s): s is Song => !!s);
}

async function search(text: string) {
    const generation = ++searchGeneration;
    searching.value = true;
    searchError.value = "";
    try {
        const found = await searchService.search({ query: text, limit: MAX_RESULTS });
        const foundSongs = await songsById(found.songs.map((r) => r.id));
        const resolved = await Promise.all(foundSongs.map(toResult));
        if (generation !== searchGeneration) return;
        // Typing a number shows that song in the current collection first
        const byNumber = songByNumber(text);
        const list = resolved.filter((r): r is Result => !!r && r.song.id !== byNumber?.id);
        results.value = (byNumber ? [(await toResult(byNumber))!, ...list] : list).slice(0, MAX_RESULTS);
    } catch (e) {
        if (generation !== searchGeneration) return;
        console.error(e);
        results.value = [];
        searchError.value = online.value ? "Search failed. Try again." : "Search needs an internet connection.";
    } finally {
        if (generation === searchGeneration) searching.value = false;
    }
}

watch(query, (text) => {
    clearTimeout(debounce);
    const trimmed = text.trim();
    if (!trimmed) {
        searchGeneration++;
        results.value = [];
        searching.value = false;
        return;
    }
    // A song number matches locally right away, while the search runs
    const byNumber = songByNumber(trimmed);
    if (byNumber) {
        toResult(byNumber).then((r) => {
            if (r && query.value.trim() === trimmed) results.value = [r];
        });
    }
    if (trimmed.length < MIN_SEARCH_LENGTH) {
        searchGeneration++;
        searching.value = false;
        if (!byNumber) results.value = [];
        return;
    }
    searching.value = true;
    debounce = setTimeout(() => search(trimmed), SEARCH_DEBOUNCE_MS);
});

const openResult = (r: Result) => {
    if (r.collectionId === props.collectionId) {
        emit("update:song", r.song.id);
    } else {
        emit("open", r.collectionId, r.song.id);
    }
    showModal.value = false;
};

watch(showModal, async (open) => {
    if (!open) {
        query.value = "";
        return;
    }
    // Focus search with a keyboard/mouse; on touch it would pop the keyboard over the number grid
    if (window.matchMedia("(pointer: fine)").matches) {
        await nextTick();
        searchInput.value?.focus();
    }
});
</script>
