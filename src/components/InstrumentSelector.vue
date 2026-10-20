<template>
    <div>
        <label for="transposition-select"
            >Transposition</label
        >
        <BaseSelect
            id="transposition-select"
            v-model="selectedTransposition"
        >
            <option v-for="t of transpositions" :value="t.key">
                {{ musicalKey(t.display) }}
            </option>
        </BaseSelect>
    </div>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import BaseSelect from "./BaseSelect.vue";
import { transpositions } from "../utils/instruments";
import { musicalKey } from "../services/transposer";

const props = defineProps<{
    transposition: string | null;
    relative?: string | null;
}>();

const emit = defineEmits<{
    (e: "update:transposition", value: string | null): void;
}>();

const selectedTransposition = computed({
    get() {
        return props.transposition
    },
    set(v) {
        emit("update:transposition", v?.toString() ?? null)
    }
})

</script>
