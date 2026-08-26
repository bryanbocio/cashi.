<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
withDefaults(defineProps<{
  drawerId?: string
  position?: 'left' | 'right'
  panelClass?: string
  header?: string
}>(), {
  drawerId: undefined,
  position: 'left',
  panelClass: '!w-[min(84vw,310px)]',
  header: undefined,
})
</script>

<template>
  <PrimeDrawer
    v-model:visible="model"
    :position="position"
    :header="header"
    :modal="true"
    :dismissable="true"
    :block-scroll="true"
    :pt="{
      root: { id: drawerId, class: panelClass },
      content: { class: header ? '' : '!p-0' },
      header: { class: header ? '' : '!absolute !right-2 !top-2 !z-10 !border-0 !bg-transparent' },
    }"
  >
    <slot />
  </PrimeDrawer>
</template>
