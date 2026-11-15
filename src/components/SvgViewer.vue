<template>
    <div id="svg-viewer" ref="root" v-html="svg" :style="loading ? 'display: none;' : ''"></div>
</template>
<script lang="ts" setup>
import { watch, onMounted, ref, nextTick } from "vue";
import { display } from "../services/sheetDisplay";
import { enhancePage, newOverlayState } from "../services/sheetOverlay";

const props = defineProps<{
    svg: string;
}>();

const loading = ref(false)
const root = ref(null as HTMLElement | null)

// Only the latest enhancement may draw: a new sheet or another option cancels the one running
let enhanceGeneration = 0;

/**
 * Adds what is chosen in the Display menu (chord staff, second voice) to the pages. A page can
 * only be measured while it is shown, so this waits for that and tries again for a moment.
 */
const enhance = async () => {
    const generation = ++enhanceGeneration;
    const options = { chords: display.chords, voice: display.voice, voiceColor: display.voiceColor };
    if (!options.chords && !options.voice) return;
    await nextTick();
    const el = root.value;
    if (!el) return;
    const state = newOverlayState();
    const pages = Array.from(el.children).filter((c): c is SVGSVGElement => c.tagName.toLowerCase() === "svg");
    for (const page of pages) {
        for (let tries = 0; tries < 30; tries++) {
            if (generation !== enhanceGeneration) return;
            try {
                if (enhancePage(page, options, state)) break;
            } catch (e) {
                console.error(e);
                break;
            }
            await new Promise((r) => requestAnimationFrame(r));
        }
    }
};

const fixElements = async () => {
    loading.value = true;
    await new Promise(r => setTimeout(r, 10))
    const els = root.value?.children;

    if (!els) return;

    for (let i = 0; i < els.length; i++) {
        const el = els.item(i) as HTMLElement;
        el.removeAttribute("width");
        el.removeAttribute("height");
    }
    loading.value = false;
    await enhance();
};

onMounted(fixElements);

watch(
    () => props.svg,
    fixElements
);

// Another option: draw the pages again from the original, so nothing from before is left
watch(
    () => [display.chords, display.voice, display.voiceColor],
    () => {
        enhanceGeneration++;
        if (root.value) root.value.innerHTML = props.svg;
        fixElements();
    }
);
</script>
