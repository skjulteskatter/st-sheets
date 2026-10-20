<template>
    <div v-if="credits" class="text-sm opacity-70 leading-tight">
        <p>Text: {{ credits.authors.join(", ") || "Unknown" }}</p>
        <p>Melody: {{ credits.composers.join(", ") || "Unknown" }}</p>
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

watch(
    () => props.songId,
    async (id) => {
        credits.value = null;
        try {
            const result = await getCredits(await getSong(id));
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
