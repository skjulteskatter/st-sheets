<template>
    <Modal title="Band sync" :show="show" @update:show="(v) => (v ? open() : close())">
        <template #button>
            <button
                type="button"
                class="relative flex items-center justify-center shrink-0 w-[42px] h-[42px] bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                :title="statusLabel ?? 'Band sync'"
                @click="show ? close() : open()"
            >
                <UserGroupIcon class="w-5 h-5 shrink-0"></UserGroupIcon>
                <span
                    v-if="indicatorColor"
                    class="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-700"
                    :class="indicatorColor"
                ></span>
                <span class="sr-only">Band sync</span>
            </button>
        </template>

        <div class="flex flex-col gap-4 max-w-md ml-auto mr-auto">
            <template v-if="isActive">
                <div class="rounded-xl bg-black/5 dark:bg-white/10 p-5 text-center">
                    <p class="font-semibold text-base mb-4">{{ statusLabel }}</p>
                    <p v-if="state.role === 'leader'" class="text-sm opacity-70 mb-4">
                        Share this code with your band members
                    </p>
                    <p class="text-4xl font-bold tracking-widest font-mono mb-4">
                        {{ state.code }}
                    </p>
                    <div v-if="sessionExpiry" class="text-sm opacity-70 mb-4">
                        <p :class="{ 'text-amber-600 dark:text-amber-400': sessionExpiry.isUrgent }">
                            Expires {{ sessionExpiry.relative }}
                        </p>
                        <p class="text-xs opacity-60 mt-1">{{ sessionExpiry.absolute }}</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <BaseButton v-if="state.role === 'leader'" @click="copyCode">
                            Copy code
                        </BaseButton>
                        <BaseButton
                            v-if="state.role === 'leader'"
                            :disabled="state.isProcessing"
                            @click="renewSession"
                        >
                            Renew session
                        </BaseButton>
                        <p v-if="state.role === 'leader'" class="text-xs opacity-60">
                            Sessions expire after {{ SESSION_TTL_DAYS }} days without renewal.
                        </p>
                        <BaseButton
                            v-if="canTakeLead"
                            :disabled="state.isProcessing"
                            @click="takeLead"
                        >
                            Take the lead
                        </BaseButton>
                        <BaseButton v-if="showResync" @click="resyncBandSyncToLeader">
                            Resync
                        </BaseButton>
                    </div>
                </div>
            </template>

            <template v-else>
                <p class="text-sm leading-relaxed opacity-80">
                    Start a session to lead your band, or join one with a code.
                    Members follow the leader's song and key.
                </p>

                <BaseButton
                    v-if="startContext"
                    type="info"
                    :disabled="state.isProcessing"
                    @click="startSession"
                >
                    Start session
                </BaseButton>
                <div v-else class="rounded-xl border border-blue-500/30 bg-black/5 dark:bg-white/10 p-4">
                    <p class="font-semibold text-sm mb-1">Start session</p>
                    <p class="text-sm opacity-70">Select a song to start a session.</p>
                </div>

                <div class="flex items-center gap-3 my-2">
                    <div class="flex-1 h-px bg-black/10 dark:bg-white/20"></div>
                    <span class="text-xs uppercase opacity-50">or</span>
                    <div class="flex-1 h-px bg-black/10 dark:bg-white/20"></div>
                </div>

                <label class="text-sm">
                    Enter code
                    <input
                        v-model="codeInput"
                        class="uppercase bg-gray-50 border border-gray-300 text-gray-900 text-sm block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        @keyup.enter="joinSession"
                    />
                </label>
                <BaseButton
                    :disabled="state.isProcessing || !codeInput.trim()"
                    @click="joinSession"
                >
                    Join session
                </BaseButton>
            </template>

            <p v-if="state.isProcessing" class="text-sm text-center opacity-70">Loading...</p>
            <p v-if="state.errorMessage" class="text-sm text-red-500 text-center">
                {{ state.errorMessage }}
            </p>
            <p v-if="loginError" class="text-sm text-red-500 text-center">
                {{ loginError }}
            </p>
        </div>

        <template #footer>
            <div class="ml-auto flex gap-2">
                <BaseButton v-if="isActive" type="error" @click="leave">
                    {{ state.role === "leader" ? "End session" : "Leave" }}
                </BaseButton>
                <BaseButton @click="close">{{ isActive ? "Done" : "Close" }}</BaseButton>
            </div>
        </template>
    </Modal>
</template>
<script lang="ts" setup>
import { computed, onUnmounted, ref } from "vue";
import { UserGroupIcon } from "@heroicons/vue/solid";
import Modal from "./Modal.vue";
import BaseButton from "./BaseButton.vue";
import { firebaseAuth } from "../services/auth";
import {
    bandSyncState as state,
    cancelStart,
    createSession,
    isBandSyncActive,
    joinSession as join,
    leaveSession,
    renewSession,
    takeLead,
} from "../services/bandSync/bandSyncStore";
import { resyncBandSyncToLeader } from "../services/bandSync/bandSyncCoordinator";
import {
    formatSessionExpiry,
    SESSION_TTL_DAYS,
} from "../services/bandSync/bandSyncSession";

export type BandSyncStartContext = {
    songbookId: string;
    songNumber: number;
    transposition: number;
};

const props = defineProps<{
    startContext: BandSyncStartContext | null;
}>();

const show = ref(false);
const codeInput = ref("");
const loginError = ref(null as string | null);
const expiryNow = ref(new Date());
let expiryIntervalId: ReturnType<typeof setInterval> | null = null;

const isActive = computed(() => isBandSyncActive());

const statusLabel = computed(() => {
    if (!isActive.value) return null;
    if (state.role === "leader") return "You are leading";
    if (!state.followingLeaderUpdates || state.syncStatus === "outOfSync") {
        return "Out of sync";
    }
    return "Following leader";
});

const indicatorColor = computed(() => {
    if (!isActive.value) return null;
    if (state.role === "leader") return "bg-blue-500";
    if (!state.followingLeaderUpdates || state.syncStatus === "outOfSync") {
        return "bg-red-500";
    }
    return "bg-green-500";
});

const canTakeLead = computed(
    () =>
        state.role === "member" &&
        state.session != null &&
        firebaseAuth.currentUser?.uid === state.session.leaderId,
);

const showResync = computed(
    () => state.role === "member" && !state.followingLeaderUpdates,
);

const sessionExpiry = computed(() => {
    if (!state.session?.expireAt) return null;
    return formatSessionExpiry(
        state.session.expireAt,
        navigator.language || "en",
        expiryNow.value,
    );
});

const startExpiryTimer = () => {
    expiryNow.value = new Date();
    if (expiryIntervalId != null) return;
    expiryIntervalId = setInterval(() => {
        expiryNow.value = new Date();
    }, 60_000);
};

const stopExpiryTimer = () => {
    if (expiryIntervalId != null) {
        clearInterval(expiryIntervalId);
        expiryIntervalId = null;
    }
};

const open = () => {
    show.value = true;
    startExpiryTimer();
};

const close = () => {
    cancelStart();
    stopExpiryTimer();
    show.value = false;
};

const startSession = () => {
    loginError.value = null;
    if (!firebaseAuth.currentUser) {
        loginError.value = "You must be logged in to start a session.";
        return;
    }
    const ctx = props.startContext;
    if (!ctx) return;
    void createSession(ctx);
};

const joinSession = () => {
    const code = codeInput.value.trim();
    if (!code) return;
    void join(code);
};

const leave = async () => {
    await leaveSession();
    close();
};

const copyCode = () => {
    if (state.code) {
        void navigator.clipboard.writeText(state.code).catch(() => undefined);
    }
};

onUnmounted(() => {
    stopExpiryTimer();
    cancelStart();
});
</script>
