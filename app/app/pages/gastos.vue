<script setup lang="ts">
import IconPlus from '~icons/lucide/plus'
import IconPencil from '~icons/lucide/pencil'
import IconTrash from '~icons/lucide/trash-2'
import type { Database } from '~/types/database'
import type { DataTableColumn } from '~/components/ui/DataTable.vue'
import {
  EXPENSE_CATEGORIES,
  addCalendarDays,
  calendarDateToPicker,
  formatCalendarDate,
  instantToBusinessDate,
  pickerToCalendarDate,
  type ExpenseCategoryTotal,
  type ExpenseRow,
} from '~/utils/expenses'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Gastos · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()

const rows = ref<ExpenseRow[]>([])
const categoryTotals = ref<ExpenseCategoryTotal[]>([])
const monthLabel = ref('Mes en curso')
const monthFrom = ref('')
const monthTo = ref('')
const rangeFrom = ref<Date | null>(null)
const rangeTo = ref<Date | null>(null)
const categoryFilter = ref<string | null>(null)
const loading = ref(true)
const summaryLoading = ref(true)
const createOpen = ref(false)
const deleteOpen = ref(false)
const selectedExpense = ref<ExpenseRow | null>(null)
const filtersReady = ref(false)

const columns: DataTableColumn[] = [
  { key: 'spent_at', label: 'Fecha', mono: true },
  { key: 'concept', label: 'Concepto' },
  { key: 'category', label: 'Categoría' },
  { key: 'amount', label: 'Monto', align: 'right', mono: true },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

const categoryOptions = computed(() => {
  const found = [...categoryTotals.value.map(item => item.category), ...rows.value.map(item => item.category)]
  const values = [...new Set([...EXPENSE_CATEGORIES.filter(item => item !== 'Otro'), ...found.filter(item => item !== 'Otro'), 'Otro'])]
  return values.map(value => ({ label: value, value }))
})
const monthTotal = computed(() => categoryTotals.value.reduce((total, item) => total + item.total_amount, 0))
const maxCategoryTotal = computed(() => Math.max(1, ...categoryTotals.value.map(item => item.total_amount)))
const rangeError = computed(() => {
  const from = pickerToCalendarDate(rangeFrom.value)
  const to = pickerToCalendarDate(rangeTo.value)
  return from && to && from > to ? 'La fecha inicial debe ser anterior a la final.' : ''
})
const hasFilters = computed(() => filtersReady.value && Boolean(
  categoryFilter.value
  || pickerToCalendarDate(rangeFrom.value) !== monthFrom.value
  || pickerToCalendarDate(rangeTo.value) !== (monthTo.value ? addCalendarDays(monthTo.value, -1) : null),
))
const emptyMessage = computed(() => (hasFilters.value
  ? 'Ningún gasto coincide con los filtros.'
  : 'Todavía no hay gastos registrados en este mes.'))
const barColors = ['#191817', '#5a5650', '#8c8880', '#b5b0a6', '#cfcac0']

function barWidth(amount: number) {
  return `${Math.max(3, amount / maxCategoryTotal.value * 100)}%`
}

async function loadSummary(businessId = businessStore.activeBusinessId) {
  if (!businessId || !monthFrom.value || !monthTo.value) return
  summaryLoading.value = true
  try {
    const data = await execute(client.rpc('expense_category_totals', {
      p_business: businessId,
      p_from: monthFrom.value,
      p_to: monthTo.value,
    }))
    if (businessStore.activeBusinessId === businessId) categoryTotals.value = data ?? []
  } catch {
    if (businessStore.activeBusinessId === businessId) categoryTotals.value = []
  } finally {
    if (businessStore.activeBusinessId === businessId) summaryLoading.value = false
  }
}

async function loadExpenses(businessId = businessStore.activeBusinessId) {
  if (!businessId || !filtersReady.value) return
  const from = pickerToCalendarDate(rangeFrom.value)
  const to = pickerToCalendarDate(rangeTo.value)
  if (!from || !to || rangeError.value) {
    rows.value = []
    return
  }

  loading.value = true
  try {
    let query = client
      .from('expense')
      .select('id, business_id, concept, category, amount, spent_at, recurring, created_at, updated_at')
      .eq('business_id', businessId)
      .gte('spent_at', from)
      .lt('spent_at', addCalendarDays(to, 1))
      .order('spent_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (categoryFilter.value) query = query.eq('category', categoryFilter.value)
    const data = await execute(query)
    if (businessStore.activeBusinessId === businessId) rows.value = data ?? []
  } catch {
    if (businessStore.activeBusinessId === businessId) rows.value = []
  } finally {
    if (businessStore.activeBusinessId === businessId) loading.value = false
  }
}

async function initialize(businessId: string) {
  filtersReady.value = false
  rows.value = []
  categoryTotals.value = []
  loading.value = true
  summaryLoading.value = true
  categoryFilter.value = null

  const timezone = businessStore.activeBusiness?.timezone ?? 'America/Bogota'
  try {
    const data = await execute(client.rpc('period_range', {
      p_timezone: timezone,
      p_period: 'month',
      p_month_offset: 0,
    }))
    if (businessStore.activeBusinessId !== businessId) return

    const range = data?.[0]
    if (!range) throw new Error('No se pudo calcular el mes del negocio.')
    monthFrom.value = instantToBusinessDate(range.from, timezone)
    monthTo.value = instantToBusinessDate(range.to, timezone)
    monthLabel.value = range.label
    rangeFrom.value = calendarDateToPicker(monthFrom.value)
    rangeTo.value = calendarDateToPicker(addCalendarDays(monthTo.value, -1))
    filtersReady.value = true
    await Promise.all([loadSummary(businessId), loadExpenses(businessId)])
  } catch {
    if (businessStore.activeBusinessId === businessId) {
      loading.value = false
      summaryLoading.value = false
    }
  }
}

watch(() => businessStore.activeBusinessId, businessId => {
  if (businessId) initialize(businessId)
}, { immediate: true })

watch([rangeFrom, rangeTo, categoryFilter], () => {
  if (filtersReady.value) loadExpenses()
})

function clearFilters() {
  categoryFilter.value = null
  rangeFrom.value = monthFrom.value ? calendarDateToPicker(monthFrom.value) : null
  rangeTo.value = monthTo.value ? calendarDateToPicker(addCalendarDays(monthTo.value, -1)) : null
}

async function afterSaved() {
  await Promise.all([loadSummary(), loadExpenses()])
}

function openCreate() {
  selectedExpense.value = null
  createOpen.value = true
}

function openEdit(expense: ExpenseRow) {
  selectedExpense.value = expense
  createOpen.value = true
}

function openDelete(expense: ExpenseRow) {
  selectedExpense.value = expense
  deleteOpen.value = true
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Egresos</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Gastos</h1>
      <p class="max-w-155 text-[13.5px] text-muted">Registra los costos operativos que determinan la ganancia neta real.</p>
    </header>

    <div class="mb-5 grid grid-cols-[220px_minmax(280px,520px)_auto] items-start gap-7 rounded-[9px] border border-black/10 bg-panel p-5 max-[1120px]:grid-cols-[200px_1fr] max-[760px]:grid-cols-1 max-[760px]:gap-5 max-[760px]:p-4" data-testid="expense-summary">
      <div>
        <p class="mb-1 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase">Gastos del mes</p>
        <PrimeSkeleton v-if="summaryLoading" width="9rem" height="2rem" />
        <strong v-else class="block font-display text-[28px] leading-tight tracking-[-.03em]" data-testid="expense-month-total">{{ formatMoney(monthTotal) }}</strong>
        <span class="mt-1 block text-[11px] text-muted">{{ monthLabel }}</span>
      </div>

      <div class="grid gap-2" data-testid="expense-distribution">
        <template v-if="summaryLoading"><PrimeSkeleton v-for="line in 3" :key="line" height="1.4rem" :width="`${104 - line * 12}%`" /></template>
        <p v-else-if="categoryTotals.length === 0" class="m-0 text-[12px] text-muted">La distribución aparecerá al registrar el primer gasto del mes.</p>
        <div v-for="(item, index) in categoryTotals" v-else :key="item.category" :data-testid="`expense-category-${item.category}`">
          <div class="mb-1 flex justify-between gap-3 text-[11.5px] text-ink"><span>{{ item.category }}</span><span class="font-mono">{{ formatMoney(item.total_amount) }}</span></div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface"><div class="h-full rounded-full" :style="{ width: barWidth(item.total_amount), background: barColors[index % barColors.length] }" /></div>
        </div>
      </div>

      <UiButton class="justify-self-end max-[1120px]:col-span-2 max-[1120px]:w-full max-[760px]:col-span-1" data-testid="open-expense" @click="openCreate"><IconPlus class="size-4" aria-hidden="true" />Nuevo gasto</UiButton>
    </div>

    <div class="mb-4 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 max-[1120px]:grid-cols-2 max-[760px]:grid-cols-1">
      <div><label for="expense-from" class="mb-1.5 block text-[11px] font-semibold text-ink">Desde</label><PrimeDatePicker v-model="rangeFrom" input-id="expense-from" date-format="dd/mm/yy" show-icon fluid /></div>
      <div><label for="expense-to" class="mb-1.5 block text-[11px] font-semibold text-ink">Hasta</label><PrimeDatePicker v-model="rangeTo" input-id="expense-to" date-format="dd/mm/yy" show-icon fluid /></div>
      <div><label for="expense-filter-category" class="mb-1.5 block text-[11px] font-semibold text-ink">Categoría</label><PrimeSelect id="expense-filter-category" v-model="categoryFilter" :options="categoryOptions" option-label="label" option-value="value" placeholder="Todas" show-clear fluid /></div>
      <UiButton v-if="hasFilters" variant="ghost" class="max-[760px]:w-full" data-testid="expense-clear-filters" @click="clearFilters">Quitar filtros</UiButton>
    </div>

    <p v-if="rangeError" class="mb-3 text-[11px] text-negative" role="alert">{{ rangeError }}</p>
    <p v-else class="mb-3 text-[11px] text-muted" aria-live="polite" data-testid="expense-count">{{ rows.length }} {{ rows.length === 1 ? 'gasto' : 'gastos' }}</p>

    <div v-if="loading" class="rounded-[9px] border border-black/10 bg-panel p-6" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="11.25rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 5" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 7}%`" />
    </div>

    <template v-else>
      <UiDataTable :columns="columns" :rows="rows" :empty-message="emptyMessage">
        <template #cell-spent_at="{ row }"><span class="text-subtle">{{ formatCalendarDate((row as ExpenseRow).spent_at) }}</span></template>
        <template #cell-concept="{ row }"><strong class="font-medium">{{ (row as ExpenseRow).concept }}</strong><UiChip v-if="(row as ExpenseRow).recurring" class="ml-2">Recurrente</UiChip></template>
        <template #cell-category="{ row }"><span class="text-muted">{{ (row as ExpenseRow).category }}</span></template>
        <template #cell-amount="{ row }"><span :data-testid="`expense-row-${(row as ExpenseRow).id}`">{{ formatMoney((row as ExpenseRow).amount) }}</span></template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <UiButton variant="ghost" class="!min-h-10 !w-10 !p-0" :aria-label="`Editar ${String((row as ExpenseRow).concept)}`" title="Editar gasto" :data-testid="`expense-edit-${(row as ExpenseRow).id}`" @click="openEdit(row as ExpenseRow)"><IconPencil class="size-4" aria-hidden="true" /></UiButton>
            <UiButton variant="ghost" class="!min-h-10 !w-10 !p-0 !text-negative" :aria-label="`Eliminar ${String((row as ExpenseRow).concept)}`" title="Eliminar gasto" :data-testid="`expense-delete-${(row as ExpenseRow).id}`" @click="openDelete(row as ExpenseRow)"><IconTrash class="size-4" aria-hidden="true" /></UiButton>
          </div>
        </template>
      </UiDataTable>

      <UiCardList :items="rows" :empty-message="emptyMessage">
        <template #default="{ item }">
          <div class="grid gap-3" :data-testid="`expense-card-${(item as ExpenseRow).id}`">
            <div class="flex items-start justify-between gap-3"><strong class="min-w-0 font-medium">{{ (item as ExpenseRow).concept }}</strong><strong class="shrink-0 font-display text-[16px]">{{ formatMoney((item as ExpenseRow).amount) }}</strong></div>
            <div class="flex flex-wrap items-center gap-1.5"><span class="font-mono text-[10.5px] text-subtle">{{ formatCalendarDate((item as ExpenseRow).spent_at) }}</span><UiChip>{{ (item as ExpenseRow).category }}</UiChip><UiChip v-if="(item as ExpenseRow).recurring">Recurrente</UiChip></div>
            <div class="grid grid-cols-2 gap-2">
              <UiButton variant="secondary" :data-testid="`expense-edit-mobile-${(item as ExpenseRow).id}`" @click="openEdit(item as ExpenseRow)"><IconPencil class="size-4" aria-hidden="true" />Editar</UiButton>
              <UiButton variant="ghost" class="!text-negative" :data-testid="`expense-delete-mobile-${(item as ExpenseRow).id}`" @click="openDelete(item as ExpenseRow)"><IconTrash class="size-4" aria-hidden="true" />Eliminar</UiButton>
            </div>
          </div>
        </template>
      </UiCardList>
    </template>

    <ExpensesExpenseFormModal v-model:open="createOpen" :expense="selectedExpense" @saved="afterSaved" />
    <ExpensesExpenseDeleteModal v-model:open="deleteOpen" :expense="selectedExpense" @deleted="afterSaved" />
  </section>
</template>
