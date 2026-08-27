<script setup lang="ts">
import type { RecentSale } from '~/utils/metrics'
import { SALE_METHOD_LABELS, formatSaleTime } from '~/utils/metrics'

defineProps<{ sales: RecentSale[]; timezone: string; loading: boolean }>()
const emit = defineEmits<{ open: [sale: RecentSale] }>()

const { formatMoney } = useMoney()

/**
 * `v_sale_detail` no expone el nombre del primer producto, así que la columna
 * de detalle se arma con lo que sí identifica la venta: su código, el cliente
 * y cuántos artículos salieron.
 */
function detailLabel(sale: RecentSale) {
  const items = `${sale.items} ${sale.items === 1 ? 'artículo' : 'artículos'}`
  return sale.customerName ? `${items} · ${sale.customerName}` : items
}
</script>

<template>
  <section class="overflow-hidden rounded-[8px] border border-black/11 bg-panel">
    <div class="flex items-center justify-between gap-3 px-3.5 pt-2.75 pb-2.25">
      <h2 class="m-0 font-display text-[12.5px] font-semibold">Últimas ventas</h2>
      <NuxtLink to="/reportes" class="text-[11px] text-accent no-underline hover:underline max-[760px]:grid max-[760px]:min-h-11 max-[760px]:place-items-center">Ver todas</NuxtLink>
    </div>

    <div v-if="loading" class="px-3.5 pb-4">
      <PrimeSkeleton v-for="line in 4" :key="line" height=".6875rem" class="mt-3" :width="`${94 - line * 8}%`" />
    </div>

    <template v-else>
      <p v-if="!sales.length" class="m-0 px-3.5 py-6 text-center text-[11.5px] text-muted" data-testid="recent-sales-empty">
        Este negocio todavía no tiene ventas confirmadas.
      </p>

      <template v-else>
        <div class="grid grid-cols-[50px_minmax(0,1fr)_86px_70px] border-y border-black/8 px-3.5 py-1.25 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase max-[400px]:grid-cols-[46px_minmax(0,1fr)_74px]">
          <span>Hora</span>
          <span>Detalle</span>
          <span class="text-right">Total</span>
          <span class="text-right max-[400px]:hidden">Gan.</span>
        </div>
        <ul class="m-0 list-none p-0" data-testid="recent-sales">
          <li v-for="sale in sales" :key="sale.id" class="border-b border-black/5">
            <button
              type="button"
              class="grid w-full cursor-pointer grid-cols-[50px_minmax(0,1fr)_86px_70px] items-center gap-x-1 border-0 bg-transparent px-3.5 py-2 text-left text-[12px] text-ink transition-colors hover:bg-surface max-[760px]:min-h-11 max-[400px]:grid-cols-[46px_minmax(0,1fr)_74px]"
              :data-testid="`recent-sale-${sale.code}`"
              @click="emit('open', sale)"
            >
              <span class="font-mono text-subtle">{{ formatSaleTime(sale.soldAt, timezone) }}</span>
              <span class="min-w-0">
                <span class="block truncate font-mono text-[11.5px]">{{ sale.code }}</span>
                <span class="block truncate text-[10.5px] text-subtle">
                  {{ detailLabel(sale) }}<template v-if="sale.paymentMethod !== 'CASH'"> · {{ SALE_METHOD_LABELS[sale.paymentMethod].toLowerCase() }}</template>
                </span>
              </span>
              <span class="text-right font-mono">{{ formatMoney(sale.total) }}</span>
              <span class="text-right font-mono text-positive max-[400px]:hidden">{{ formatMoney(sale.grossProfit) }}</span>
            </button>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>
