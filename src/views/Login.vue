<template>
    <div>
        <button @click="login" class="m-8 border p-2 text-xl">Login</button>
    </div>
</template>
<script lang="ts" setup>
defineProps<{
    login: () => any
}>()
</script>
