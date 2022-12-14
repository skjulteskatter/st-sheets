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
            <div></div>
        </div>
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
                    ></SheetViewer>
                </template>
                <template #fallback> Loading... </template>
            </Suspense>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { computed, ref } from "vue";
import CollectionSelector from "../components/CollectionSelector.vue";
import SongSelector from "../components/SongSelector.vue";
import SheetViewer from "../components/SheetViewer.vue";
import Settings from "../components/Settings.vue";
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
        return themes.get()
    },
    set(v) {
        themes.set(v)
    }
})

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
