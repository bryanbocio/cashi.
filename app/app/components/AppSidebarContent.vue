<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ navigation: Array<{ label: string; to: string; icon: Component }> }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex h-full min-h-screen flex-col bg-panel px-3.5 pt-6 pb-3.5">
    <NuxtLink class="mx-2.5 mb-7 self-start font-display text-2xl font-bold tracking-[-.05em]" to="/">cashi<span class="text-accent">.</span></NuxtLink>
    <nav class="grid gap-[3px]">
      <NuxtLink v-for="item in navigation" :key="item.to" class="flex min-h-10 items-center gap-2.5 rounded-[7px] px-2.5 py-2 font-medium text-muted transition-colors hover:bg-surface hover:text-ink min-[0px]:max-[760px]:min-h-11" :to="item.to" active-class="!bg-ink !text-white">
        <component :is="item.icon" class="size-[17px] shrink-0 stroke-[1.8]" aria-hidden="true" /><span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
    <div class="mt-auto border-t border-black/10 pt-4">
      <span class="mx-2 mb-2 block text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Negocio activo</span>
      <BusinessSwitcher @action="emit('action')" />
    </div>
  </div>
</template>
