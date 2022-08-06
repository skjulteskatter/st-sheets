<template>
    <div class="font-sans bg-black text-white" v-if="ready">
        <div v-if="authenticated">
            <Suspense>
                <template #default>
                    <Sheets></Sheets>
                </template>
                <template #fallback>
                    <h3 class="text-lg">Loading...</h3>
                </template>
            </Suspense>
        </div>
        <div v-else>
            <button @click="login" class="m-8 border p-2 text-xl">Login</button>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import auth from "./services/auth";
import Sheets from "./views/Sheets.vue";

const authenticated = ref(auth.authenticated);
const ready = ref(false);

auth.onStateUpdate(() => {
    ready.value = true;
    authenticated.value = auth.authenticated;
});

const login = auth.login;
</script>
<style>
:root {
    background-color: black;
}
</style>
