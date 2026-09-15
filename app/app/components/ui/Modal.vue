<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
withDefaults(defineProps<{ title: string; width?: string }>(), { width: 'min(520px, calc(100vw - 32px))' })
</script>

<template>
  <PrimeDialog v-model:visible="model" modal :header="title" :style="{ width }" :dismissable-mask="true">
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </PrimeDialog>
</template>
