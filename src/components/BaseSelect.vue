<template>
    <label class="flex flex-col gap-1 text-gray-900 dark:text-white">
        <span>
            <slot name="label">{{ label }}</slot>
        </span>
        <select
            v-model="value"
            class="rounded-md bg-gray-50 border border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
        >
            <slot />
        </select>
    </label>
</template>
<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{
    modelValue: string | null;
    label?: string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", v: string | null): any;
}>();

const value = computed({
    get() {
        return props.modelValue;
    },
    set(v) {
        emit("update:modelValue", v);
    },
});
</script>
