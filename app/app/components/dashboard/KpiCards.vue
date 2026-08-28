<script setup lang="ts">
import type { MetricsSummary } from '~/utils/metrics'
import { changeTone } from '~/utils/metrics'

defineProps<{ summary: MetricsSummary; loading: boolean }>()

const { formatMoney, formatNumber, formatPercent } = useMoney()

/** Variación en porcentaje sobre el periodo anterior. */
function changeLabel(value: number, previousLabel: string) {
  if (!value) return `Igual que ${previousLabel || 'el periodo anterior'}`
  // El signo negativo lo pone `Intl`; solo hay que añadir el `+`.
  return `${value > 0 ? '+' : ''}${formatPercent(value)} vs ${previousLabel}`
}

/** Variación de un margen o proporción: se expresa en puntos porcentuales. */
function pointsLabel(value: number, previousLabel: string) {
  if (!value) return `Sin cambio vs ${previousLabel || 'el periodo anterior'}`
  return `${value > 0 ? '+' : ''}${formatNumber(value)} pp vs ${previousLabel}`
}

const toneClass = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-muted',
} as const

const darkToneClass = {
  positive: 'text-[#7fe0cf]',
  negative: 'text-[#f2a780]',
  neutral: 'text-white/60',
} as const
</script>

<template>
  <div class="grid grid-cols-5 gap-2.5 max-[1120px]:grid-cols-3 max-[760px]:grid-cols-2" data-testid="dashboard-kpis">
    <article class="rounded-[8px] border border-black/11 bg-panel px-3 py-2.75">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Ventas</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1.25" />
      <strong v-else class="mt-1.25 block font-display text-[22px] leading-[1.15] tracking-[-.03em]" data-testid="kpi-revenue">{{ formatMoney(summary.revenue) }}</strong>
      <span class="mt-1 block text-[10.5px]" :class="toneClass[changeTone(summary.revenueChange)]">{{ changeLabel(summary.revenueChange, summary.range.previousLabel) }}</span>
    </article>

    <article class="rounded-[8px] border border-black/11 bg-panel px-3 py-2.75">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Ganancia bruta</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1.25" />
      <strong v-else class="mt-1.25 block font-display text-[22px] leading-[1.15] tracking-[-.03em]" data-testid="kpi-gross-profit">{{ formatMoney(summary.grossProfit) }}</strong>
      <span class="mt-1 block text-[10.5px] text-muted">{{ formatPercent(summary.grossMargin) }} de margen · {{ pointsLabel(summary.grossMarginPp, summary.range.previousLabel) }}</span>
    </article>

    <article class="rounded-[8px] border border-black/11 bg-panel px-3 py-2.75">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Gastos</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1.25" />
      <strong v-else class="mt-1.25 block font-display text-[22px] leading-[1.15] tracking-[-.03em]" data-testid="kpi-expenses">{{ formatMoney(summary.expenses) }}</strong>
      <span class="mt-1 block text-[10.5px]" :class="toneClass[changeTone(summary.expenseRatioPp, false)]">{{ formatPercent(summary.expenseRatio) }} de los ingresos</span>
    </article>

    <article class="rounded-[8px] border border-ink bg-ink px-3 py-2.75">
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-white/60 uppercase">Ganancia neta</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1.25" />
      <strong v-else class="mt-1.25 block font-display text-[22px] leading-[1.15] tracking-[-.03em] text-white" data-testid="kpi-net-profit">{{ formatMoney(summary.netProfit) }}</strong>
      <span class="mt-1 block text-[10.5px]" :class="darkToneClass[changeTone(summary.netProfitChange)]">{{ formatPercent(summary.netMargin) }} neto · {{ changeLabel(summary.netProfitChange, summary.range.previousLabel) }}</span>
    </article>

    <NuxtLink
      to="/fiados"
      class="rounded-[8px] border border-black/11 bg-panel px-3 py-2.75 no-underline text-ink transition-colors hover:bg-surface"
      data-testid="kpi-receivable-link"
    >
      <p class="m-0 font-mono text-[9.5px] font-medium tracking-[.06em] text-subtle uppercase">Por cobrar</p>
      <PrimeSkeleton v-if="loading" width="6rem" height="1.5rem" class="mt-1.25" />
      <strong v-else class="mt-1.25 block font-display text-[22px] leading-[1.15] tracking-[-.03em]" data-testid="kpi-receivable">{{ formatMoney(summary.receivable) }}</strong>
      <!-- La cartera es una foto de hoy, no del periodo navegado. -->
      <span class="mt-1 block text-[10.5px] text-muted">{{ formatNumber(summary.debtorsCount) }} {{ summary.debtorsCount === 1 ? 'cliente con deuda' : 'clientes con deuda' }}</span>
    </NuxtLink>
  </div>
</template>
