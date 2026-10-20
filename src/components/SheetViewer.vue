<template>
    <div class="max-w-4xl ml-auto mr-auto">
        <div class="flex flex-wrap m-4 gap-4">
            <div>
                <label>Key</label>
                <BaseButton class="w-full">
                    {{song.originalKey}}
                </BaseButton>
            </div>
            <div>
                <label>Verses</label>
                <BaseButton class="w-full">
                    {{song.verses}}
                </BaseButton>
            </div>
            <div class="max-w-sm" v-if="currentSheet">
                <TranspositionSelector
                    :transposition="currentTransposition"
                    :original="song.originalKey"
                    :relative="parseInt(transposition)"
                    @update:transposition="transpose"
                ></TranspositionSelector>
            </div>
            <div v-if="currentSheet">
                <label>Octave</label>
                <div class="flex">
                    <BaseButton class="px-3" @click="emit('update:octave', octave - 1)">
                        <MinusIcon class="w-4 h-4"></MinusIcon>
                        <span class="sr-only">Octave down</span>
                    </BaseButton>
                    <span class="w-10 self-center text-center">{{ octave > 0 ? "+" + octave : octave }}</span>
                    <BaseButton class="px-3" @click="emit('update:octave', octave + 1)">
                        <PlusIcon class="w-4 h-4"></PlusIcon>
                        <span class="sr-only">Octave up</span>
                    </BaseButton>
                </div>
            </div>
        </div>
        <div v-if="svg" class="w-full content-center">
            <SvgViewer class="max-w-4xl ml-auto mr-auto" :svg="svg"></SvgViewer>
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
                {{error}}
            </BaseButton>
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
import { songService } from "../services/hiddentreasures";
import { getSheetFiles, renderSheet as fetchSheet } from "../services/sheetRender";
import { online } from "../services/offline/network";
import SvgViewer from "./SvgViewer.vue";
import { DotsCircleHorizontalIcon, MinusIcon, PlusIcon } from "@heroicons/vue/outline";
import TranspositionSelector from "./TranspositionSelector.vue";
import BaseButton from "./BaseButton.vue";

const props = defineProps<{
    songId: string;
    transposition: string;
    currentTransposition: string;
    clef: "treble" | "bass" | "alto";
    octave: number;
}>();

const emit = defineEmits<{
    (e: "update:currentTransposition", value: string): void;
    (e: "update:octave", value: number): void;
}>();

const getSheets = () => getSheetFiles(props.songId);

const song = ref(await songService.get(props.songId))
const svg = ref(null as string | null);
const sheets = ref(await getSheets());
const currentSheet = ref(null as string | null)

const error = ref(null as string | null)

// Song and transposition can change together (band sync); only the latest render wins.
let renderGeneration = 0;

const renderSheet = async (sheetId: string) => {
    const generation = ++renderGeneration;
    error.value = null;
    currentSheet.value = sheetId;
    sheets.value = [];
    try {
        const svgs = await fetchSheet(
            sheetId,
            parseInt(props.currentTransposition) + 12 * props.octave,
            props.clef,
        );

        if (generation === renderGeneration) {
            svg.value = svgs.join("\n");
        }
    } catch (e) {
        if (generation !== renderGeneration) return;
        console.error(e)
        error.value = online.value
            ? "Failed to render sheet. Check console for more details"
            : "This sheet is not downloaded in this key, clef and octave"
    }
};

if (sheets.value.length === 1) {
    renderSheet(sheets.value[0].id);
}

const transpose = (t: string | null) => {
    emit("update:currentTransposition", t ?? "0");
}

watch(
    () => props.songId,
    async () => {
        renderGeneration++;
        currentSheet.value = null;
        svg.value = null;
        sheets.value = await getSheets();
        song.value = await songService.get(props.songId)
        if (sheets.value.length === 1) {
            renderSheet(sheets.value[0].id);
        }
    }
);

watch(
    () => [props.currentTransposition, props.clef, props.octave],
    () => {
        if (currentSheet.value) {
            renderSheet(currentSheet.value);
        }
    }
);
</script>
