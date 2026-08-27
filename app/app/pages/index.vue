<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { MetricsAlert, MetricsDay, MetricsPeriod, MetricsProduct, MetricsSummary, RecentSale } from '~/utils/metrics'
import {
  EMPTY_SUMMARY,
  METRICS_CHART_DAYS,
  METRICS_PRODUCT_LIMIT,
  METRICS_RECENT_SALES,
  RECENT_SALE_COLUMNS,
  toMetricsAlerts,
  toMetricsDays,
  toMetricsProducts,
  toMetricsSummary,
  toRecentSale,
} from '~/utils/metrics'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Resumen · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()

// El selector de periodo llega en F7.2; la vista ya trabaja con el estado que
// va a mover para no tener que rehacerla después.
const period = ref<MetricsPeriod>('today')
const monthOffset = ref(0)

const summary = ref<MetricsSummary>({ ...EMPTY_SUMMARY })
const days = ref<MetricsDay[]>([])
const products = ref<MetricsProduct[]>([])
const alerts = ref<MetricsAlert[]>([])
const sales = ref<RecentSale[]>([])

const summaryLoading = ref(true)
const chartLoading = ref(true)
const productsLoading = ref(true)
const alertsLoading = ref(true)
const salesLoading = ref(true)

const businessName = computed(() => businessStore.activeBusiness?.name ?? 'Sin negocio activo')
const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')
const periodLabel = computed(() => summary.value.range.label)
const comparisonLabel = computed(() => summary.value.range.previousLabel)

/** Cada panel falla por su cuenta: un error de alertas no debe vaciar los KPI. */
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

function loadChart(businessId: string) {
  return load(businessId, chartLoading, days, () => [], async () => {
    const data = await execute(client.rpc('metrics_daily', {
      p_business: businessId,
      p_days: METRICS_CHART_DAYS,
    }))
    return toMetricsDays(data)
  })
}

function loadProducts(businessId: string) {
  return load(businessId, productsLoading, products, () => [], async () => {
    const data = await execute(client.rpc('metrics_products', {
      p_business: businessId,
      p_period: period.value,
      p_month_offset: monthOffset.value,
      p_limit: METRICS_PRODUCT_LIMIT,
    }))
    return toMetricsProducts(data)
  })
}

function loadAlerts(businessId: string) {
  return load(businessId, alertsLoading, alerts, () => [], async () => {
    const data = await execute(client.rpc('metrics_alerts', { p_business: businessId }))
    return toMetricsAlerts(data)
  })
}

function loadRecentSales(businessId: string) {
  return load(businessId, salesLoading, sales, () => [], async () => {
    const data = await execute(client
      .from('v_sale_detail')
      .select(RECENT_SALE_COLUMNS)
      .eq('business_id', businessId)
      .eq('status', 'CONFIRMED')
      .order('sold_at', { ascending: false })
      .limit(METRICS_RECENT_SALES))
    return (data ?? []).flatMap(toRecentSale)
  })
}

function initialize(businessId: string) {
  summary.value = { ...EMPTY_SUMMARY }
  days.value = []
  products.value = []
  alerts.value = []
  sales.value = []
  return Promise.all([
    loadSummary(businessId),
    loadChart(businessId),
    loadProducts(businessId),
    loadAlerts(businessId),
    loadRecentSales(businessId),
  ])
}

watch(() => businessStore.activeBusinessId, businessId => {
  if (businessId) initialize(businessId)
}, { immediate: true })

// La gráfica son siempre los últimos 14 días, y las alertas y las últimas
// ventas son una foto de hoy: cambiar de periodo solo recarga lo que depende
// del rango.
watch([period, monthOffset], () => {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return
  Promise.all([loadSummary(businessId), loadProducts(businessId)])
})

function openSale(sale: RecentSale) {
  toast.add({
    severity: 'info',
    summary: `Venta ${sale.code}`,
    detail: 'El visor y la descarga en PDF se habilitarán en la etapa de documentos.',
    life: 4500,
  })
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-5.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Panel principal</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Resumen</h1>
      <p class="max-w-155 text-[13.5px] text-muted">
        Ventas, ganancias, gastos, cartera y alertas de
        <strong class="font-medium text-ink" data-testid="active-business-name">{{ businessName }}</strong>.
      </p>
    </header>

    <DashboardPeriodSelector
      v-model:period="period"
      v-model:month-offset="monthOffset"
      class="mb-3.5"
      :timezone="timezone"
      :label="periodLabel"
      :comparison-label="comparisonLabel"
    />

    <DashboardKpiCards class="mb-3" :summary="summary" :loading="summaryLoading" />

    <div class="mb-3 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-3 max-[1120px]:grid-cols-1">
      <DashboardSalesChart :days="days" :loading="chartLoading" />
      <DashboardTopProducts :products="products" :period-label="periodLabel" :loading="productsLoading" />
    </div>

    <div class="grid grid-cols-2 items-start gap-3 max-[1120px]:grid-cols-1">
      <DashboardRecentSales :sales="sales" :timezone="timezone" :loading="salesLoading" @open="openSale" />
      <DashboardAlertList :alerts="alerts" :loading="alertsLoading" />
    </div>
  </section>
</template>
