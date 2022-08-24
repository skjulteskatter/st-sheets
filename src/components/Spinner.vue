<script lang="ts" setup></script>

<template>
    <div
        class="spinner w-8 aspect-square grid animate-spin before:rotate-45"
    ></div>
</template>

<style>
.spinner {
    mask: conic-gradient(from 22deg, #0001, #000);
}

.spinner,
.spinner:before {
    --gradient: linear-gradient(currentColor 0 0);
    background: var(--gradient) 50%/34% 8% space no-repeat,
        var(--gradient) 50%/8% 34% no-repeat space;
}
</style>
