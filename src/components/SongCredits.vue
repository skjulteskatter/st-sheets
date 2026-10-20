<template>
    <!-- Rendered while loading too, so what sits beside it doesn't jump when the names arrive -->
    <div class="text-sm opacity-70 leading-normal">
        <p>
            Text: {{ credits ? credits.authors.join(", ") || "Unknown" : "…" }}
            <span v-if="years.written" class="opacity-70">({{ years.written }})</span>
        </p>
        <p>
            Melody: {{ credits ? credits.composers.join(", ") || "Unknown" : "…" }}
            <span v-if="years.composed" class="opacity-70">({{ years.composed }})</span>
        </p>
    </div>
</template>
<script lang="ts" setup>
import { ref, watch } from "vue";
import { getSong } from "../services/collectionData";
import { Credits, getCredits } from "../utils/contributors";

const props = defineProps<{
    songId: string;
}>();

const credits = ref(null as Credits | null);
/**
 * Year the text was written ("P1929" when only the publishing year is known)
 * and the melody composed, when known.
 */
const years = ref({ written: null as string | null, composed: null as number | null });

/** The API also sends `yearPublished`; the library's Song type just doesn't declare it. */
type SongYears = { yearWritten: number | null; yearPublished?: number | null; yearComposed: number | null };

function writtenYear(song: SongYears) {
    if (song.yearWritten) return song.yearWritten.toString();
    return song.yearPublished ? `P${song.yearPublished}` : null;
}

watch(
    () => props.songId,
    async (id) => {
        credits.value = null;
        years.value = { written: null, composed: null };
        try {
            const song = await getSong(id);
            if (props.songId !== id) return;
            years.value = { written: writtenYear(song as SongYears), composed: song.yearComposed };
            const result = await getCredits(song);
            if (props.songId === id) {
                credits.value = result;
            }
        } catch (e) {
            console.error(e);
        }
    },
    { immediate: true },
);
</script>
