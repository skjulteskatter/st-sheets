<template>
    <select
        v-model="value"
        class="control control-default block w-full px-2.5"
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
