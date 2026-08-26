<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ drawerId?: string }>()
</script>

<template>
  <PrimeDrawer v-model:visible="model" position="left" :modal="true" :dismissable="true" :block-scroll="true" :pt="{ root: { id: drawerId, class: '!w-[min(84vw,310px)]' }, content: { class: '!p-0' }, header: { class: '!absolute !right-2 !top-2 !z-10 !border-0 !bg-transparent' } }">
    <slot />
  </PrimeDrawer>
</template>
