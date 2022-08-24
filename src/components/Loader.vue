<script lang="ts" setup>
import Spinner from "./Spinner.vue";
</script>

<template>
    <Suspense>
        <template #default>
            <slot name="default" />
        </template>
        <template #fallback>
            <Spinner class="fixed top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
        </template>
    </Suspense>
</template>
