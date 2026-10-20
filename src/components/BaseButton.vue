<template>
    <button
        class="control inline-flex items-center justify-center px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        :class="typeClass"
    >
        <slot></slot>
    </button>
</template>
<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
    type?: "warning" | "error" | "info" | "default" 
}>()

const typeClass = computed(() => {
    switch (props.type) {
        case "error":
            return "border-red-600 bg-red-500 text-white hover:bg-red-600";
        case "warning":
            return "border-yellow-600 bg-yellow-500 text-gray-900 hover:bg-yellow-400";
        case "info":
            return "border-blue-600 bg-blue-500 text-white hover:bg-blue-600";
        default:
            return "control-default";
    }
})
</script>
