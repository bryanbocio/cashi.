<script setup lang="ts">
import type { Component } from 'vue'
import IconChevron from '~icons/lucide/chevrons-up-down'
import IconPlus from '~icons/lucide/plus'

defineProps<{ navigation: Array<{ label: string; to: string; icon: Component }> }>()

const businessStore = useBusinessStore()
const activeName = computed(() => businessStore.activeBusiness?.name ?? 'Sin negocio activo')
const activeRole = computed(() => {
  const role = businessStore.activeMembership?.role
  if (!role) return 'Sin selección'
  return {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    CASHIER: 'Cajero',
  }[role]
})
const initials = computed(() => {
  const parts = activeName.value.split(/\s+/).filter(Boolean)
  if (!businessStore.activeBusiness || !parts.length) return '—'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
})
</script>

<template>
  <div class="flex h-full min-h-screen flex-col bg-panel px-3.5 pt-6 pb-3.5">
    <NuxtLink class="mx-2.5 mb-7 self-start font-display text-2xl font-bold tracking-[-.05em]" to="/">cashi<span class="text-accent">.</span></NuxtLink>
    <nav class="grid gap-[3px]">
      <NuxtLink v-for="item in navigation" :key="item.to" class="flex min-h-10 items-center gap-2.5 rounded-[7px] px-2.5 py-2 font-medium text-muted transition-colors hover:bg-surface hover:text-ink min-[0px]:max-[759px]:min-h-11" :to="item.to" active-class="!bg-ink !text-white">
        <component :is="item.icon" class="size-[17px] shrink-0 stroke-[1.8]" aria-hidden="true" /><span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
    <div class="mt-auto border-t border-black/10 pt-4">
      <span class="mx-2 mb-2 block text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Negocio activo</span>
      <button class="grid min-h-12 w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_16px] items-center gap-2 rounded-[7px] border-0 bg-surface p-[7px] text-left" type="button">
        <span class="grid size-8 place-items-center rounded-[7px] bg-ink font-display text-[11px] font-bold text-white">{{ initials }}</span>
        <span class="grid min-w-0"><strong class="truncate text-[11.5px]">{{ activeName }}</strong><small class="truncate text-[9.5px] text-muted">{{ activeRole }}</small></span>
        <IconChevron class="size-3.5" aria-hidden="true" />
      </button>
      <NuxtLink class="mt-1 flex min-h-10 w-full items-center gap-2 px-2 py-2 font-semibold text-accent" to="/onboarding"><IconPlus class="size-3.5" />Crear otro negocio</NuxtLink>
    </div>
  </div>
</template>
