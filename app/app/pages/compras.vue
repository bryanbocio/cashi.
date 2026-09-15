<script setup lang="ts">
import IconPackagePlus from '~icons/lucide/package-plus'
import IconPackageCheck from '~icons/lucide/package-check'
import IconPlus from '~icons/lucide/plus'
import { useToast } from 'primevue/usetoast'
import type { Database, Json } from '~/types/database'
import type { DataTableColumn } from '~/components/ui/DataTable.vue'
import { formatCalendarDate } from '~/utils/expenses'
import {
  EMPTY_PURCHASE_SUGGESTION,
  formatPurchaseInstant,
  purchaseStatusLabel,
  purchaseStatusTone,
  toPurchaseOrderRow,
  toPurchaseSuggestion,
  type PurchaseOrderRow,
  type PurchaseSuggestion,
} from '~/utils/purchases'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Compras · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney, formatNumber } = useMoney()

const rows = ref<PurchaseOrderRow[]>([])
const suggestion = ref<PurchaseSuggestion>({ ...EMPTY_PURCHASE_SUGGESTION, lines: [] })
const loading = ref(true)
const suggestionLoading = ref(true)
const creating = ref(false)
const receivingId = ref<string | null>(null)
const manualOpen = ref(false)
const productCreateOpen = ref(false)
const createdProduct = ref<{ id: string; supplierId: string | null } | null>(null)
const products = ref<Array<{ label: string; value: string; sku: string; cost: number }>>([])
const suppliers = ref<Array<{ label: string; value: string }>>([])
const categories = ref<Array<{ label: string; value: string }>>([])

const columns: DataTableColumn[] = [
  { key: 'code', label: 'Orden', mono: true },
  { key: 'supplierName', label: 'Proveedor' },
  { key: 'totalUnits', label: 'Unidades', align: 'right', mono: true },
  { key: 'totalCost', label: 'Costo', align: 'right', mono: true },
  { key: 'status', label: 'Estado', align: 'right' },
  { key: 'actions', label: '', align: 'right' },
]

const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')
const pendingCount = computed(() => rows.value.filter(row => row.status === 'PENDING').length)

async function loadSuggestion(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  suggestionLoading.value = true
  try {
    const data = await execute(client.rpc('suggest_purchase', { p_business: businessId }))
    if (businessStore.activeBusinessId === businessId) suggestion.value = toPurchaseSuggestion(data)
  } catch {
    if (businessStore.activeBusinessId === businessId) suggestion.value = { ...EMPTY_PURCHASE_SUGGESTION, lines: [] }
  } finally {
    if (businessStore.activeBusinessId === businessId) suggestionLoading.value = false
  }
}

async function loadOrders(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  loading.value = true
  try {
    const data = await execute(client
      .from('v_purchase_orders')
      .select('id, business_id, code, supplier_id, supplier_name, status, expected_at, received_at, created_at, line_count, total_units, total_cost')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }))
    if (businessStore.activeBusinessId === businessId) {
      rows.value = (data ?? []).map(toPurchaseOrderRow).filter((row): row is PurchaseOrderRow => Boolean(row))
    }
  } catch {
    if (businessStore.activeBusinessId === businessId) rows.value = []
  } finally {
    if (businessStore.activeBusinessId === businessId) loading.value = false
  }
}

async function loadCatalog(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  const [productRows, supplierRows, categoryRows] = await Promise.all([
    execute(client.from('product').select('id, name, sku, cost').eq('business_id', businessId).eq('active', true).order('name')),
    execute(client.from('supplier').select('id, name').eq('business_id', businessId).order('name')),
    execute(client.from('category').select('id, name').eq('business_id', businessId).order('name')),
  ])
  if (businessStore.activeBusinessId !== businessId) return
  products.value = (productRows ?? []).map(product => ({
    label: `${product.name} · ${product.sku}`,
    value: product.id,
    sku: product.sku,
    cost: product.cost,
  }))
  suppliers.value = (supplierRows ?? []).map(supplier => ({ label: supplier.name, value: supplier.id }))
  categories.value = (categoryRows ?? []).map(category => ({ label: category.name, value: category.id }))
}

async function initialize(businessId: string) {
  rows.value = []
  suggestion.value = { ...EMPTY_PURCHASE_SUGGESTION, lines: [] }
  loading.value = true
  suggestionLoading.value = true
  await Promise.all([loadOrders(businessId), loadSuggestion(businessId), loadCatalog(businessId)])
}

watch(() => businessStore.activeBusinessId, businessId => {
  creating.value = false
  receivingId.value = null
  manualOpen.value = false
  productCreateOpen.value = false
  createdProduct.value = null
  if (businessId) initialize(businessId)
}, { immediate: true })

function openManualPurchase() {
  createdProduct.value = null
  manualOpen.value = true
}

async function afterProductCreated(product: { id: string; supplierId: string | null }) {
  await loadCatalog()
  createdProduct.value = { id: product.id, supplierId: product.supplierId }
}

async function afterManualPurchase() {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return
  createdProduct.value = null
  await Promise.all([loadOrders(businessId), loadSuggestion(businessId), loadCatalog(businessId)])
}

async function createSuggestedOrder() {
  const businessId = businessStore.activeBusinessId
  if (!businessId || creating.value || suggestion.value.productCount === 0) return
  creating.value = true
  try {
    const data = await execute(client.rpc('create_suggested_purchase_order', { p_business: businessId }))
    const response = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, Json | undefined>
      : null
    const code = response && typeof response.code === 'string' ? response.code : 'La orden'
    toast.add({
      severity: 'success',
      summary: 'Orden creada',
      detail: `${code} quedó pendiente de recepción.`,
      life: 4500,
    })
    if (businessStore.activeBusinessId === businessId) await Promise.all([loadOrders(businessId), loadSuggestion(businessId)])
  } catch {
    // useSupabaseRequest ya mostró el error seguro.
  } finally {
    creating.value = false
  }
}

async function receiveOrder(order: PurchaseOrderRow) {
  const businessId = businessStore.activeBusinessId
  if (!businessId || receivingId.value) return
  receivingId.value = order.id
  try {
    await execute(client.rpc('receive_purchase_order', { p_order: order.id }))
    toast.add({
      severity: 'success',
      summary: 'Orden recibida',
      detail: `${order.code} actualizó existencias y costos.`,
      life: 4500,
    })
    if (businessStore.activeBusinessId === businessId) await Promise.all([loadOrders(businessId), loadSuggestion(businessId)])
  } catch {
    // useSupabaseRequest ya mostró el error seguro.
  } finally {
    receivingId.value = null
  }
}

function orderDetail(order: PurchaseOrderRow) {
  if (order.status === 'RECEIVED' && order.receivedAt) return `Recibida ${formatPurchaseInstant(order.receivedAt, timezone.value)}`
  if (order.expectedAt) return `Esperada ${formatCalendarDate(order.expectedAt)}`
  return `Creada ${formatPurchaseInstant(order.createdAt, timezone.value)}`
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5 flex items-start justify-between gap-4 max-[760px]:flex-col">
      <div>
        <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Abastecimiento</p>
        <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Compras a proveedor</h1>
        <p class="max-w-190 text-[13.5px] text-muted"><span data-testid="purchase-pending-count">{{ pendingCount }} {{ pendingCount === 1 ? 'orden pendiente' : 'órdenes pendientes' }}</span> · Recibe mercancía y actualiza sus costos sin alterar ventas anteriores.</p>
      </div>
      <UiButton class="shrink-0 max-[760px]:w-full" data-testid="purchase-open-manual" @click="openManualPurchase">
        <IconPlus class="size-4" aria-hidden="true" />Nueva compra
      </UiButton>
    </header>

    <div
      class="mb-5 flex items-center gap-3 rounded-[9px] border p-3.5 max-[760px]:items-stretch max-[760px]:flex-col"
      :class="suggestion.productCount ? 'border-[#f0d8c6] bg-[#fdf6f1]' : 'border-[#cde8df] bg-[#f2faf7]'"
      data-testid="purchase-suggestion"
    >
      <div class="hidden w-1 self-stretch rounded-full min-[760px]:block" :class="suggestion.productCount ? 'bg-negative' : 'bg-positive'" />
      <div class="min-w-0 flex-1">
        <PrimeSkeleton v-if="suggestionLoading" width="15rem" height="1.1rem" class="mb-2" />
        <template v-else>
          <strong class="block text-[12.5px] font-medium" data-testid="purchase-suggestion-title">
            {{ suggestion.productCount ? `Sugerencia de reposición: ${suggestion.productCount} productos` : 'Todo por encima del mínimo' }}
          </strong>
          <span class="mt-1 block text-[11.5px] text-muted" data-testid="purchase-suggestion-detail">
            {{ suggestion.productCount ? `${formatNumber(suggestion.totalUnits)} unidades · ${formatMoney(suggestion.estimatedTotal)} estimado` : 'No hay nada que reponer ahora mismo.' }}
          </span>
        </template>
      </div>
      <UiButton
        v-if="suggestionLoading || suggestion.productCount"
        class="shrink-0 max-[760px]:w-full"
        :loading="creating"
        :disabled="suggestionLoading"
        data-testid="purchase-create-suggested"
        @click="createSuggestedOrder"
      ><IconPackagePlus class="size-4" aria-hidden="true" />Crear orden sugerida</UiButton>
    </div>

    <div v-if="loading" class="rounded-[9px] border border-black/10 bg-panel p-6" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="12rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 4" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 8}%`" />
    </div>

    <template v-else>
      <p class="mb-3 text-[11px] text-muted" aria-live="polite" data-testid="purchase-order-count">{{ rows.length }} {{ rows.length === 1 ? 'orden' : 'órdenes' }}</p>

      <UiDataTable :columns="columns" :rows="rows" empty-message="Todavía no hay compras. Registra una con Nueva compra o usa la sugerencia de reposición.">
        <template #cell-code="{ row }"><strong>{{ (row as PurchaseOrderRow).code }}</strong><span class="mt-0.5 block font-sans text-[10.5px] text-subtle">{{ orderDetail(row as PurchaseOrderRow) }}</span></template>
        <template #cell-supplierName="{ row }"><strong class="font-medium">{{ (row as PurchaseOrderRow).supplierName }}</strong><span class="mt-0.5 block text-[10.5px] text-subtle">{{ (row as PurchaseOrderRow).lineCount }} {{ (row as PurchaseOrderRow).lineCount === 1 ? 'producto' : 'productos' }}</span></template>
        <template #cell-totalUnits="{ row }">{{ formatNumber((row as PurchaseOrderRow).totalUnits) }}</template>
        <template #cell-totalCost="{ row }">{{ formatMoney((row as PurchaseOrderRow).totalCost) }}</template>
        <template #cell-status="{ row }"><UiChip :tone="purchaseStatusTone((row as PurchaseOrderRow).status)">{{ purchaseStatusLabel((row as PurchaseOrderRow).status) }}</UiChip></template>
        <template #cell-actions="{ row }">
          <UiButton
            v-if="(row as PurchaseOrderRow).status === 'PENDING'"
            :loading="receivingId === (row as PurchaseOrderRow).id"
            :disabled="Boolean(receivingId)"
            :data-testid="`purchase-receive-${(row as PurchaseOrderRow).id}`"
            @click="receiveOrder(row as PurchaseOrderRow)"
          ><IconPackageCheck class="size-4" aria-hidden="true" />Recibir</UiButton>
        </template>
      </UiDataTable>

      <UiCardList :items="rows" empty-message="Todavía no hay compras. Registra una con Nueva compra o usa la sugerencia de reposición.">
        <template #default="{ item }">
          <article class="grid gap-3" :data-testid="`purchase-card-${(item as PurchaseOrderRow).id}`">
            <div class="flex items-center justify-between gap-3"><strong class="font-mono text-[12px]">{{ (item as PurchaseOrderRow).code }}</strong><UiChip :tone="purchaseStatusTone((item as PurchaseOrderRow).status)">{{ purchaseStatusLabel((item as PurchaseOrderRow).status) }}</UiChip></div>
            <div><strong class="block font-medium">{{ (item as PurchaseOrderRow).supplierName }}</strong><span class="mt-0.5 block text-[10.5px] text-subtle">{{ orderDetail(item as PurchaseOrderRow) }}</span></div>
            <dl class="grid grid-cols-2 gap-3 text-[11px]"><div><dt class="text-subtle">Unidades</dt><dd class="m-0 mt-1 font-mono">{{ formatNumber((item as PurchaseOrderRow).totalUnits) }} · {{ (item as PurchaseOrderRow).lineCount }} productos</dd></div><div class="text-right"><dt class="text-subtle">Costo</dt><dd class="m-0 mt-1 font-mono">{{ formatMoney((item as PurchaseOrderRow).totalCost) }}</dd></div></dl>
            <UiButton
              v-if="(item as PurchaseOrderRow).status === 'PENDING'"
              class="w-full"
              :loading="receivingId === (item as PurchaseOrderRow).id"
              :disabled="Boolean(receivingId)"
              :data-testid="`purchase-receive-mobile-${(item as PurchaseOrderRow).id}`"
              @click="receiveOrder(item as PurchaseOrderRow)"
            ><IconPackageCheck class="size-4" aria-hidden="true" />Recibir</UiButton>
          </article>
        </template>
      </UiCardList>
    </template>

    <p class="mt-5 max-w-190 text-[12px] leading-relaxed text-muted">Al recibir una orden, el costo unitario actualiza el costo actual del producto y recalcula su margen. Las ventas anteriores conservan el costo que tenían al cobrarse.</p>

    <PurchasesPurchaseFormModal
      v-model:open="manualOpen"
      :products="products"
      :suppliers="suppliers"
      :created-product="createdProduct"
      @create-product="productCreateOpen = true"
      @created="afterManualPurchase"
    />
    <InventoryProductFormModal
      v-model:open="productCreateOpen"
      :categories="categories"
      :suppliers="suppliers"
      @created="afterProductCreated"
    />
  </section>
</template>
