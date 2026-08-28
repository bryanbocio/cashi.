<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { MetricsPeriod, MetricsProduct, MetricsSummary } from '~/utils/metrics'
import { EMPTY_SUMMARY, toMetricsProducts, toMetricsSummary } from '~/utils/metrics'
import type { CategoryProfit, SaleHistoryRow } from '~/utils/reports'
import {
  REPORT_PRODUCT_LIMIT,
  SALE_HISTORY_COLUMNS,
  buildSalesCsv,
  salesCsvName,
  toCategoryProfits,
  toSaleHistoryRow,
} from '~/utils/reports'
import { addCalendarDays, instantToBusinessDate } from '~/utils/expenses'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Reportes · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()

const period = ref<MetricsPeriod>('month')
const monthOffset = ref(0)

const summary = ref<MetricsSummary>({ ...EMPTY_SUMMARY })
const categories = ref<CategoryProfit[]>([])
const products = ref<MetricsProduct[]>([])
const history = ref<SaleHistoryRow[]>([])

const summaryLoading = ref(true)
const categoriesLoading = ref(true)
const productsLoading = ref(true)
const historyLoading = ref(true)

const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')
const periodLabel = computed(() => summary.value.range.label)
const comparisonLabel = computed(() => summary.value.range.previousLabel)

/** Cada panel falla por su cuenta: un error del historial no borra las cifras. */
async function load<T>(
  businessId: string,
  loading: Ref<boolean>,
  target: Ref<T>,
  empty: () => T,
  run: () => Promise<T>,
) {
  loading.value = true
  try {
    const value = await run()
    if (businessStore.activeBusinessId === businessId) target.value = value
  } catch {
    if (businessStore.activeBusinessId === businessId) target.value = empty()
  } finally {
    if (businessStore.activeBusinessId === businessId) loading.value = false
  }
}

function loadSummary(businessId: string) {
  return load(businessId, summaryLoading, summary, () => ({ ...EMPTY_SUMMARY }), async () => {
    const data = await execute(client.rpc('metrics_summary', {
      p_business: businessId,
      p_period: period.value,
      p_month_offset: monthOffset.value,
    }))
    return toMetricsSummary(data)
  })
}

function loadCategories(businessId: string) {
  return load(businessId, categoriesLoading, categories, () => [], async () => {
    const data = await execute(client.rpc('metrics_categories', {
      p_business: businessId,
      p_period: period.value,
      p_month_offset: monthOffset.value,
    }))
    return toCategoryProfits(data)
  })
}

function loadProducts(businessId: string) {
  return load(businessId, productsLoading, products, () => [], async () => {
    const data = await execute(client.rpc('metrics_products', {
      p_business: businessId,
      p_period: period.value,
      p_month_offset: monthOffset.value,
      p_limit: REPORT_PRODUCT_LIMIT,
    }))
    return toMetricsProducts(data)
  })
}

/**
 * El historial se corta con los instantes exactos de `period_range`, la misma
 * utilidad que usan las métricas. Aquí no se calcula ninguna medianoche: los
 * límites vienen resueltos en la zona horaria del negocio desde Postgres.
 */
function loadHistory(businessId: string) {
  return load(businessId, historyLoading, history, () => [], async () => {
    const range = await execute(client.rpc('period_range', {
      p_timezone: timezone.value,
      p_period: period.value,
      p_month_offset: monthOffset.value,
    }))
    const limits = range?.[0]
    if (!limits) return []
    const data = await execute(client
      .from('v_sale_detail')
      .select(SALE_HISTORY_COLUMNS)
      .eq('business_id', businessId)
      .eq('status', 'CONFIRMED')
      .gte('sold_at', limits.from)
      .lt('sold_at', limits.to)
      .order('sold_at', { ascending: false }))
    return (data ?? []).flatMap(toSaleHistoryRow)
  })
}

function reloadPeriod(businessId: string) {
  return Promise.all([
    loadSummary(businessId),
    loadCategories(businessId),
    loadProducts(businessId),
    loadHistory(businessId),
  ])
}

function initialize(businessId: string) {
  summary.value = { ...EMPTY_SUMMARY }
  categories.value = []
  products.value = []
  history.value = []
  return reloadPeriod(businessId)
}

watch(() => businessStore.activeBusinessId, businessId => {
  if (businessId) initialize(businessId)
}, { immediate: true })

watch([period, monthOffset], () => {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return
  reloadPeriod(businessId)
})

const documentId = ref<string | null>(null)
const documentOpen = ref(false)

function openSale(sale: SaleHistoryRow) {
  documentId.value = sale.id
  documentOpen.value = true
}

function exportCsv() {
  if (!history.value.length) return
  const { from, to } = summary.value.range
  const csv = buildSalesCsv(history.value, instant => instantToBusinessDate(instant, timezone.value))
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = salesCsvName(from, addCalendarDays(to, -1))
  link.click()
  URL.revokeObjectURL(url)

  toast.add({
    severity: 'success',
    summary: 'Historial exportado',
    detail: `${history.value.length} ${history.value.length === 1 ? 'venta' : 'ventas'} en ${link.download}.`,
    life: 4500,
  })
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-5.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Análisis</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Reportes</h1>
      <p class="max-w-155 text-[13.5px] text-muted">Ingresos, costos y ganancia del periodo, con el detalle por categoría, producto y venta.</p>
    </header>

    <UiPeriodSelector
      v-model:period="period"
      v-model:month-offset="monthOffset"
      class="mb-3.5"
      :timezone="timezone"
      :label="periodLabel"
      :comparison-label="comparisonLabel"
    />

    <ReportsFigures class="mb-3" :summary="summary" :loading="summaryLoading" />

    <div class="mb-3 grid grid-cols-2 items-start gap-3 max-[1120px]:grid-cols-1">
      <ReportsCategoryProfit :categories="categories" :loading="categoriesLoading" />
      <ReportsBestWorst :products="products" :loading="productsLoading" />
    </div>

    <ReportsSalesHistory
      :rows="history"
      :timezone="timezone"
      :loading="historyLoading"
      @open="openSale"
      @export="exportCsv"
    />

    <DocumentsDocumentViewer v-model:open="documentOpen" kind="SALE" :document-id="documentId" />
  </section>
</template>
