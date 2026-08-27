<script setup lang="ts">
import type { MetricsDay } from '~/utils/metrics'
import { formatChartDate } from '~/utils/metrics'

const props = defineProps<{ days: MetricsDay[]; loading: boolean }>()

const { formatMoney } = useMoney()

/**
 * Ambas barras se escalan contra la venta más alta de la serie, no cada una
 * contra su propio máximo: si la ganancia usara otra escala, una barra verde
 * alta junto a una azul baja daría a entender que se ganó más de lo vendido.
 */
const maxRevenue = computed(() => Math.max(1, ...props.days.map(day => day.revenue)))

function barHeight(value: number) {
  if (value <= 0) return '2%'
  return `${Math.max(2, (value / maxRevenue.value) * 100)}%`
}

function dayLabel(day: MetricsDay) {
  return `${formatChartDate(day.date)}: ${formatMoney(day.revenue)} · gana ${formatMoney(day.grossProfit)}`
}

const hasSales = computed(() => props.days.some(day => day.salesCount > 0))
</script>

<template>
  <section class="rounded-[8px] border border-black/11 bg-panel px-3.5 pt-3 pb-2">
    <div class="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="m-0 font-display text-[12.5px] font-semibold">Venta y ganancia · últimos {{ days.length || 14 }} días</h2>
      <div class="flex gap-3 text-[10.5px] text-muted">
        <span><span class="mr-1 inline-block size-2 rounded-[2px] bg-accent" aria-hidden="true" />Venta</span>
        <span><span class="mr-1 inline-block size-2 rounded-[2px] bg-positive" aria-hidden="true" />Ganancia</span>
      </div>
    </div>

    <PrimeSkeleton v-if="loading" height="8.5rem" />

    <template v-else>
      <p v-if="!hasSales" class="m-0 grid h-34 place-items-center text-center text-[11.5px] text-muted" data-testid="dashboard-chart-empty">
        Todavía no hay ventas confirmadas en estos días.
      </p>
      <div v-else class="flex h-34 items-end gap-1.75 max-[760px]:gap-1" role="list" aria-label="Venta y ganancia por día" data-testid="dashboard-chart">
        <div
          v-for="day in days"
          :key="day.date"
          class="flex h-full flex-1 items-end gap-0.5"
          role="listitem"
          :title="dayLabel(day)"
          :aria-label="dayLabel(day)"
          :data-testid="`chart-day-${day.date}`"
        >
          <div class="flex-1 rounded-t-[2px] bg-accent" :style="{ height: barHeight(day.revenue) }" />
          <div class="flex-1 rounded-t-[2px] bg-positive" :style="{ height: barHeight(day.grossProfit) }" />
        </div>
      </div>

      <div v-if="days.length" class="flex justify-between pt-1.5 font-mono text-[10px] text-subtle">
        <span>{{ formatChartDate(days[0]!.date) }}</span>
        <span>{{ formatChartDate(days[days.length - 1]!.date) }}</span>
      </div>
    </template>
  </section>
</template>
