<template>
    <div>
        <div class="p-4 w-full flex flex-wrap items-end gap-2 dark:text-white">
            <!-- Wraps on narrow screens; items keep their width (up to the screen) instead of being squeezed -->
            <CollectionSelector
                class="shrink-0 max-w-full"
                v-model:collection="collectionId"
            ></CollectionSelector>
            <!-- <TranspositionSelector
                class="ml-2"
                v-model:transposition="transposition"
            ></TranspositionSelector> -->
            <Suspense v-if="collectionId">
                <template #default>
                    <SongSelector
                        class="shrink-0 max-w-full"
                        :collectionId="collectionId"
                        v-model:song="song"
                    >
                    </SongSelector>
                </template>
                <template #fallback> Loading... </template>
            </Suspense>
            <div class="flex gap-2 shrink-0">
                <BandSync :startContext="bandSyncStartContext"></BandSync>
                <OfflineDownload :collectionId="collectionId"></OfflineDownload>
                <Settings
                    v-model:transposition="transposition"
                    v-model:theme="theme"
                    v-model:clef="clef"
                ></Settings>
            </div>
        </div>
        <BandSyncOutOfSyncBar></BandSyncOutOfSyncBar>
        <div>
            <Suspense v-if="song">
                <template #default>
                    <SheetViewer
                        :songId="song"
                        :transposition="transposition ?? '0'"
                        v-model:currentTransposition="sheetTransposition"
                        v-model:octave="octave"
                        :clef="clef"
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
import OfflineDownload from "../components/OfflineDownload.vue";
import BandSyncOutOfSyncBar from "../components/BandSyncOutOfSyncBar.vue";
import themes from "../services/themes";
import {
    clef,
    collectionId as _collectionId,
    instrument,
    octave,
    selectCollection,
    selectInstrument,
    selectSong,
    sheetTransposition,
    songId,
    songNumber,
    startSongNumberResolver,
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
    startSongNumberResolver();
    startBandSyncCoordinator();
    void initBandSync();
});

onUnmounted(stopBandSyncCoordinator);
</script>
