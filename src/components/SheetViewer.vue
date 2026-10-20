<template>
    <div class="max-w-4xl ml-auto mr-auto">
        <!-- Song info card, then the controls card; side by side, stacked on narrow screens -->
        <div class="flex flex-wrap items-stretch gap-3 m-4">
            <div class="card flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-normal">
                <SongCredits :songId="songId"></SongCredits>
                <div class="opacity-70">
                    <p v-if="song.originalKey">Key: <span class="font-semibold">{{ musicalKey(keyName(song.originalKey, minor)) }}</span></p>
                    <p v-if="song.verses">Verses: <span class="font-semibold">{{ song.verses }}</span></p>
                </div>
            </div>
            <!-- Right-aligned; smaller text than the top bar: labels and values (octave, zoom %) -->
            <div class="card ml-auto flex flex-wrap gap-x-3 gap-y-2 text-sm [&_label]:block [&_label]:mb-0.5 [&_label]:text-xs [&_label]:opacity-70">
                <div class="max-w-sm" v-if="currentSheet">
                    <TranspositionSelector
                        :transposition="currentTransposition"
                        :original="song.originalKey"
                        :relative="parseInt(transposition)"
                        :minor="minor"
                        @update:transposition="transpose"
                    ></TranspositionSelector>
                </div>
                <div v-if="sheets.length > 1">
                    <label for="sheet-select">Sheet</label>
                    <BaseSelect id="sheet-select" v-model="selectedSheet" class="max-w-[12rem]">
                        <option v-if="!currentSheet" :value="null" disabled>Pick a sheet</option>
                        <option v-for="(sheet, i) in sheets" :key="sheet.id" :value="sheet.id">
                            {{ sheetLabel(i) }}
                        </option>
                    </BaseSelect>
                </div>
                <InstrumentPicker
                    v-if="sheetInstruments.length > 1"
                    v-model="selectedInstruments"
                    :instruments="sheetInstruments"
                ></InstrumentPicker>
                <div v-if="currentSheet">
                    <label>Octave</label>
                    <div class="flex">
                        <BaseButton class="w-[42px] !px-0" @click="emit('update:octave', octave - 1)">
                            <MinusIcon class="w-4 h-4"></MinusIcon>
                            <span class="sr-only">Octave down</span>
                        </BaseButton>
                        <span class="w-8 self-center text-center">{{ octave > 0 ? "+" + octave : octave }}</span>
                        <BaseButton class="w-[42px] !px-0" @click="emit('update:octave', octave + 1)">
                            <PlusIcon class="w-4 h-4"></PlusIcon>
                            <span class="sr-only">Octave up</span>
                        </BaseButton>
                    </div>
                </div>
                <!-- Always shown so the row doesn't shift; usable once the sheet is drawn -->
                <div>
                    <label>Zoom</label>
                    <div class="flex">
                        <BaseButton class="w-[42px] !px-0" :disabled="!svg || zoom <= MIN_ZOOM" @click="zoom -= 10">
                            <ZoomOutIcon class="w-4 h-4"></ZoomOutIcon>
                            <span class="sr-only">Zoom out</span>
                        </BaseButton>
                        <span class="w-12 self-center text-center">{{ zoom }}%</span>
                        <BaseButton class="w-[42px] !px-0" :disabled="!svg || zoom >= 100" @click="zoom += 10">
                            <ZoomInIcon class="w-4 h-4"></ZoomInIcon>
                            <span class="sr-only">Zoom in</span>
                        </BaseButton>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="svg" class="w-full content-center">
            <SvgViewer class="max-w-4xl ml-auto mr-auto" :style="{ width: zoom + '%' }" :svg="svg"></SvgViewer>
        </div>
        <!-- Several sheets and none picked yet: pick one (later switch with the Sheet dropdown) -->
        <div v-else-if="!currentSheet && sheets.length > 1" class="m-4 flex flex-col gap-2">
            <p class="text-sm opacity-70">This song has {{ sheets.length }} sheets. Pick one:</p>
            <BaseButton
                v-for="(sheet, i) in sheets"
                :key="sheet.id"
                class="!justify-start"
                @click="renderSheet(sheet.id)"
            >
                {{ sheetLabel(i) }}
            </BaseButton>
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
import { computed, ref, watch } from "vue";
import { getSong } from "../services/collectionData";
import { cachedRender, getSheetFiles, getSheetInstruments, renderSheet as fetchSheet } from "../services/sheetRender";
import { online } from "../services/offline/network";
import SvgViewer from "./SvgViewer.vue";
import { DotsCircleHorizontalIcon, MinusIcon, PlusIcon, ZoomInIcon, ZoomOutIcon } from "@heroicons/vue/outline";
import { MIN_ZOOM, zoom } from "../services/sheetState";
import TranspositionSelector from "./TranspositionSelector.vue";
import BaseButton from "./BaseButton.vue";
import SongCredits from "./SongCredits.vue";
import { keyName, musicalKey } from "../services/transposer";
import InstrumentPicker from "./InstrumentPicker.vue";
import BaseSelect from "./BaseSelect.vue";

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

const song = ref(await getSong(props.songId))
const svg = ref(null as string | null);
const sheets = ref(await getSheets());
const currentSheet = ref(null as string | null)

const error = ref(null as string | null)

/** The API sends `minor` on songs; the library's Song type just doesn't declare it. */
const minor = computed(() => (song.value as { minor?: boolean }).minor === true)

/** A sheet's name for the picker: its category, or name, numbered when several share it. */
const sheetLabel = (index: number) => {
    const sheet = sheets.value[index]
    const name = sheet.category || sheet.name || `Sheet ${index + 1}`
    const sameName = sheets.value.filter((s) => (s.category || s.name) === (sheet.category || sheet.name))
    return sameName.length > 1 ? `${name} ${sameName.indexOf(sheet) + 1}` : name
}

/** The Sheet dropdown: switching renders the other sheet. */
const selectedSheet = computed({
    get: () => currentSheet.value,
    set: (id: string | null) => {
        if (id && id !== currentSheet.value) renderSheet(id)
    },
})

/** Parts in the current sheet; the picker shows when there's more than one. */
const sheetInstruments = ref([] as string[])
/** Parts to show; empty means all. Reset for every sheet. */
const selectedInstruments = ref([] as string[])

const loadInstruments = async (sheetId: string) => {
    try {
        const instruments = await getSheetInstruments(sheetId)
        if (currentSheet.value === sheetId) sheetInstruments.value = instruments
    } catch (e) {
        // Details unavailable (e.g. offline): the sheet still renders with all parts
        console.error(e)
    }
}

// Song and transposition can change together (band sync); only the latest render wins.
let renderGeneration = 0;

const renderSheet = async (sheetId: string) => {
    const generation = ++renderGeneration;
    error.value = null;
    if (currentSheet.value !== sheetId) {
        sheetInstruments.value = [];
        selectedInstruments.value = [];
        loadInstruments(sheetId);
    }
    currentSheet.value = sheetId;
    const transposition = parseInt(props.currentTransposition) + 12 * props.octave;
    const clef = props.clef;
    const instruments = [...selectedInstruments.value];

    // Show the saved copy right away, then swap in the fresh render if it differs
    const cached = await cachedRender(sheetId, transposition, clef, instruments);
    if (cached && generation === renderGeneration) {
        svg.value = cached.join("\n");
    }

    try {
        const svgs = await fetchSheet(sheetId, transposition, clef, { instruments });
        const fresh = svgs.join("\n");

        if (generation === renderGeneration && svg.value !== fresh) {
            svg.value = fresh;
        }
    } catch (e) {
        if (generation !== renderGeneration) return;
        console.error(e)
        // Keep showing the saved copy when the network fails
        if (cached) return;
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
        sheetInstruments.value = [];
        selectedInstruments.value = [];
        svg.value = null;
        sheets.value = await getSheets();
        song.value = await getSong(props.songId)
        if (sheets.value.length === 1) {
            renderSheet(sheets.value[0].id);
        }
    }
);

watch(
    // Separate sources, each compared by value: resetting the instruments to a new
    // empty list for a new sheet is not a change, so it doesn't render twice
    [
        () => props.currentTransposition,
        () => props.clef,
        () => props.octave,
        () => selectedInstruments.value.join("\n"),
    ],
    () => {
        if (currentSheet.value) {
            renderSheet(currentSheet.value);
        }
    }
);
</script>
