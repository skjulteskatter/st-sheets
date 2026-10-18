<template>
    <div>
        <div class="p-4 w-full flex dark:text-white">
            <CollectionSelector
                class="ml-2 flex-col-1"
                v-model:collection="collectionId"
            ></CollectionSelector>
            <!-- <TranspositionSelector
                class="ml-2"
                v-model:transposition="transposition"
            ></TranspositionSelector> -->
            <Suspense v-if="collectionId">
                <template #default>
                    <SongSelector
                        class="ml-2"
                        :collectionId="collectionId"
                        v-model:song="song"
                    >
                    </SongSelector>
                </template>
                <template #fallback> Loading... </template>
            </Suspense>
            <BandSync
                class="ml-2 self-end"
                :startContext="bandSyncStartContext"
            ></BandSync>
        </div>
        <BandSyncOutOfSyncBar></BandSyncOutOfSyncBar>
        <Settings
            class="fixed top-0 right-0 p-8 z-50"
            v-model:transposition="transposition"
            v-model:theme="theme"
        >
        </Settings>
        <div>
            <Suspense v-if="song">
                <template #default>
                    <SheetViewer
                        :songId="song"
                        :transposition="transposition ?? '0'"
                        v-model:currentTransposition="sheetTransposition"
                    ></SheetViewer>
                </template>
                <template #fallback> Loading... </template>
            </Suspense>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from "vue";
import CollectionSelector from "../components/CollectionSelector.vue";
import SongSelector from "../components/SongSelector.vue";
import SheetViewer from "../components/SheetViewer.vue";
import Settings from "../components/Settings.vue";
import BandSync from "../components/BandSync.vue";
import BandSyncOutOfSyncBar from "../components/BandSyncOutOfSyncBar.vue";
import themes from "../services/themes";
import {
    collectionId as _collectionId,
    instrument,
    selectCollection,
    selectInstrument,
    selectSong,
    sheetTransposition,
    songId,
    songNumber,
} from "../services/sheetState";
import { init as initBandSync } from "../services/bandSync/bandSyncStore";
import {
    startBandSyncCoordinator,
    stopBandSyncCoordinator,
} from "../services/bandSync/bandSyncCoordinator";
import { sessionTranspositionFromApi } from "../services/bandSync/bandSyncSession";

const collectionId = computed({
    get() {
        return _collectionId.value;
    },
    set(v) {
        selectCollection(v);
    },
});

const transposition = computed({
    get() {
        return instrument.value;
    },
    set(v) {
        selectInstrument(v);
    },
});

const theme = computed({
    get() {
        return themes.get()
    },
    set(v) {
        themes.set(v)
    }
})

const song = computed({
    get() {
        return songId.value;
    },
    set(v) {
        selectSong(v);
    },
});

const bandSyncStartContext = computed(() => {
    if (!_collectionId.value || !songId.value || !songNumber.value) return null;
    return {
        songbookId: _collectionId.value,
        songNumber: songNumber.value,
        transposition: sessionTranspositionFromApi(
            parseInt(sheetTransposition.value) || 0,
            parseInt(instrument.value ?? "0") || 0,
        ),
    };
});

onMounted(() => {
    startBandSyncCoordinator();
    void initBandSync();
});

onUnmounted(stopBandSyncCoordinator);
</script>
