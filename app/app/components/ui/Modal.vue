<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ title: string }>()
</script>

<template>
  <PrimeDialog v-model:visible="model" modal :header="title" :style="{ width: 'min(520px, calc(100vw - 32px))' }" :dismissable-mask="true">
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </PrimeDialog>
</template>
