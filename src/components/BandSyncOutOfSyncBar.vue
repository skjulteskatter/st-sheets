<template>
    <div
        v-if="show"
        class="flex flex-wrap items-center justify-between fixed bottom-4 right-4 z-40 gap-3 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm backdrop-blur"
    >
        <p class="font-medium">Out of sync</p>
        <BaseButton @click="resyncBandSyncToLeader">Resync</BaseButton>
    </div>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import BaseButton from "./BaseButton.vue";
import { bandSyncState } from "../services/bandSync/bandSyncStore";
import { resyncBandSyncToLeader } from "../services/bandSync/bandSyncCoordinator";

const show = computed(
    () =>
        bandSyncState.role === "member" &&
        bandSyncState.code != null &&
        (!bandSyncState.followingLeaderUpdates ||
            bandSyncState.syncStatus === "outOfSync"),
);
</script>
