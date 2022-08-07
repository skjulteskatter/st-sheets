<template>
    <div>
        <label class="text-white" for="transposition-select"
            >Transposition</label
        >
        <BaseSelect
            id="transposition-select"
            :value="transposition"
            @input="(e: InputEvent) => $emit('update:transposition', (e.target as HTMLSelectElement)?.value)"
        >
            <option v-for="t of transpositions" :value="t.key">
                {{ t.display }}
            </option>
        </BaseSelect>
    </div>
</template>
<script lang="ts" setup>
import { defineEmits } from "vue";
import BaseSelect from "./BaseSelect.vue";

const transpositions: {
    key: number;
    display: string;
    alias?: string[];
}[] = [
    {
        key: 4,
        display: "Ab",
        alias: ["G#"],
    },
    {
        key: 3,
        display: "A",
    },
    {
        key: 2,
        display: "Bb",
        alias: ["A#"],
    },
    {
        key: 1,
        display: "B",
    },
    {
        key: 0,
        display: "C",
    },
    {
        key: -1,
        display: "Db",
        alias: ["C#"],
    },
    {
        key: -2,
        display: "D",
    },
    {
        key: 9,
        display: "Eb",
        alias: ["D#"],
    },
    {
        key: 8,
        display: "E",
    },
    {
        key: 7,
        display: "F",
    },
    {
        key: 6,
        display: "F#",
        alias: ["Gb"],
    },
    {
        key: 5,
        display: "G",
    },
];

defineProps<{
    transposition: string | null;
}>();

defineEmits<{
    (e: "update:transposition", value: string | null): void;
}>();
</script>
