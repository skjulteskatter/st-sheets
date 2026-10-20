<template>
    <div>
        <slot name="button" @click="emit('update:show', !show)">
            <button
                class="control control-default block w-full truncate px-2.5 text-left"
                type="button"
                @click="emit('update:show', !show)"
            >
                {{ title }}
            </button>
        </slot>
        <div
            v-if="show"
            class="fixed inset-0 z-50 overflow-y-auto bg-black/50"
            @click.self="close"
        >
            <!-- Covers the screen on every size: the panel gets the full width (up to max-w-2xl), centred -->
            <div class="p-4" @click.self="close">
                <div class="bg-white w-full max-w-2xl ml-auto mr-auto rounded-lg shadow dark:bg-slate-800">
                    <div
                        class="flex justify-between items-start p-4 rounded-t border-b dark:border-gray-600"
                    >
                        <h3
                            class="text-xl font-semibold text-gray-900 dark:text-white"
                        >
                            {{ title }}
                        </h3>
                        <button
                            type="button"
                            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
                            @click="close"
                        >
                            <svg
                                class="w-5 h-5"
                                viewBox="0 0 20 20"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                ></path>
                            </svg>
                            <span class="sr-only">Close modal</span>
                        </button>
                    </div>
                    <div class="m-4">
                        <slot></slot>
                    </div>
                    <div
                        class="flex items-center p-6 space-x-2 rounded-b border-t border-gray-200 dark:border-gray-600"
                    >
                        <slot name="footer">
                            <BaseButton
                                @click="close"
                                class="ml-auto"
                            >
                                Close
                            </BaseButton>
                        </slot>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
import BaseButton from "./BaseButton.vue";
defineProps<{
    title?: string;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: "update:show", v: boolean): void;
}>();

const close = () => {
    emit("update:show", false);
};
</script>
