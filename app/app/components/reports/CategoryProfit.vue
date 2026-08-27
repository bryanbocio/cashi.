<script setup lang="ts">
import type { CategoryProfit } from '~/utils/reports'

const props = defineProps<{ categories: CategoryProfit[]; loading: boolean }>()

const { formatMoney, formatPercent } = useMoney()

/**
 * La barra compara contra la categoría más rentable del periodo. Una ganancia
 * negativa no dibuja barra: el número ya lo dice y una barra invertida
 * confundiría la escala.
 */
const maxProfit = computed(() => Math.max(1, ...props.categories.map(item => item.grossProfit)))

function barWidth(profit: number) {
  if (profit <= 0) return '0%'
  return `${Math.max(2, (profit / maxProfit.value) * 100)}%`
}
</script>

<template>
  <section class="rounded-[8px] border border-black/11 bg-panel px-3.5 py-3">
    <h2 class="m-0 mb-2.5 font-display text-[12.5px] font-semibold">Ganancia por categoría</h2>

    <div v-if="loading">
      <PrimeSkeleton v-for="line in 4" :key="line" height=".6875rem" class="mt-3" :width="`${94 - line * 8}%`" />
    </div>

    <template v-else>
      <p v-if="!categories.length" class="m-0 py-6 text-center text-[11.5px] text-muted" data-testid="report-categories-empty">
        No hay ventas confirmadas en este periodo.
      </p>

      <ul v-else class="m-0 grid list-none gap-2.25 p-0" data-testid="report-categories">
        <li v-for="item in categories" :key="item.category" :data-testid="`report-category-${item.category}`">
          <div class="mb-0.75 flex items-baseline justify-between gap-3 text-[11.5px]">
            <span class="min-w-0 truncate">{{ item.category }}</span>
            <span class="shrink-0 font-mono" :class="item.grossProfit < 0 ? 'text-negative' : ''">
              {{ formatMoney(item.grossProfit) }} · {{ formatPercent(item.marginPct) }}
            </span>
          </div>
          <div class="h-1.5 rounded-[3px] bg-surface">
            <div class="h-full rounded-[3px] bg-accent" :style="{ width: barWidth(item.grossProfit) }" />
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
