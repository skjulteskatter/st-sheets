<template>
    <div>
        <div v-if="svg">
            <SvgViewer :svg="svg"></SvgViewer>
        </div>
        <div v-else-if="sheets.length > 1">
            <div
                class="cursor-pointer border m-4 p-2"
                v-for="sheet in sheets"
                @click="renderSheet(sheet.id)"
            >
                {{ sheet.category }}
            </div>
        </div>
        <div v-else class="grid h-screen place-items-center">
            <DotsCircleHorizontalIcon
                class="animate-spin h-16"
            ></DotsCircleHorizontalIcon>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { ref, watch } from "vue";
import { sheetService, fileService } from "../services/hiddentreasures";
import SvgViewer from "./SvgViewer.vue";
import { DotsCircleHorizontalIcon } from "@heroicons/vue/outline";

const props = defineProps<{
    songId: string;
    transposition: string;
}>();

const getSheets = async () => {
    const files = await fileService.childrenOf(props.songId);
    return files.filter((f) => f.type === "sheetmusic");
};

const svg = ref(null as string | null);

const renderSheet = async (sheetId: string) => {
    sheets.value = [];
    const svgs = await sheetService.render({
        id: sheetId,
        transposition: parseInt(props.transposition),
    });

    svg.value = svgs.join("\n");
};

const sheets = ref(await getSheets());

if (sheets.value.length === 1) {
    renderSheet(sheets.value[0].id);
}

watch(
    () => props.songId,
    async () => {
        svg.value = null;
        sheets.value = await getSheets();
        if (sheets.value.length === 1) {
            renderSheet(sheets.value[0].id);
        }
    }
);
</script>
