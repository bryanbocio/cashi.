<script setup lang="ts">
import type { MetricsAlert, MetricsAlertItem } from '~/utils/metrics'
import { alertActionLabel } from '~/utils/metrics'

const props = defineProps<{ alerts: MetricsAlert[]; loading: boolean }>()

const { formatMoney, formatNumber, formatPercent } = useMoney()

const total = computed(() => props.alerts.length)

/** Resumen de cada alerta: los primeros detalles, con el dato que la justifica. */
function itemLabel(alert: MetricsAlert, item: MetricsAlertItem) {
  if (alert.type === 'LOW_STOCK') return `${item.name} (${formatNumber(item.stock)} de ${formatNumber(item.minStock)})`
  if (alert.type === 'OVERDUE_CREDIT') return `${item.name} · ${formatMoney(item.debt)} · ${formatNumber(item.daysOverdue)} ${item.daysOverdue === 1 ? 'día' : 'días'}`
  if (alert.type === 'PENDING_PURCHASE') return `${item.name} · ${item.supplier ?? 'Sin proveedor'}`
  return `${item.name} · ${formatPercent(item.marginPct)}`
}

function subtitle(alert: MetricsAlert) {
  const shown = alert.items.slice(0, 3).map(item => itemLabel(alert, item)).join(', ')
  const rest = alert.count - Math.min(alert.items.length, 3)
  const suffix = rest > 0 ? ` y ${formatNumber(rest)} más` : ''
  if (alert.amount !== null) return `${formatMoney(alert.amount)} en total · ${shown}${suffix}`
  return `${shown}${suffix}`
}
</script>

<template>
  <section class="overflow-hidden rounded-[8px] border border-black/11 bg-panel">
    <div class="flex items-center justify-between gap-3 px-3.5 pt-2.75 pb-2.25">
      <h2 class="m-0 font-display text-[12.5px] font-semibold">Requiere atención</h2>
      <span class="rounded-[9px] bg-ink px-1.5 py-0.5 font-mono text-[10px] font-medium text-paper" data-testid="alert-count">{{ total }}</span>
    </div>

    <div v-if="loading" class="px-3.5 pb-4">
      <PrimeSkeleton v-for="line in 3" :key="line" height=".6875rem" class="mt-3" :width="`${94 - line * 8}%`" />
    </div>

    <template v-else>
      <p v-if="!alerts.length" class="m-0 px-3.5 py-6 text-center text-[11.5px] text-muted" data-testid="alerts-empty">
        Nada pendiente: stock, fiados, compras y márgenes están en orden.
      </p>

      <ul v-else class="m-0 list-none p-0" data-testid="dashboard-alerts">
        <li
          v-for="alert in alerts"
          :key="alert.type"
          class="flex items-start gap-2.5 border-t border-black/7 px-3.5 py-2.25"
          :data-testid="`alert-${alert.type}`"
        >
          <span class="w-0.75 self-stretch rounded-[2px]" :class="alert.severity === 'negative' ? 'bg-negative' : 'bg-[#d9d4c8]'" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <strong class="block text-[12px] font-medium">{{ alert.title }}</strong>
            <span class="block text-[11px] text-muted">{{ subtitle(alert) }}</span>
          </span>
          <NuxtLink
            :to="alert.target"
            class="shrink-0 text-[11px] whitespace-nowrap text-accent no-underline hover:underline max-[760px]:grid max-[760px]:min-h-11 max-[760px]:place-items-center"
            :data-testid="`alert-action-${alert.type}`"
          >
            {{ alertActionLabel(alert.type) }}
          </NuxtLink>
        </li>
      </ul>
    </template>
  </section>
</template>
