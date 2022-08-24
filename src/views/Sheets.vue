<template>
    <Loader>
        <div
            class="py-4 px-4 lg:px-0 max-w-4xl mx-auto flex gap-4 dark:text-white border-b border-gray-700"
        >
            <CollectionSelector
                class="flex-col-1"
                v-model:collection="collectionId"
            />
            <!-- <TranspositionSelector
                class="ml-2"
                v-model:transposition="transposition"
            /> -->
            <SongSelector
                v-if="collectionId"
                :collectionId="collectionId"
                v-model:song="song"
            />
            <Settings
                class="fixed top-0 right-0 p-8 z-50"
                v-model:transposition="transposition"
                v-model:theme="theme"
            />
        </div>
        <SheetViewer
            v-if="song"
            :songId="song"
            :transposition="transposition ?? '0'"
        />
    </Loader>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import CollectionSelector from "../components/CollectionSelector.vue";
import SongSelector from "../components/SongSelector.vue";
import SheetViewer from "../components/SheetViewer.vue";
import Settings from "../components/Settings.vue";
import Loader from "../components/Loader.vue";
import themes from "../services/themes";

const _collectionId = ref(localStorage.getItem("collection"));
const collectionId = computed({
    get() {
        return _collectionId.value;
    },
    set(v) {
        _collectionId.value = v;
        song.value = null;
        if (v) {
            localStorage.setItem("collection", v);
        } else {
            localStorage.removeItem("collection");
        }
    },
});

const _transposition = ref(localStorage.getItem("transposition"));
const transposition = computed({
    get() {
        return _transposition.value;
    },
    set(v) {
        _transposition.value = v;
        if (v) {
            localStorage.setItem("transposition", v);
        } else {
            localStorage.removeItem("transposition");
        }
    },
});

const theme = computed({
    get() {
        return themes.get();
    },
    set(v) {
        themes.set(v);
    },
});

const _song = ref(localStorage.getItem("song"));
const song = computed({
    get() {
        return _song.value;
    },
    set(v) {
        _song.value = v;
        if (v) {
            localStorage.setItem("song", v);
        } else {
            localStorage.removeItem("song");
        }
    },
});
</script>
