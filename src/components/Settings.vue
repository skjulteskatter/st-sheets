<template>
    <Modal title="Settings" v-model:show="show">
        <template #button>
            <BaseButton type="invisible" @click="show = !show">
                <CogIcon class="w-6 h-6" />
                <span class="sr-only">Settings</span>
            </BaseButton>
        </template>
        <div class="flex gap-4">
            <InstrumentSelector v-model:transposition="selectedTransposition" />
            <BaseSelect label="Theme" v-model="selectedTheme">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
            </BaseSelect>
        </div>
        <template #footer>
            <div class="ml-auto flex gap-2">
                <BaseButton type="error" @click="logout">Logout</BaseButton>
                <BaseButton @click="show = false">Cancel</BaseButton>
            </div>
        </template>
    </Modal>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { CogIcon } from "@heroicons/vue/24/outline";
import Modal from "./Modal.vue";
import BaseSelect from "./BaseSelect.vue";
import InstrumentSelector from "./InstrumentSelector.vue";
import BaseButton from "./BaseButton.vue";
import auth from "../services/auth";

const show = ref(false);

const props = defineProps<{
    transposition: string | null;
    theme: "dark" | "light" | null;
}>();

const emit = defineEmits<{
    (e: "update:transposition", t: string | null): any;
    (e: "update:theme", t: "dark" | "light" | null): any;
}>();

const selectedTransposition = computed({
    get() {
        return props.transposition;
    },
    set(v) {
        emit("update:transposition", v);
    },
});

const selectedTheme = computed({
    get() {
        return props.theme;
    },
    set(v) {
        emit("update:theme", v);
    },
});

const logout = auth.logout;
</script>
