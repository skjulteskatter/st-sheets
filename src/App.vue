<template>
    <div class="font-sans min-h-screen w-full bg-white dark:bg-black dark:text-white" v-if="ready">
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
        <Login v-else></Login>
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import auth from "./services/auth";
// Applies the saved (or device) theme on load, also on the login page
import "./services/themes";
import Sheets from "./views/Sheets.vue";
import Login from "./views/Login.vue";

const authenticated = ref(auth.authenticated);
const ready = ref(false);

auth.onStateUpdate(() => {
    ready.value = true;
    authenticated.value = auth.authenticated;
});
</script>
