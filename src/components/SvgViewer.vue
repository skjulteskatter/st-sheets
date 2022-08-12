<template>
    <div id="svg-viewer" v-html="svg" :style="loading ? 'display: none;' : ''"></div>
</template>
<script lang="ts" setup>
import { watch, onMounted, ref } from "vue";

const props = defineProps<{
    svg: string;
}>();

const loading = ref(false)

const fixElements = async () => {
    loading.value = true;
    await new Promise(r => setTimeout(r, 10))
    const els = document.getElementById("svg-viewer")?.children;

    if (!els) return;

    for (let i = 0; i < els.length; i++) {
        const el = els.item(i) as HTMLElement;
        el.removeAttribute("width");
        el.removeAttribute("height");
    }
    loading.value = false;
};

onMounted(fixElements);

watch(
    () => props.svg,
    fixElements
);
</script>
