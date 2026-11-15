<template>
    <div>
        <Modal title="Display" v-model:show="show">
            <template #button>
                <button
                    @click="show = !show"
                    type="button"
                    class="icon-button"
                    title="Display"
                >
                    <EyeIcon class="w-5 h-5 shrink-0"></EyeIcon>
                    <span class="sr-only">Display</span>
                </button>
            </template>
            <div class="flex flex-wrap">
                <div class="m-2">
                    <label class="flex items-center gap-2">
                        <input
                            v-model="display.chords"
                            type="checkbox"
                            class="w-5 h-5 accent-blue-600"
                        />
                        Chord staff
                    </label>
                    <p class="text-xs opacity-60 mt-1 max-w-[16rem]">
                        A second staff under each line with the chords as block
                        notes.
                    </p>
                </div>
                <div class="m-2">
                    <label class="flex items-center gap-2">
                        <input
                            v-model="display.voice"
                            type="checkbox"
                            class="w-5 h-5 accent-blue-600"
                        />
                        Harmony
                    </label>
                    <p class="text-xs opacity-60 mt-1 max-w-[16rem]">
                        A third below the melody, adjusted to fit the chords.
                    </p>
                </div>
                <div class="m-2">
                    <label>Harmony color</label>
                    <div class="flex items-center gap-2">
                        <input
                            v-model="display.voiceColor"
                            type="color"
                            class="control control-default w-[60px] cursor-pointer p-1"
                            :disabled="!display.voice"
                        />
                        <BaseButton
                            :disabled="
                                !display.voice ||
                                display.voiceColor === DEFAULT_VOICE_COLOR
                            "
                            @click="display.voiceColor = DEFAULT_VOICE_COLOR"
                        >
                            Reset
                        </BaseButton>
                    </div>
                </div>
            </div>
        </Modal>
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import { EyeIcon } from "@heroicons/vue/outline";
import Modal from "./Modal.vue";
import BaseButton from "./BaseButton.vue";
import { DEFAULT_VOICE_COLOR, display } from "../services/sheetDisplay";

const show = ref(false);
</script>
