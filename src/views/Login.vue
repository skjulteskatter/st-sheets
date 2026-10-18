<template>
    <div class="w-screen h-screen grid place-items-center p-4">
        <div class="w-full max-w-sm flex flex-col gap-4">
            <h1 class="text-2xl font-bold">Sign in</h1>

            <div class="grid grid-cols-2 gap-2">
                <BaseButton
                    class="flex items-center justify-center gap-2"
                    :disabled="loading"
                    @click="loginWith('google')"
                >
                    <img src="/img/google.svg" alt="" class="w-4 h-4" />
                    Google
                </BaseButton>
                <BaseButton
                    class="flex items-center justify-center gap-2"
                    :disabled="loading"
                    @click="loginWith('apple')"
                >
                    <img src="/img/apple.svg" alt="" class="w-4 h-4 dark:invert" />
                    Apple
                </BaseButton>
            </div>

            <div class="flex items-center gap-3">
                <div class="flex-1 h-px bg-black/10 dark:bg-white/20"></div>
                <span class="text-xs uppercase opacity-50">or</span>
                <div class="flex-1 h-px bg-black/10 dark:bg-white/20"></div>
            </div>

            <form class="flex flex-col gap-3" @submit.prevent="loginWithEmail">
                <label class="text-sm">
                    Email
                    <input
                        v-model="email"
                        type="email"
                        autocomplete="email"
                        required
                        :class="inputClass"
                    />
                </label>
                <label class="text-sm">
                    Password
                    <input
                        v-model="password"
                        type="password"
                        autocomplete="current-password"
                        required
                        :class="inputClass"
                    />
                </label>
                <BaseButton type="info" :disabled="loading">Sign in with email</BaseButton>
                <button
                    type="button"
                    class="text-sm underline opacity-70 self-start"
                    :disabled="loading"
                    @click="forgotPassword"
                >
                    Forgot password?
                </button>
            </form>

            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
            <p v-if="info" class="text-sm opacity-80">{{ info }}</p>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import BaseButton from "../components/BaseButton.vue";
import auth, { AuthException, Provider } from "../services/auth";

const inputClass =
    "bg-gray-50 border border-gray-300 text-gray-900 text-sm block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white";

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref(null as string | null);
const info = ref(null as string | null);

const run = async (action: () => Promise<void>) => {
    error.value = null;
    info.value = null;
    loading.value = true;
    try {
        await action();
    } catch (e) {
        error.value =
            e instanceof AuthException ? e.message : "Login failed. Please try again.";
    } finally {
        loading.value = false;
    }
};

const loginWith = (provider: Provider) => run(() => auth.login(provider));

const loginWithEmail = () =>
    run(() => auth.loginWithEmail(email.value, password.value));

const forgotPassword = () => {
    if (!email.value.trim()) {
        error.value = "Enter your email first.";
        return;
    }
    return run(async () => {
        await auth.resetPassword(email.value);
        info.value = "If an account exists for this email, a reset link has been sent.";
    });
};
</script>
