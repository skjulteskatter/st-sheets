<template>
    <select
        v-model="value"
        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
    >
        <slot></slot>
    </select>
</template>
<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
    modelValue: string | null
}>();

const emit = defineEmits<{
    (e: "update:modelValue", v: string | null): any
}>();

const value = computed({
    get() {
        return props.modelValue
    },
    set(v) {
        emit("update:modelValue", v)
    }
})
</script>
