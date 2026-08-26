<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description: string }>()

const businessStore = useBusinessStore()
const activeBusinessName = computed(() => businessStore.activeBusiness?.name ?? 'Sin negocio activo')
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">{{ eyebrow ?? 'Cashi' }}</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">{{ title }}</h1>
      <p class="max-w-155 text-[13.5px] text-muted">{{ description }}</p>
    </header>

    <div class="mb-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1" aria-label="Estado de construcción de la vista">
      <article class="grid min-h-32 content-between rounded-[9px] border border-ink bg-ink p-4.5 text-white max-[900px]:min-h-28">
        <UiChip tone="accent">Vista preparada</UiChip><strong class="font-display text-[22px] tracking-[-.03em]">—</strong><small class="text-white/65">Los datos reales se conectarán en su tarea correspondiente.</small>
      </article>
      <article class="grid min-h-32 content-between rounded-[9px] border border-black/10 bg-panel p-4.5 max-[900px]:min-h-28">
        <UiChip>Diseño responsive</UiChip><strong class="font-display text-[22px] tracking-[-.03em]">760 px</strong><small class="text-muted">Tabla en escritorio y tarjetas en móvil.</small>
      </article>
      <article class="grid min-h-32 content-between rounded-[9px] border border-black/10 bg-panel p-4.5 max-[900px]:min-h-28">
        <UiChip>Negocio activo</UiChip><strong data-testid="active-business-name" class="font-display text-[22px] tracking-[-.03em]">{{ activeBusinessName }}</strong><small class="text-muted">Los datos de esta vista pertenecen solo a este negocio.</small>
      </article>
    </div>

    <div class="rounded-[9px] border border-black/10 bg-panel p-6">
      <PrimeSkeleton width="11.25rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 5" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 7}%`" />
    </div>
  </section>
</template>
