<script setup lang="ts">
import type { MetricsProduct } from '~/utils/metrics'
import { marginTone } from '~/utils/metrics'

defineProps<{ products: MetricsProduct[]; periodLabel: string; loading: boolean }>()

const { formatMoney, formatPercent } = useMoney()

const toneClass = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-muted',
} as const
</script>

<template>
  <section class="rounded-[8px] border border-black/11 bg-panel pt-3 pb-2">
    <h2 class="m-0 px-3.5 pb-2.25 font-display text-[12.5px] font-semibold">
      Rentabilidad por producto<span v-if="periodLabel"> · <span class="capitalize" data-testid="top-products-period">{{ periodLabel }}</span></span>
    </h2>

    <div v-if="loading" class="px-3.5 py-2">
      <PrimeSkeleton v-for="line in 4" :key="line" height=".6875rem" class="mt-3" :width="`${94 - line * 8}%`" />
    </div>

    <template v-else>
      <p v-if="!products.length" class="m-0 px-3.5 py-6 text-center text-[11.5px] text-muted" data-testid="top-products-empty">
        No hay ventas confirmadas en este periodo.
      </p>

      <template v-else>
        <div class="flex justify-between border-b border-black/8 px-3.5 py-1.5 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase">
          <span>Producto</span>
          <span>Ganancia · margen</span>
        </div>
        <ol class="m-0 list-none p-0" data-testid="top-products">
          <li
            v-for="product in products"
            :key="product.key"
            class="flex items-center justify-between gap-3 border-b border-black/5 px-3.5 py-1.75"
            :data-testid="`top-product-${product.key}`"
          >
            <span class="min-w-0">
              <span class="block truncate text-[12px]">{{ product.name }}</span>
              <!-- El producto borrado conserva su nombre congelado pero ya no tiene SKU. -->
              <span class="block truncate text-[10px] text-subtle">{{ product.sku ?? 'Producto eliminado' }} · {{ product.qty }} {{ product.qty === 1 ? 'unidad' : 'unidades' }}</span>
            </span>
            <span class="shrink-0 text-right font-mono text-[12px] font-medium" :class="toneClass[marginTone(product.marginPct)]">
              {{ formatMoney(product.grossProfit) }} · {{ formatPercent(product.marginPct) }}
            </span>
          </li>
        </ol>
      </template>
    </template>
  </section>
</template>
