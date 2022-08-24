<template>
    <div class="max-w-4xl ml-auto mr-auto">
        <div class="flex gap-4 py-4 px-4 lg:px-0">
            <div class="flex flex-col gap-1">
                <span>Key</span>
                <BaseButton class="w-full">
                    {{ song.originalKey }}
                </BaseButton>
            </div>
            <div class="flex flex-col gap-1">
                <label>Verses</label>
                <BaseButton class="w-full">
                    {{ song.verses }}
                </BaseButton>
            </div>
            <div class="max-w-sm" v-if="currentSheet">
                <TranspositionSelector
                    :transposition="currentTransposition"
                    :original="song.originalKey"
                    :relative="parseInt(transposition)"
                    @update:transposition="transpose"
                />
            </div>
        </div>
        <div v-if="svg" class="w-full content-center">
            <SvgViewer class="max-w-4xl ml-auto mr-auto" :svg="svg" />
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
        <div v-else-if="error" class="w-full text-red-400">
            <BaseButton class="mr-auto ml-auto">
                {{ error }}
            </BaseButton>
        </div>
        <Spinner v-else />
    </div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import {
    sheetService,
    fileService,
    songService,
} from "../services/hiddentreasures";
import SvgViewer from "./SvgViewer.vue";
import TranspositionSelector from "./TranspositionSelector.vue";
import BaseButton from "./BaseButton.vue";
import Spinner from "./Spinner.vue";

const props = defineProps<{
    songId: string;
    transposition: string;
}>();

const getSheets = async () => {
    const files = await fileService.childrenOf(props.songId);
    return files.filter((f) => f.type === "sheetmusic");
};

const currentTransposition = ref(props.transposition);

const song = ref(await songService.get(props.songId));
const svg = ref(null as string | null);
const sheets = ref(await getSheets());
const currentSheet = ref(null as string | null);

const error = ref(null as string | null);

const renderSheet = async (sheetId: string) => {
    error.value = null;
    currentSheet.value = sheetId;
    sheets.value = [];
    try {
        const svgs = await sheetService.render({
            id: sheetId,
            transposition: parseInt(currentTransposition.value),
        });

        svg.value = svgs.join("\n");
    } catch (e) {
        console.error(e);
        error.value = "Failed to render sheet. Check console for more details";
    }
};

if (sheets.value.length === 1) {
    renderSheet(sheets.value[0].id);
}

const transpose = async (t: string | null) => {
    currentTransposition.value = t ?? "0";
    await renderSheet(currentSheet.value ?? "");
};

watch(
    () => [props.songId, props.transposition],
    async () => {
        currentTransposition.value = props.transposition;
        svg.value = null;
        sheets.value = await getSheets();
        song.value = await songService.get(props.songId);
        if (sheets.value.length === 1) {
            renderSheet(sheets.value[0].id);
        }
    }
);
</script>
