<script setup lang="ts">
import IconDownload from '~icons/lucide/download'
import { SALE_METHOD_LABELS, formatSaleTime } from '~/utils/metrics'
import type { SaleHistoryRow } from '~/utils/reports'
import { formatCalendarDate, instantToBusinessDate } from '~/utils/expenses'

defineProps<{ rows: SaleHistoryRow[]; timezone: string; loading: boolean }>()
const emit = defineEmits<{ open: [sale: SaleHistoryRow]; export: [] }>()

const { formatMoney } = useMoney()

function dateLabel(row: SaleHistoryRow, timezone: string) {
  return `${formatCalendarDate(instantToBusinessDate(row.soldAt, timezone))} ${formatSaleTime(row.soldAt, timezone)}`
}

/** `v_sale_detail` no trae los nombres de las líneas, solo cuántas y cuántos. */
function detailLabel(row: SaleHistoryRow) {
  const items = `${row.items} ${row.items === 1 ? 'artículo' : 'artículos'}`
  if (row.lineCount <= 1) return items
  return `${items} en ${row.lineCount} líneas`
}
</script>

<template>
  <section class="overflow-hidden rounded-[8px] border border-black/11 bg-panel">
    <div class="flex flex-wrap items-center justify-between gap-3 px-3.5 pt-2.75 pb-2.25">
      <h2 class="m-0 font-display text-[12.5px] font-semibold">Historial de ventas del periodo</h2>
      <UiButton variant="secondary" :disabled="loading || !rows.length" data-testid="report-export" @click="emit('export')">
        <IconDownload class="mr-1.5 size-3.5" aria-hidden="true" />Exportar CSV
      </UiButton>
    </div>

    <div v-if="loading" class="px-3.5 pb-4">
      <PrimeSkeleton v-for="line in 5" :key="line" height=".6875rem" class="mt-3" :width="`${94 - line * 7}%`" />
    </div>

    <template v-else>
      <p v-if="!rows.length" class="m-0 px-3.5 py-8 text-center text-[11.5px] text-muted" data-testid="report-history-empty">
        No hay ventas confirmadas en este periodo.
      </p>

      <template v-else>
        <p class="m-0 px-3.5 pb-2 text-[11px] text-muted" aria-live="polite" data-testid="report-history-count">
          {{ rows.length }} {{ rows.length === 1 ? 'venta' : 'ventas' }}
        </p>

        <div class="grid grid-cols-[128px_minmax(0,1fr)_112px_96px_104px_100px] border-y border-black/8 px-3.5 py-1.5 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase max-[1120px]:hidden">
          <span>Fecha</span>
          <span>Detalle</span>
          <span>Cliente</span>
          <span>Pago</span>
          <span class="text-right">Total</span>
          <span class="text-right">Ganancia</span>
        </div>

        <ul class="m-0 list-none p-0" data-testid="report-history">
          <li v-for="row in rows" :key="row.id" class="border-b border-black/5 last:border-b-0">
            <button
              type="button"
              class="grid w-full cursor-pointer grid-cols-[128px_minmax(0,1fr)_112px_96px_104px_100px] items-center gap-x-2 border-0 bg-transparent px-3.5 py-2 text-left text-[12px] text-ink transition-colors hover:bg-surface max-[1120px]:min-h-11 max-[1120px]:grid-cols-1 max-[1120px]:gap-y-1 max-[1120px]:py-2.75"
              :data-testid="`report-sale-${row.code}`"
              @click="emit('open', row)"
            >
              <span class="font-mono text-subtle max-[1120px]:hidden">{{ dateLabel(row, timezone) }}</span>

              <span class="min-w-0 max-[1120px]:flex max-[1120px]:items-baseline max-[1120px]:justify-between max-[1120px]:gap-3">
                <span class="block min-w-0 truncate">
                  <span class="font-mono text-[11.5px]">{{ row.code }}</span>
                  <span class="text-subtle max-[1120px]:hidden"> · {{ detailLabel(row) }}</span>
                </span>
                <span class="hidden font-mono text-[13.5px] font-medium whitespace-nowrap max-[1120px]:block">{{ formatMoney(row.total) }}</span>
              </span>

              <span class="truncate text-muted max-[1120px]:hidden">{{ row.customerName ?? 'Mostrador' }}</span>
              <span class="truncate text-muted max-[1120px]:hidden">{{ SALE_METHOD_LABELS[row.paymentMethod] }}</span>
              <span class="text-right font-mono max-[1120px]:hidden">{{ formatMoney(row.total) }}</span>
              <span class="text-right font-mono text-positive max-[1120px]:hidden">{{ formatMoney(row.grossProfit) }}</span>

              <!-- Bajo 1120 px las seis columnas no caben: la venta se lee como una línea de contexto. -->
              <span class="hidden text-[11.5px] text-subtle max-[1120px]:block">
                {{ dateLabel(row, timezone) }} · {{ detailLabel(row) }} · {{ row.customerName ?? 'Mostrador' }} · {{ SALE_METHOD_LABELS[row.paymentMethod].toLowerCase() }} · gana {{ formatMoney(row.grossProfit) }}
              </span>
            </button>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>
