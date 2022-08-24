<template>
    <div>
        <Modal
            title="Settings"
            v-model:show="show"
        >
            <template #button>
                <button @click="show = !show" type="button" class="bg-gray-50 rounded-full border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 p-1 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                    <CogIcon class="w-8 h-8"></CogIcon>
                    <span class="sr-only">Settings</span>
                </button>
            </template>
            <div class="flex">
                <InstrumentSelector
                    class="m-2"
                    v-model:transposition="selectedTransposition"
                ></InstrumentSelector>
                <div class="m-2">
                    <label>Theme</label>
                    <BaseSelect
                        v-model="selectedTheme"
                    >
                        <option value="dark">
                            Dark
                        </option>
                        <option value="light">
                            Light
                        </option>
                    </BaseSelect>
                </div>
            </div>
            <template #footer>
                <div class="ml-auto flex">
                    <BaseButton @click="show = false" class="mr-2">Cancel</BaseButton>
                    <BaseButton type="error" @click="logout">Logout</BaseButton>
                </div>
            </template>
        </Modal>
    </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { CogIcon } from "@heroicons/vue/solid"
import Modal from './Modal.vue';
import BaseSelect from './BaseSelect.vue';
import InstrumentSelector from './InstrumentSelector.vue';
import BaseButton from './BaseButton.vue';
import auth from "../services/auth"

const show = ref(false)

const props = defineProps<{ 
    transposition: string | null
    theme: "dark" | "light" | null
}>()

const emit = defineEmits<{
    (e: "update:transposition", t: string | null): any
    (e: "update:theme", t: "dark" | "light" | null): any
}>()

const selectedTransposition = computed({
    get() {
        return props.transposition
    },
    set(v) {
        emit("update:transposition", v)
    }
})

const selectedTheme = computed({
    get() {
        return props.theme
    },
    set(v) {
        emit("update:theme", v)
    }
})

const logout = auth.logout
</script>