<script setup lang="ts">
withDefaults(defineProps<{ items: Array<Record<string, unknown>>; itemKey?: string; emptyMessage?: string }>(), { itemKey: 'id', emptyMessage: 'No hay datos para mostrar.' })
</script>

<template>
  <div class="hidden gap-2.5 max-[759px]:grid">
    <p v-if="items.length === 0" class="m-0 rounded-[9px] border border-black/10 bg-panel p-4 text-center text-muted">{{ emptyMessage }}</p>
    <PrimeCard v-for="(item, index) in items" v-else :key="String(item[itemKey] ?? index)"><template #content><slot :item="item" :index="index" /></template></PrimeCard>
  </div>
</template>
