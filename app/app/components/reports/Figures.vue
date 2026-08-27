<script setup lang="ts">
import type { MetricsSummary } from '~/utils/metrics'
import { changeTone } from '~/utils/metrics'

const props = defineProps<{ summary: MetricsSummary; loading: boolean }>()

const { formatMoney, formatPercent } = useMoney()

/** El costo de venta no viaja en el contrato: es el ingreso menos la ganancia. */
const costOfSales = computed(() => props.summary.revenue - props.summary.grossProfit)

/** Su peso sobre los ingresos es el complemento exacto del margen bruto. */
const costRatio = computed(() => (props.summary.revenue ? 100 - props.summary.grossMargin : 0))

function changeLabel(value: number, previousLabel: string) {
  if (!value) return `Igual que ${previousLabel || 'el periodo anterior'}`
  return `${value > 0 ? '+' : '−'}${formatPercent(Math.abs(value))} vs ${previousLabel}`
}

const toneClass = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-muted',
} as const
</script>

<template>
  <div
    class="grid grid-cols-4 overflow-hidden rounded-[8px] border border-black/11 bg-panel max-[760px]:grid-cols-2"
    data-testid="report-figures"
  >
    <article class="border-r border-black/8 px-3.75 py-3.25 max-[760px]:border-b">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Ingresos</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1" />
      <strong v-else class="mt-1 block font-display text-[21px] leading-tight tracking-[-.03em]" data-testid="report-revenue">{{ formatMoney(summary.revenue) }}</strong>
      <span class="mt-0.5 block text-[11.5px]" :class="toneClass[changeTone(summary.revenueChange)]">{{ changeLabel(summary.revenueChange, summary.range.previousLabel) }}</span>
    </article>

    <article class="border-r border-black/8 px-3.75 py-3.25 max-[760px]:border-b max-[760px]:border-r-0">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Costo de venta</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1" />
      <strong v-else class="mt-1 block font-display text-[21px] leading-tight tracking-[-.03em]" data-testid="report-cost">− {{ formatMoney(costOfSales) }}</strong>
      <span class="mt-0.5 block text-[11.5px] text-muted">{{ formatPercent(costRatio) }} de los ingresos</span>
    </article>

    <article class="border-r border-black/8 px-3.75 py-3.25">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Gastos</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1" />
      <strong v-else class="mt-1 block font-display text-[21px] leading-tight tracking-[-.03em]" data-testid="report-expenses">− {{ formatMoney(summary.expenses) }}</strong>
      <span class="mt-0.5 block text-[11.5px]" :class="toneClass[changeTone(summary.expenseRatioPp, false)]">{{ formatPercent(summary.expenseRatio) }} de los ingresos</span>
    </article>

    <article class="px-3.75 py-3.25">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Ganancia neta</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1" />
      <strong v-else class="mt-1 block font-display text-[21px] leading-tight tracking-[-.03em]" data-testid="report-net-profit">{{ formatMoney(summary.netProfit) }}</strong>
      <span class="mt-0.5 block text-[11.5px]" :class="toneClass[changeTone(summary.netProfitChange)]">Margen neto {{ formatPercent(summary.netMargin) }} · {{ changeLabel(summary.netProfitChange, summary.range.previousLabel) }}</span>
    </article>
  </div>
</template>
