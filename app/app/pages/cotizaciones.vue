<script setup lang="ts">
import IconBanknote from '~icons/lucide/banknote'
import IconFileText from '~icons/lucide/file-text'
import IconHandCoins from '~icons/lucide/hand-coins'
import IconPlus from '~icons/lucide/plus'
import IconTrash from '~icons/lucide/trash-2'
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { DataTableColumn } from '~/components/ui/DataTable.vue'
import { formatCalendarDate } from '~/utils/expenses'
import {
  formatQuoteInstant,
  quoteStatusLabel,
  quoteStatusTone,
  toQuoteRow,
  type QuoteRow,
} from '~/utils/quotes'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Cotizaciones · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney, formatNumber } = useMoney()

const rows = ref<QuoteRow[]>([])
const loading = ref(true)
const convertingKey = ref<string | null>(null)
const selectedQuote = ref<QuoteRow | null>(null)
const deleteOpen = ref(false)

const columns: DataTableColumn[] = [
  { key: 'code', label: 'Cotización', mono: true },
  { key: 'detail', label: 'Detalle' },
  { key: 'customerName', label: 'Cliente' },
  { key: 'total', label: 'Total', align: 'right', mono: true },
  { key: 'actions', label: '', align: 'right' },
]

const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')
const openRows = computed(() => rows.value.filter(row => row.status === 'OPEN'))
const expiredCount = computed(() => rows.value.filter(row => row.status === 'EXPIRED').length)
const openTotal = computed(() => openRows.value.reduce((sum, row) => sum + row.total, 0))

async function loadQuotes(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  loading.value = true
  try {
    const data = await execute(client
      .from('v_quote_detail')
      .select('id, business_id, code, customer_id, customer_name, valid_until, status, total, created_at, line_count, total_units, detail')
      .eq('business_id', businessId)
      .in('status', ['OPEN', 'EXPIRED'])
      .order('created_at', { ascending: false }))
    if (businessStore.activeBusinessId === businessId) {
      rows.value = (data ?? []).map(toQuoteRow).filter((row): row is QuoteRow => Boolean(row))
    }
  } catch {
    if (businessStore.activeBusinessId === businessId) rows.value = []
  } finally {
    if (businessStore.activeBusinessId === businessId) loading.value = false
  }
}

watch(() => businessStore.activeBusinessId, businessId => {
  rows.value = []
  selectedQuote.value = null
  deleteOpen.value = false
  convertingKey.value = null
  if (businessId) loadQuotes(businessId)
}, { immediate: true })

async function convertQuote(quote: QuoteRow, method: 'CASH' | 'CREDIT') {
  const businessId = businessStore.activeBusinessId
  if (!businessId || quote.status !== 'OPEN' || convertingKey.value) return
  if (method === 'CREDIT' && !quote.customerId) return

  convertingKey.value = `${quote.id}:${method}`
  try {
    const args = { p_quote: quote.id, p_method: method, p_due: null } as unknown as Database['public']['Functions']['convert_quote']['Args']
    const sale = await execute(client.rpc('convert_quote', args)) as { code?: string; total?: number } | null
    toast.add({
      severity: 'success',
      summary: method === 'CREDIT' ? 'Cotización pasada a fiado' : 'Cotización cobrada',
      detail: `${quote.code} se convirtió en ${sale?.code ?? 'una venta'} por ${formatMoney(sale?.total ?? quote.total)}.`,
      life: 5000,
    })
    if (businessStore.activeBusinessId === businessId) await loadQuotes(businessId)
  } catch {
    // El backend también bloquea la vigencia para cubrir pestañas desactualizadas.
  } finally {
    convertingKey.value = null
  }
}

function openDelete(quote: QuoteRow) {
  selectedQuote.value = quote
  deleteOpen.value = true
}

const documentId = ref<string | null>(null)
const documentOpen = ref(false)

function openDocument(quote: QuoteRow) {
  documentId.value = quote.id
  documentOpen.value = true
}

function quoteMeta(quote: QuoteRow) {
  return `Creada ${formatQuoteInstant(quote.createdAt, timezone.value)} · Válida hasta ${formatCalendarDate(quote.validUntil)}`
}

function isConverting(quote: QuoteRow, method: 'CASH' | 'CREDIT') {
  return convertingKey.value === `${quote.id}:${method}`
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5 flex items-end justify-between gap-5 max-[760px]:items-stretch max-[760px]:flex-col">
      <div>
        <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Documentos comerciales</p>
        <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Cotizaciones</h1>
        <p class="max-w-180 text-[13.5px] text-muted">Guarda propuestas sin mover inventario y conviértelas cuando el cliente confirme.</p>
      </div>
      <UiButton class="shrink-0 max-[760px]:w-full" data-testid="quote-build-in-cash" @click="navigateTo('/caja')">
        <IconPlus class="size-4" aria-hidden="true" />Armar en caja
      </UiButton>
    </header>

    <div class="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-[10px] bg-ink px-5 py-4 text-white max-[560px]:grid-cols-1">
      <div>
        <span class="block text-[9px] font-semibold tracking-[.1em] text-white/60 uppercase">Cotizaciones vigentes</span>
        <strong class="mt-1 block font-display text-[clamp(25px,3vw,34px)] leading-none tracking-[-.035em]" data-testid="quote-open-total">{{ loading ? '—' : formatMoney(openTotal) }}</strong>
      </div>
      <p class="m-0 text-right text-[11.5px] leading-relaxed text-white/70 max-[560px]:text-left" data-testid="quote-summary-counts">
        {{ openRows.length }} {{ openRows.length === 1 ? 'vigente' : 'vigentes' }}<br>
        <span :class="expiredCount ? 'text-[#ffb7a1]' : ''">{{ expiredCount }} {{ expiredCount === 1 ? 'vencida' : 'vencidas' }}</span>
      </p>
    </div>

    <div v-if="loading" class="rounded-[9px] border border-black/10 bg-panel p-6" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="12rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 4" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 8}%`" />
    </div>

    <template v-else>
      <p class="mb-3 text-[11px] text-muted" aria-live="polite" data-testid="quote-list-count">{{ rows.length }} {{ rows.length === 1 ? 'cotización pendiente' : 'cotizaciones pendientes' }}</p>

      <UiDataTable :columns="columns" :rows="rows" empty-message="Todavía no hay cotizaciones. Ármala desde Caja y guárdala antes de cobrar.">
        <template #cell-code="{ row }"><div class="grid justify-items-start gap-1"><strong>{{ (row as QuoteRow).code }}</strong><UiChip :tone="quoteStatusTone((row as QuoteRow).status)">{{ quoteStatusLabel((row as QuoteRow).status) }}</UiChip><span class="font-sans text-[10px] text-subtle">{{ quoteMeta(row as QuoteRow) }}</span></div></template>
        <template #cell-detail="{ row }"><strong class="block max-w-80 truncate font-medium">{{ (row as QuoteRow).detail }}</strong><span class="mt-0.5 block text-[10.5px] text-subtle">{{ formatNumber((row as QuoteRow).totalUnits) }} unidades · {{ (row as QuoteRow).lineCount }} productos</span></template>
        <template #cell-customerName="{ row }"><span :class="!(row as QuoteRow).customerId ? 'text-subtle' : ''">{{ (row as QuoteRow).customerName }}</span></template>
        <template #cell-total="{ row }">{{ formatMoney((row as QuoteRow).total) }}</template>
        <template #cell-actions="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5">
            <UiButton :loading="isConverting(row as QuoteRow, 'CASH')" :disabled="(row as QuoteRow).status !== 'OPEN' || Boolean(convertingKey)" :title="(row as QuoteRow).status === 'EXPIRED' ? 'La cotización está vencida' : 'Convertir en venta de contado'" :data-testid="`quote-charge-${(row as QuoteRow).id}`" @click="convertQuote(row as QuoteRow, 'CASH')"><IconBanknote class="size-3.5" aria-hidden="true" />Cobrar</UiButton>
            <UiButton variant="secondary" :loading="isConverting(row as QuoteRow, 'CREDIT')" :disabled="(row as QuoteRow).status !== 'OPEN' || !(row as QuoteRow).customerId || Boolean(convertingKey)" :title="!(row as QuoteRow).customerId ? 'Asigna un cliente para pasarla a fiado' : (row as QuoteRow).status === 'EXPIRED' ? 'La cotización está vencida' : 'Convertir en fiado'" :data-testid="`quote-credit-${(row as QuoteRow).id}`" @click="convertQuote(row as QuoteRow, 'CREDIT')"><IconHandCoins class="size-3.5" aria-hidden="true" />A fiado</UiButton>
            <UiButton variant="ghost" :data-testid="`quote-document-${(row as QuoteRow).id}`" @click="openDocument(row as QuoteRow)"><IconFileText class="size-3.5" aria-hidden="true" />Ver/PDF</UiButton>
            <UiButton variant="ghost" :data-testid="`quote-delete-${(row as QuoteRow).id}`" @click="openDelete(row as QuoteRow)"><IconTrash class="size-3.5" aria-hidden="true" /><span class="sr-only">Eliminar</span></UiButton>
          </div>
        </template>
      </UiDataTable>

      <UiCardList :items="rows" empty-message="Todavía no hay cotizaciones. Ármala desde Caja y guárdala antes de cobrar.">
        <template #default="{ item }">
          <article class="grid gap-3" :data-testid="`quote-card-${(item as QuoteRow).id}`">
            <div class="flex items-start justify-between gap-3"><div><strong class="font-mono text-[12px]">{{ (item as QuoteRow).code }}</strong><span class="mt-1 block text-[10px] text-subtle">{{ quoteMeta(item as QuoteRow) }}</span></div><UiChip :tone="quoteStatusTone((item as QuoteRow).status)">{{ quoteStatusLabel((item as QuoteRow).status) }}</UiChip></div>
            <div><strong class="block truncate font-medium">{{ (item as QuoteRow).detail }}</strong><span class="mt-0.5 block text-[10.5px] text-subtle">{{ (item as QuoteRow).customerName }}</span></div>
            <dl class="grid grid-cols-2 gap-3 text-[11px]"><div><dt class="text-subtle">Contenido</dt><dd class="m-0 mt-1 font-mono">{{ formatNumber((item as QuoteRow).totalUnits) }} un. · {{ (item as QuoteRow).lineCount }} prod.</dd></div><div class="text-right"><dt class="text-subtle">Total</dt><dd class="m-0 mt-1 font-mono text-[15px] font-semibold">{{ formatMoney((item as QuoteRow).total) }}</dd></div></dl>
            <div class="grid grid-cols-2 gap-2">
              <UiButton class="w-full" :loading="isConverting(item as QuoteRow, 'CASH')" :disabled="(item as QuoteRow).status !== 'OPEN' || Boolean(convertingKey)" :data-testid="`quote-charge-mobile-${(item as QuoteRow).id}`" @click="convertQuote(item as QuoteRow, 'CASH')"><IconBanknote class="size-4" aria-hidden="true" />Cobrar</UiButton>
              <UiButton class="w-full" variant="secondary" :loading="isConverting(item as QuoteRow, 'CREDIT')" :disabled="(item as QuoteRow).status !== 'OPEN' || !(item as QuoteRow).customerId || Boolean(convertingKey)" :data-testid="`quote-credit-mobile-${(item as QuoteRow).id}`" @click="convertQuote(item as QuoteRow, 'CREDIT')"><IconHandCoins class="size-4" aria-hidden="true" />A fiado</UiButton>
              <UiButton class="w-full" variant="ghost" :data-testid="`quote-document-mobile-${(item as QuoteRow).id}`" @click="openDocument(item as QuoteRow)"><IconFileText class="size-4" aria-hidden="true" />Ver/PDF</UiButton>
              <UiButton class="w-full" variant="ghost" :data-testid="`quote-delete-mobile-${(item as QuoteRow).id}`" @click="openDelete(item as QuoteRow)"><IconTrash class="size-4" aria-hidden="true" />Eliminar</UiButton>
            </div>
          </article>
        </template>
      </UiCardList>
    </template>

    <p v-if="expiredCount" class="mt-5 max-w-190 text-[12px] leading-relaxed text-muted">Las cotizaciones vencidas permanecen visibles para consultar o eliminar, pero ya no se pueden cobrar ni pasar a fiado.</p>
    <QuotesDeleteQuoteModal v-model:open="deleteOpen" :quote="selectedQuote" @deleted="loadQuotes()" />

    <DocumentsDocumentViewer
      v-model:open="documentOpen"
      kind="QUOTE"
      :document-id="documentId"
      @converted="loadQuotes()"
    />
  </section>
</template>
