<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <header class="mb-6">
    <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Cuenta Cashi</p>
    <h1 class="mb-2 font-display text-[26px] font-bold tracking-[-.035em]">{{ title }}</h1>
    <p class="text-[13px] leading-5 text-muted">{{ description }}</p>
  </header>
</template>
