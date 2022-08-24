<template>
    <div
        class="font-sans min-h-screen w-screen bg-white dark:bg-gray-900 dark:text-white"
        v-if="ready"
    >
        <Loader v-if="authenticated">
            <Sheets />
        </Loader>
        <Login v-else :login="auth.login" />
    </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import auth from "./services/auth";
import Sheets from "./views/Sheets.vue";
import Login from "./views/Login.vue";
import Loader from "./components/Loader.vue";

const authenticated = ref(auth.authenticated);
const ready = ref(false);

auth.onStateUpdate(() => {
    ready.value = true;
    authenticated.value = auth.authenticated;
});

if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
}
</script>
