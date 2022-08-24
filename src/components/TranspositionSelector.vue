<template>
    <BaseSelect label="Transposition" v-model="selectedTransposition">
        <option
            v-for="t of transposer.getRelativeTranspositions(
                original ?? 'C',
                relative,
                true
            )"
            :value="t.value.toString()"
        >
            {{ t.view }}
        </option>
    </BaseSelect>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import BaseSelect from "./BaseSelect.vue";
import { transposer } from "../services/transposer";

const props = defineProps<{
    transposition: string | null;
    original?: string | null;
    relative: number;
}>();

const emit = defineEmits<{
    (e: "update:transposition", value: string | null): void;
}>();

const selectedTransposition = computed({
    get() {
        return props.transposition;
    },
    set(v) {
        emit("update:transposition", v?.toString() ?? null);
    },
});
</script>
