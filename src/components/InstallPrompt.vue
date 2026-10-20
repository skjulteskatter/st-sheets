<template>
    <div
        v-if="installOffer"
        class="fixed bottom-4 left-4 z-40 flex max-w-sm flex-col gap-3 rounded-lg border border-black/10 bg-white/90 px-4 py-3 text-sm shadow backdrop-blur dark:border-white/20 dark:bg-gray-800/90"
    >
        <div class="flex items-center gap-3">
            <img src="/icons/manifest-icon-200.png" alt="" class="h-10 w-10 shrink-0" />
            <div>
                <p class="font-medium">Install Sheets</p>
                <p v-if="installOffer === 'prompt'" class="opacity-70">
                    Opens full screen and works offline, like an app.
                </p>
                <p v-else class="opacity-70">
                    Tap <ShareIcon class="inline h-4 w-4 align-text-bottom"></ShareIcon> Share, then
                    <strong>Add to Home Screen</strong>.
                </p>
            </div>
        </div>
        <div class="flex justify-end gap-2">
            <BaseButton @click="dismissInstall">Not now</BaseButton>
            <BaseButton v-if="installOffer === 'prompt'" type="info" @click="install">Install</BaseButton>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { ShareIcon } from "@heroicons/vue/outline";
import BaseButton from "./BaseButton.vue";
import { dismissInstall, install, installOffer } from "../services/install";
</script>
