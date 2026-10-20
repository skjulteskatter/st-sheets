<template>
    <div>
        <Modal
            title="Settings"
            v-model:show="show"
        >
            <template #button>
                <button @click="show = !show" type="button" class="icon-button" title="Settings">
                    <CogIcon class="w-5 h-5 shrink-0"></CogIcon>
                    <span class="sr-only">Settings</span>
                </button>
            </template>
            <div class="flex flex-wrap">
                <InstrumentSelector
                    class="m-2"
                    v-model:transposition="selectedTransposition"
                ></InstrumentSelector>
                <div class="m-2">
                    <label>Clef</label>
                    <BaseSelect v-model="selectedClef">
                        <option value="treble">Treble</option>
                        <option value="bass">Bass</option>
                        <option value="alto">Alto</option>
                    </BaseSelect>
                </div>
                <div class="m-2">
                    <label>Theme</label>
                    <BaseSelect
                        v-model="selectedTheme"
                    >
                        <option value="dark">
                            Dark
                        </option>
                        <option value="light">
                            Light
                        </option>
                    </BaseSelect>
                </div>
            </div>
            <div class="m-2 mt-4 border-t border-black/10 dark:border-white/20 pt-4">
                <label>Saved sheets</label>
                <p class="text-sm opacity-70 mb-2">
                    Sheets you have viewed are saved on this device. Clearing them frees space;
                    collections downloaded for offline use are kept.
                </p>
                <div class="flex items-center gap-3">
                    <BaseButton :disabled="clearing || !viewed?.count" @click="clearViewedSheets">Clear viewed sheets</BaseButton>
                    <span v-if="clearMessage" class="text-sm opacity-70">{{ clearMessage }}</span>
                    <span v-else-if="viewed" class="text-sm opacity-70">
                        {{ viewed.count ? `${sheetCount(viewed.count)}, about ${formatBytes(viewed.bytes)}` : "Nothing to clear" }}
                    </span>
                </div>
            </div>
            <template #footer>
                <div class="ml-auto flex">
                    <BaseButton @click="show = false" class="mr-2">Cancel</BaseButton>
                    <BaseButton type="error" @click="logout">Logout</BaseButton>
                </div>
            </template>
        </Modal>
    </div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { CogIcon } from "@heroicons/vue/outline"
import Modal from './Modal.vue';
import BaseSelect from './BaseSelect.vue';
import InstrumentSelector from './InstrumentSelector.vue';
import BaseButton from './BaseButton.vue';
import auth from "../services/auth"
import { clearUnpinnedSheets, measureSheets, SheetCacheSize } from "../services/offline/cachingClient"
import { formatBytes } from "../utils/format"

const show = ref(false)

const props = defineProps<{ 
    transposition: string | null
    theme: "dark" | "light" | null
    clef: "treble" | "bass" | "alto"
}>()

const emit = defineEmits<{
    (e: "update:transposition", t: string | null): any
    (e: "update:theme", t: "dark" | "light" | null): any
    (e: "update:clef", c: "treble" | "bass" | "alto"): any
}>()

const selectedTransposition = computed({
    get() {
        return props.transposition
    },
    set(v) {
        emit("update:transposition", v)
    }
})

const selectedTheme = computed({
    get() {
        return props.theme
    },
    set(v) {
        emit("update:theme", v)
    }
})

const selectedClef = computed({
    get() {
        return props.clef
    },
    set(v) {
        emit("update:clef", (v ?? "treble") as "treble" | "bass" | "alto")
    }
})

const logout = auth.logout

const clearing = ref(false)
const clearMessage = ref("")
const viewed = ref(null as SheetCacheSize | null)

const measure = async () => (viewed.value = await measureSheets(false))

watch(show, (open) => {
    clearMessage.value = ""
    if (open) measure()
})

const sheetCount = (count: number) => (count === 1 ? "1 sheet" : `${count} sheets`)

const clearViewedSheets = async () => {
    clearing.value = true
    try {
        const { count, bytes } = await clearUnpinnedSheets()
        clearMessage.value = `Cleared ${sheetCount(count)}` + (count ? ` (about ${formatBytes(bytes)} freed).` : ".")
        await measure()
    } finally {
        clearing.value = false
    }
}
</script>