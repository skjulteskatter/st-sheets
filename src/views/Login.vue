<template>
    <div class="w-screen h-screen">
        <div class="max-w-sm mx-auto rounded shadow-lg">
            <h3>Login</h3>
            <BaseButton @click="login" class="m-8 border p-2 text-xl"
                >Submit</BaseButton
            >
        </div>
    </div>
</template>
<script lang="ts" setup>
import BaseButton from "../components/BaseButton.vue";
defineProps<{
    login: () => any;
}>();
</script>
