<template>
    <div>
        <label for="instrument-select">Instrument</label>
        <BaseSelect id="instrument-select" v-model="selected" class="max-w-[12rem]">
            <option value="">All</option>
            <option v-for="instrument in instruments" :key="instrument" :value="instrument">
                {{ instrument }}
            </option>
        </BaseSelect>
    </div>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import BaseSelect from "./BaseSelect.vue";

/**
 * Picks which part of a multi-instrument sheet to show: all of them, or one.
 * The value is a list for the render request: empty for all, or the one part.
 */
const props = defineProps<{
    instruments: string[];
    modelValue: string[];
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string[]): void;
}>();

const selected = computed({
    get: () => props.modelValue[0] ?? "",
    set: (v) => emit("update:modelValue", v ? [v] : []),
});
</script>
