<template>
    <div>
        <label for="collection-id-select" class="dark:text-white"
            >Collection</label
        >
        <BaseSelect
            id="collection-id-select"
            v-model="selectedCollection"
            placeholder="Collection..."
        >
            <option v-for="col in collections" :value="col.id">
                {{ col.title }}
            </option>
        </BaseSelect>
    </div>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import { collectionService } from "../services/hiddentreasures";
import BaseSelect from "./BaseSelect.vue";

const collections = (await collectionService.list()).filter(
    (i) => i.type === "song"
);

const props = defineProps<{
    collection: string | null;
}>();

const emit = defineEmits<{
    (e: "update:collection", value: string | null): void;
}>();

const selectedCollection = computed({
    get() {
        return props.collection
    },
    set(v) {
        emit("update:collection", v)
    }
})
</script>
