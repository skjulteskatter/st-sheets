<template>
    <div class="font-sans h-screen w-screen bg-white dark:bg-black dark:text-white" v-if="ready">
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
        <Login v-else :login="auth.login"></Login>
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import auth from "./services/auth";
import Sheets from "./views/Sheets.vue";
import Login from "./views/Login.vue";

const authenticated = ref(auth.authenticated);
const ready = ref(false);

auth.onStateUpdate(() => {
    ready.value = true;
    authenticated.value = auth.authenticated;
});

if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark")
}
</script>
