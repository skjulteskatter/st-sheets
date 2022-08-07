<template></template>
<script lang="ts" setup>
import { ref } from "vue";
import { songService, contributorService } from "../services/hiddentreasures";

const props = defineProps<{
    collectionId: string;
    id: string;
}>();

const title = ref(null as string | null);
const number = ref(null as number | null);
const contributorString = ref(null as string | null);

const setSong = async () => {
    const song = await songService.get(props.id);
    title.value = song.title;
    number.value = song.getNumber(props.collectionId);
    const contributors = await contributorService.retrieve({
        itemIds: song.participants.map((i) => i.contributorId),
    });
};
</script>
