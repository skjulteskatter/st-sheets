<template>
    <div>
        <Modal
            title="Settings"
            v-model:show="show"
        >
            <template #button>
                <button @click="show = !show" type="button" class="bg-gray-50 rounded-full border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                    <CogIcon class="w-8 h-8"></CogIcon>
                    <span class="sr-only">Settings</span>
                </button>
            </template>
            <TranspositionSelector
                class="ml-2 max-w-sm"
                :transposition="transposition"
                @update:transposition="t => $emit('update:transposition', t)"
                v-model:transposition="transposition"
            ></TranspositionSelector>
        </Modal>
    </div>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import { CogIcon } from "@heroicons/vue/solid"
import Modal from './Modal.vue';
import TranspositionSelector from './TranspositionSelector.vue';

const show = ref(false)

defineProps<{ 
    transposition: string | null
}>()

defineEmits<{
    (e: "update:transposition", t: string | null): any
}>()
</script>