<template>
    <button
        class="focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-md border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:text-gray-300 dark:border-gray-500 hover:opacity-70 dark:hover:text-white dark:focus:ring-gray-600"
        :class="{
            'bg-red-500': red,
            'bg-yellow-500': yellow,
            'bg-blue-500': blue,
            'bg-white dark:bg-gray-700': def,
            'bg-transparent border-none dark:hover:bg-gray-800': invisible,
        }"
    >
        <slot />
    </button>
</template>
<script lang="ts" setup>
import { computed, ref } from "vue";

const props = defineProps<{
    type?: "warning" | "error" | "info" | "default" | "invisible";
}>();

const buttonType = ref(props.type ?? "default");

const red = computed(() => buttonType.value === "error");
const yellow = computed(() => buttonType.value === "warning");
const blue = computed(() => buttonType.value === "info");

const def = computed(() => buttonType.value === "default");
const invisible = computed(() => buttonType.value === "invisible");
</script>
