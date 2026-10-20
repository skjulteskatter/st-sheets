<template>
    <Modal title="Offline" :show="show" @update:show="show = $event">
        <template #button>
            <button
                type="button"
                class="icon-button"
                :title="online ? 'Download for offline' : 'Offline'"
                @click="show = !show"
            >
                <CloudDownloadIcon class="w-5 h-5 shrink-0"></CloudDownloadIcon>
                <span
                    v-if="!online"
                    class="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-700 bg-amber-500"
                ></span>
                <span class="sr-only">Download for offline</span>
            </button>
        </template>

        <div class="flex flex-col gap-4 max-w-md ml-auto mr-auto">
            <p v-if="!online" class="rounded-xl bg-amber-500/20 p-4 text-sm">
                You are offline. Downloaded collections can still be viewed in the key they were downloaded in.
            </p>

            <template v-if="collectionId">
                <p class="text-sm leading-relaxed opacity-80">
                    Download every song in <strong>{{ collectionTitle }}</strong> so the sheets work without internet.
                    Songs with multiple sheets get all of them.
                </p>
                <div class="flex flex-wrap gap-4">
                    <InstrumentSelector v-model:transposition="downloadInstrument"></InstrumentSelector>
                    <div>
                        <label>Clef</label>
                        <BaseSelect v-model="downloadClef">
                            <option value="treble">Treble</option>
                            <option value="bass">Bass</option>
                            <option value="alto">Alto</option>
                        </BaseSelect>
                    </div>
                </div>
                <p v-if="octave" class="text-xs opacity-60">
                    Uses the current octave shift ({{ octave > 0 ? "+" + octave : octave }}).
                </p>

                <div v-if="progress" class="flex flex-col gap-1">
                    <div class="h-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                            class="h-full bg-blue-500 transition-all"
                            :style="{ width: (progress.total ? (100 * progress.done) / progress.total : 0) + '%' }"
                        ></div>
                    </div>
                    <p class="text-sm opacity-70">
                        {{ progress.done }} / {{ progress.total }} songs
                        · about {{ formatBytes(progress.bytes) }}
                        <span v-if="progress.skipped">· {{ progress.skipped }} sheet(s) already up to date</span>
                    </p>
                </div>
                <p v-else-if="running" class="text-sm opacity-70">Preparing...</p>

                <BaseButton v-if="running" @click="cancel">Cancel</BaseButton>
                <BaseButton v-else type="info" @click="start">Download</BaseButton>

                <p v-if="message" class="text-sm text-center">{{ message }}</p>
                <div v-if="progress?.failed.length" class="text-sm text-red-500">
                    <p>Failed for {{ progress.failed.length }} song(s), try again to retry them:</p>
                    <p class="opacity-80">{{ progress.failed.join(", ") }}</p>
                </div>
            </template>
            <p v-else class="text-sm opacity-70">Select a collection to download it.</p>

            <div v-if="downloads.length" class="border-t border-black/10 dark:border-white/20 pt-4">
                <p class="font-semibold text-sm mb-2">
                    Downloaded
                    <span v-if="downloaded?.count" class="font-normal opacity-70">
                        · {{ downloaded.count }} sheets, about {{ formatBytes(downloaded.bytes) }} in total
                    </span>
                </p>
                <ul class="text-sm opacity-80">
                    <li v-for="d in downloads" :key="downloadKey(d)">
                        {{ d.title }} · {{ instrumentName(d.instrument) }} instrument · {{ d.clef }}
                        <span v-if="d.octave">· octave {{ d.octave > 0 ? "+" + d.octave : d.octave }}</span>
                        <span v-if="d.bytes">· about {{ formatBytes(d.bytes) }}</span>
                        <span class="opacity-60"> · {{ new Date(d.date).toLocaleDateString() }}</span>
                    </li>
                </ul>
            </div>
        </div>

        <template #footer>
            <div class="ml-auto flex gap-2">
                <BaseButton v-if="downloads.length" type="error" :disabled="running" @click="removeAll">
                    Remove downloads
                </BaseButton>
                <BaseButton @click="show = false">Close</BaseButton>
            </div>
        </template>
    </Modal>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { CloudDownloadIcon } from "@heroicons/vue/outline";
import Modal from "./Modal.vue";
import BaseButton from "./BaseButton.vue";
import BaseSelect from "./BaseSelect.vue";
import InstrumentSelector from "./InstrumentSelector.vue";
import { collectionService } from "../services/hiddentreasures";
import { instrumentName } from "../utils/instruments";
import { Clef, clef, instrument, octave } from "../services/sheetState";
import { online } from "../services/offline/network";
import { clearCache, measureSheets, SheetCacheSize } from "../services/offline/cachingClient";
import { formatBytes } from "../utils/format";
import {
    downloadCollection,
    DownloadProgress,
    RenderServiceDownError,
} from "../services/offline/downloadCollection";

const props = defineProps<{
    collectionId: string | null;
}>();

type Download = {
    collectionId: string;
    title: string;
    instrument: string | null;
    clef: Clef;
    octave: number;
    date: string;
    /** Roughly how many bytes its sheets take; missing for downloads made before this was tracked. */
    bytes?: number;
};

const DOWNLOADS_KEY = "offlineDownloads";

const show = ref(false);
// No instrument chosen in Settings means C (0), which the selector needs spelled out
const downloadInstrument = ref(instrument.value ?? "0");
const downloadClef = ref<Clef>(clef.value);
const running = ref(false);
const progress = ref(null as DownloadProgress | null);
const message = ref("");
const downloads = ref<Download[]>(JSON.parse(localStorage.getItem(DOWNLOADS_KEY) ?? "[]"));
let controller: AbortController | null = null;

watch(downloads, (v) => localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(v)), { deep: true });

/** All downloaded sheets on the device; overlaps between downloads are counted once. */
const downloaded = ref(null as SheetCacheSize | null);
const measureDownloaded = async () => (downloaded.value = await measureSheets(true));

// Default to the current settings each time the dialog opens
watch(show, (v) => {
    if (v) measureDownloaded();
    if (v && !running.value) {
        downloadInstrument.value = instrument.value ?? "0";
        downloadClef.value = clef.value;
        progress.value = null;
        message.value = "";
    }
});

const collectionTitle = ref("");
watch(
    () => props.collectionId,
    async (id) => {
        collectionTitle.value = "";
        if (!id) return;
        const collection = (await collectionService.list()).find((c) => c.id === id);
        collectionTitle.value = collection?.title ?? "";
    },
    { immediate: true },
);

const downloadKey = (d: Pick<Download, "collectionId" | "instrument" | "clef" | "octave">) =>
    `${d.collectionId}:${d.instrument ?? "0"}:${d.clef}:${d.octave}`;

const start = async () => {
    const collectionId = props.collectionId;
    if (!collectionId) return;
    if (!online.value) {
        message.value = "You need to be online to download.";
        return;
    }
    controller = new AbortController();
    running.value = true;
    progress.value = null;
    message.value = "";
    const options = {
        instrument: downloadInstrument.value,
        clef: downloadClef.value,
        octave: octave.value,
    };
    try {
        await downloadCollection(
            collectionId,
            {
                transposition: (parseInt(options.instrument ?? "0") || 0) + 12 * options.octave,
                clef: options.clef,
            },
            (p) => (progress.value = p),
            controller.signal,
        );
        if (controller.signal.aborted) {
            message.value = "Download cancelled.";
        } else {
            const entry: Download = {
                collectionId,
                title: collectionTitle.value,
                ...options,
                date: new Date().toISOString(),
                bytes: (progress.value as DownloadProgress | null)?.bytes,
            };
            downloads.value = [
                ...downloads.value.filter((d) => downloadKey(d) !== downloadKey(entry)),
                entry,
            ];
            // progress is set from the callback, which TS's narrowing above doesn't see
            const failed = (progress.value as DownloadProgress | null)?.failed.length;
            message.value = failed ?"Download finished with errors." : "Download complete.";
        }
    } catch (e) {
        console.error(e);
        message.value =
            e instanceof RenderServiceDownError
                ? "Stopped: the sheet service is not responding. Try again later, finished songs are kept."
                : "Download failed. Check your connection and try again.";
    } finally {
        running.value = false;
        controller = null;
        measureDownloaded();
    }
};

const cancel = () => controller?.abort();

const removeAll = async () => {
    await clearCache();
    downloads.value = [];
    downloaded.value = null;
    message.value = "Downloads removed.";
};
</script>
