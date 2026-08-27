<script setup lang="ts">
import type { MetricsProduct } from '~/utils/metrics'

const props = defineProps<{ products: MetricsProduct[]; loading: boolean }>()

const { formatMoney, formatPercent } = useMoney()

// `metrics_products` ya viene ordenado por ganancia descendente.
const best = computed(() => props.products[0] ?? null)

/** Con un solo producto vendido no hay «peor»: sería el mismo. */
const worst = computed(() => (props.products.length > 1 ? props.products[props.products.length - 1] ?? null : null))

function detail(product: MetricsProduct) {
  return `${formatMoney(product.grossProfit)} de ganancia · ${formatPercent(product.marginPct)} de margen`
}
</script>

<template>
  <section class="rounded-[8px] border border-black/11 bg-panel px-3.5 py-3">
    <h2 class="m-0 mb-2.25 font-display text-[12.5px] font-semibold">Mejor y peor del periodo</h2>

    <div v-if="loading">
      <PrimeSkeleton height="3.5rem" class="mb-2" />
      <PrimeSkeleton height="3.5rem" />
    </div>

    <template v-else>
      <div class="mb-2 rounded-[6px] border border-[#cfe8e1] bg-[#f2faf7] px-2.75 py-2.5" data-testid="report-best">
        <p class="m-0 font-mono text-[10px] font-medium tracking-[.05em] text-positive uppercase">Más rentable</p>
        <strong class="mt-0.75 block text-[13px] font-medium">{{ best?.name ?? 'Sin ventas en el periodo' }}</strong>
        <span class="block text-[11.5px] text-muted">{{ best ? detail(best) : '—' }}</span>
      </div>

      <div class="rounded-[6px] border border-[#f0d8c6] bg-[#fdf6f1] px-2.75 py-2.5" data-testid="report-worst">
        <p class="m-0 font-mono text-[10px] font-medium tracking-[.05em] text-negative uppercase">Menos rentable</p>
        <strong class="mt-0.75 block text-[13px] font-medium">{{ worst?.name ?? '—' }}</strong>
        <span class="block text-[11.5px] text-muted">{{ worst ? detail(worst) : 'Hace falta más de un producto vendido.' }}</span>
      </div>
    </template>
  </section>
</template>
