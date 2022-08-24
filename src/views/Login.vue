<template>
    <div class="w-screen h-screen">
        <div class="max-w-sm rounded shadow-lg">
            <div>
                <h3>Login</h3>
            </div>

            <BaseButton @click="login" class="m-8 border p-2 text-xl">Submit</BaseButton>
        </div>
    </div>
</template>
<script lang="ts" setup>
import BaseButton from '../components/BaseButton.vue';
defineProps<{
    login: () => any
}>()
</script>
