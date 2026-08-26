<script setup lang="ts">
import type { Database } from '~/types/database'
import type { DataTableColumn } from '~/components/ui/DataTable.vue'
import { formatCalendarDate } from '~/utils/expenses'
import { formatCreditInstant, toCreditRow, type CreditRow } from '~/utils/credits'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Fiados · Cashi' })

type CreditSummary = {
  total_debt: number
  debtor_count: number
  overdue_count: number
  overdue_amount: number
  paid_in_period: number
}

const EMPTY_SUMMARY: CreditSummary = { total_debt: 0, debtor_count: 0, overdue_count: 0, overdue_amount: 0, paid_in_period: 0 }
const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const { execute } = useSupabaseRequest()
const { formatMoney, formatNumber } = useMoney()

const rows = ref<CreditRow[]>([])
const summary = ref<CreditSummary>({ ...EMPTY_SUMMARY })
const monthFrom = ref('')
const monthTo = ref('')
const monthLabel = ref('Mes en curso')
const loading = ref(true)
const summaryLoading = ref(true)
const paymentOpen = ref(false)
const selectedCredit = ref<CreditRow | null>(null)

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Cliente' },
  { key: 'debt', label: 'Deuda', align: 'right', mono: true },
  { key: 'totalCredit', label: 'Comprado', align: 'right', mono: true, hideOnNarrow: true },
  { key: 'status', label: 'Estado' },
  { key: 'lastPaymentAt', label: 'Último abono', align: 'right', mono: true, hideOnNarrow: true },
  { key: 'actions', label: '', align: 'right' },
]

const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')

function dueLabel(credit: CreditRow) {
  if (credit.isOverdue) return `${formatNumber(credit.daysOverdue)} ${credit.daysOverdue === 1 ? 'día vencido' : 'días vencidos'}`
  if (credit.oldestDueDate) return `Vence ${formatCalendarDate(credit.oldestDueDate)}`
  return 'Sin vencimiento'
}

async function loadCredits(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  loading.value = true
  try {
    const data = await execute(client
      .from('v_credits')
      .select('customer_id, business_id, customer_name, customer_phone, total_credit, total_paid, debt, credit_sales_count, oldest_due_date, is_overdue, days_overdue, last_credit_at, last_payment_at')
      .eq('business_id', businessId)
      .order('is_overdue', { ascending: false })
      .order('oldest_due_date', { ascending: true, nullsFirst: false })
      .order('customer_name'))
    if (businessStore.activeBusinessId === businessId) {
      rows.value = (data ?? []).map(toCreditRow).filter((row): row is CreditRow => Boolean(row))
    }
  } catch {
    if (businessStore.activeBusinessId === businessId) rows.value = []
  } finally {
    if (businessStore.activeBusinessId === businessId) loading.value = false
  }
}

async function loadSummary(businessId = businessStore.activeBusinessId) {
  if (!businessId || !monthFrom.value || !monthTo.value) return
  summaryLoading.value = true
  try {
    const data = await execute(client.rpc('credit_dashboard_summary', {
      p_business: businessId,
      p_from: monthFrom.value,
      p_to: monthTo.value,
    }))
    if (businessStore.activeBusinessId === businessId) summary.value = data?.[0] ?? { ...EMPTY_SUMMARY }
  } catch {
    if (businessStore.activeBusinessId === businessId) summary.value = { ...EMPTY_SUMMARY }
  } finally {
    if (businessStore.activeBusinessId === businessId) summaryLoading.value = false
  }
}

async function initialize(businessId: string) {
  rows.value = []
  summary.value = { ...EMPTY_SUMMARY }
  loading.value = true
  summaryLoading.value = true
  const currentTimezone = businessStore.activeBusiness?.timezone ?? 'America/Bogota'
  try {
    const data = await execute(client.rpc('period_range', {
      p_timezone: currentTimezone,
      p_period: 'month',
      p_month_offset: 0,
    }))
    if (businessStore.activeBusinessId !== businessId) return
    const range = data?.[0]
    if (!range) throw new Error('No se pudo calcular el mes del negocio.')
    monthFrom.value = range.from
    monthTo.value = range.to
    monthLabel.value = range.label
    await Promise.all([loadCredits(businessId), loadSummary(businessId)])
  } catch {
    if (businessStore.activeBusinessId === businessId) {
      loading.value = false
      summaryLoading.value = false
    }
  }
}

watch(() => businessStore.activeBusinessId, businessId => {
  selectedCredit.value = null
  paymentOpen.value = false
  if (businessId) initialize(businessId)
}, { immediate: true })

function openPayment(credit: CreditRow) {
  selectedCredit.value = credit
  paymentOpen.value = true
}

async function afterPayment() {
  await Promise.all([loadCredits(), loadSummary()])
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Cartera</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Fiados</h1>
      <p class="max-w-155 text-[13.5px] text-muted">Consulta saldos pendientes, identifica vencimientos y registra abonos de clientes.</p>
    </header>

    <div class="mb-5 grid grid-cols-3 gap-3 max-[760px]:grid-cols-1" data-testid="credit-summary">
      <div class="rounded-[9px] border border-black/10 bg-panel px-4 py-3.5">
        <p class="mb-1 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase">Por cobrar</p>
        <PrimeSkeleton v-if="summaryLoading" width="8rem" height="1.75rem" />
        <strong v-else class="block font-display text-[24px] leading-tight tracking-[-.03em]" data-testid="credit-total-debt">{{ formatMoney(summary.total_debt) }}</strong>
        <span class="mt-1 block text-[10.5px] text-muted">Saldo pendiente total</span>
      </div>
      <div class="rounded-[9px] border border-black/10 bg-panel px-4 py-3.5">
        <p class="mb-1 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase">Clientes con deuda</p>
        <PrimeSkeleton v-if="summaryLoading" width="4rem" height="1.75rem" />
        <strong v-else class="block font-display text-[24px] leading-tight tracking-[-.03em]" data-testid="credit-debtor-count">{{ formatNumber(summary.debtor_count) }}</strong>
        <span class="mt-1 block text-[10.5px]" :class="summary.overdue_count ? 'text-negative' : 'text-muted'">{{ summary.overdue_count }} vencidos · {{ formatMoney(summary.overdue_amount) }}</span>
      </div>
      <div class="rounded-[9px] border border-[#f0d8c6] bg-[#fdf6f1] px-4 py-3.5">
        <p class="mb-1 font-mono text-[9.5px] font-medium tracking-[.05em] text-[#c2410c] uppercase">Abonado este mes</p>
        <PrimeSkeleton v-if="summaryLoading" width="8rem" height="1.75rem" />
        <strong v-else class="block font-display text-[24px] leading-tight tracking-[-.03em]" data-testid="credit-paid-month">{{ formatMoney(summary.paid_in_period) }}</strong>
        <span class="mt-1 block text-[10.5px] text-muted">{{ monthLabel }}</span>
      </div>
    </div>

    <div v-if="loading" class="rounded-[9px] border border-black/10 bg-panel p-6" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="11.25rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 5" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 7}%`" />
    </div>

    <template v-else>
      <p class="mb-3 text-[11px] text-muted" aria-live="polite" data-testid="credit-count">{{ rows.length }} {{ rows.length === 1 ? 'cliente con deuda' : 'clientes con deuda' }}</p>

      <UiDataTable :columns="columns" :rows="rows" row-key="customerId" empty-message="No hay saldos pendientes. Todos los clientes están al día.">
        <template #cell-name="{ row }"><strong class="block font-medium">{{ (row as CreditRow).name }}</strong><span class="text-[10.5px] text-subtle">{{ (row as CreditRow).phone ?? 'Sin teléfono' }}</span></template>
        <template #cell-debt="{ row }"><strong :data-testid="`credit-debt-${(row as CreditRow).customerId}`">{{ formatMoney((row as CreditRow).debt) }}</strong></template>
        <template #cell-totalCredit="{ row }">{{ formatMoney((row as CreditRow).totalCredit) }}</template>
        <template #cell-status="{ row }"><UiChip :tone="(row as CreditRow).isOverdue ? 'negative' : 'positive'">{{ dueLabel(row as CreditRow) }}</UiChip></template>
        <template #cell-lastPaymentAt="{ row }">{{ formatCreditInstant((row as CreditRow).lastPaymentAt, timezone) }}</template>
        <template #cell-actions="{ row }"><UiButton variant="secondary" :data-testid="`credit-pay-${(row as CreditRow).customerId}`" @click="openPayment(row as CreditRow)">Abonar</UiButton></template>
      </UiDataTable>

      <UiCardList :items="rows" item-key="customerId" empty-message="No hay saldos pendientes. Todos los clientes están al día.">
        <template #default="{ item }">
          <div class="grid gap-3" :data-testid="`credit-card-${(item as CreditRow).customerId}`">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0"><strong class="block font-medium">{{ (item as CreditRow).name }}</strong><span class="text-[10.5px] text-subtle">{{ (item as CreditRow).phone ?? 'Sin teléfono' }}</span></div>
              <div class="shrink-0 text-right"><strong class="block font-display text-[19px]">{{ formatMoney((item as CreditRow).debt) }}</strong><span class="text-[10px] text-subtle">deuda</span></div>
            </div>
            <div class="flex flex-wrap gap-1.5"><UiChip :tone="(item as CreditRow).isOverdue ? 'negative' : 'positive'">{{ dueLabel(item as CreditRow) }}</UiChip><UiChip>{{ (item as CreditRow).creditSalesCount }} {{ (item as CreditRow).creditSalesCount === 1 ? 'venta' : 'ventas' }}</UiChip></div>
            <dl class="grid grid-cols-2 gap-3 text-[11px]"><div><dt class="text-subtle">Comprado</dt><dd class="m-0 mt-1 font-mono">{{ formatMoney((item as CreditRow).totalCredit) }}</dd></div><div><dt class="text-subtle">Último abono</dt><dd class="m-0 mt-1 font-mono">{{ formatCreditInstant((item as CreditRow).lastPaymentAt, timezone) }}</dd></div></dl>
            <UiButton class="w-full" :data-testid="`credit-pay-mobile-${(item as CreditRow).customerId}`" @click="openPayment(item as CreditRow)">Abonar</UiButton>
          </div>
        </template>
      </UiCardList>
    </template>

    <CreditsCreditPaymentModal v-model:open="paymentOpen" :credit="selectedCredit" @paid="afterPayment" />
  </section>
</template>
