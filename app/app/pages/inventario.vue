<script setup lang="ts">
import IconPlus from '~icons/lucide/plus'
import IconSearch from '~icons/lucide/search'
import IconUpload from '~icons/lucide/upload'
import type { Database } from '~/types/database'
import type { DataTableColumn } from '~/components/ui/DataTable.vue'
import type { ProductRow } from '~/utils/inventory'
import { PRODUCT_STATS_COLUMNS, sanitizeSearch, toProductRow } from '~/utils/inventory'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Inventario · Cashi' })

type Option = { label: string; value: string }

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const { execute } = useSupabaseRequest()
const { formatMoney, formatNumber, formatPercent } = useMoney()

const stockFilters = [
  { label: 'Todos', value: 'all' },
  { label: 'Stock bajo', value: 'low' },
  { label: 'Margen bajo', value: 'thin' },
]

const search = ref('')
const stockFilter = ref('all')
const categoryId = ref<string | null>(null)
const supplierId = ref<string | null>(null)

const rows = ref<ProductRow[]>([])
const categories = ref<Option[]>([])
const suppliers = ref<Option[]>([])
const inventoryTotal = ref(0)
const inventoryProductCount = ref(0)
const summaryLoading = ref(true)
const loading = ref(true)
const panelOpen = ref(false)
const createOpen = ref(false)
const importOpen = ref(false)
const selectedId = ref<string | null>(null)

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Producto' },
  { key: 'categoryName', label: 'Categoría', hideOnNarrow: true },
  { key: 'cost', label: 'Costo', align: 'right', mono: true },
  { key: 'price', label: 'Precio', align: 'right', mono: true },
  { key: 'marginPct', label: 'Margen', align: 'right' },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'inventoryValue', label: 'Valor', align: 'right', mono: true },
]

const selectedProduct = computed(() => rows.value.find(row => row.id === selectedId.value) ?? null)
const hasFilters = computed(() => Boolean(
  search.value.trim() || stockFilter.value !== 'all' || categoryId.value || supplierId.value,
))
const emptyMessage = computed(() => (hasFilters.value
  ? 'Ningún producto coincide con los filtros.'
  : 'Este negocio todavía no tiene productos.'))

async function loadFacets(businessId: string) {
  const [categoryRows, supplierRows] = await Promise.all([
    execute(client.from('category').select('id, name').eq('business_id', businessId).order('name')),
    execute(client.from('supplier').select('id, name').eq('business_id', businessId).order('name')),
  ])

  categories.value = (categoryRows ?? []).map(item => ({ label: item.name, value: item.id }))
  suppliers.value = (supplierRows ?? []).map(item => ({ label: item.name, value: item.id }))
}

async function loadInventorySummary(businessId = businessStore.activeBusinessId) {
  if (!businessId) return
  summaryLoading.value = true
  try {
    const data = await execute(client
      .from('v_inventory_summary')
      .select('inventory_value, product_count')
      .eq('business_id', businessId)
      .maybeSingle())
    if (businessStore.activeBusinessId === businessId) {
      inventoryTotal.value = data?.inventory_value ?? 0
      inventoryProductCount.value = data?.product_count ?? 0
    }
  } catch {
    if (businessStore.activeBusinessId === businessId) {
      inventoryTotal.value = 0
      inventoryProductCount.value = 0
    }
  } finally {
    if (businessStore.activeBusinessId === businessId) summaryLoading.value = false
  }
}

async function loadProducts() {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return

  loading.value = true
  try {
    let query = client
      .from('v_product_stats')
      .select(PRODUCT_STATS_COLUMNS)
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name')

    const term = sanitizeSearch(search.value)
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
    if (stockFilter.value === 'low') query = query.eq('is_low_stock', true)
    if (stockFilter.value === 'thin') query = query.eq('is_thin_margin', true)
    if (categoryId.value) query = query.eq('category_id', categoryId.value)
    if (supplierId.value) query = query.eq('supplier_id', supplierId.value)

    const data = await execute(query)
    rows.value = (data ?? []).map(toProductRow)
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadProducts, 250)
})
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })

watch([stockFilter, categoryId, supplierId], loadProducts)

watch(() => businessStore.activeBusinessId, async businessId => {
  selectedId.value = null
  panelOpen.value = false
  if (!businessId) return
  await Promise.all([loadFacets(businessId), loadProducts(), loadInventorySummary(businessId)])
}, { immediate: true })

async function reloadAll() {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return
  await Promise.all([loadFacets(businessId), loadProducts(), loadInventorySummary(businessId)])
}

async function reloadProductsAndSummary() {
  await Promise.all([loadProducts(), loadInventorySummary()])
}

function openProduct(product: ProductRow) {
  selectedId.value = product.id
  panelOpen.value = true
}

function clearFilters() {
  search.value = ''
  stockFilter.value = 'all'
  categoryId.value = null
  supplierId.value = null
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5 flex items-start justify-between gap-4 max-[760px]:flex-col">
      <div>
        <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Catálogo</p>
        <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Inventario</h1>
        <p class="max-w-155 text-[13.5px] text-muted">Controla costos, precios, existencias y niveles mínimos de reposición.</p>
      </div>
      <div class="flex shrink-0 gap-2 max-[760px]:w-full max-[760px]:flex-col">
        <UiButton variant="secondary" class="max-[760px]:w-full" data-testid="open-import" @click="importOpen = true">
          <IconUpload class="size-4" aria-hidden="true" />Importar CSV
        </UiButton>
        <UiButton class="max-[760px]:w-full" data-testid="open-create" @click="createOpen = true">
          <IconPlus class="size-4" aria-hidden="true" />Nuevo producto
        </UiButton>
      </div>
    </header>

    <div class="mb-5 flex items-center justify-between gap-5 rounded-[9px] border border-black/10 bg-panel px-5 py-4 max-[760px]:items-start max-[760px]:px-4" data-testid="inventory-summary">
      <div>
        <p class="mb-1 font-mono text-[9.5px] font-medium tracking-[.05em] text-subtle uppercase">Valor total del inventario</p>
        <PrimeSkeleton v-if="summaryLoading" width="10rem" height="2rem" />
        <strong v-else class="block font-display text-[28px] leading-tight tracking-[-.03em]" data-testid="inventory-total-value">{{ formatMoney(inventoryTotal) }}</strong>
        <span class="mt-1 block text-[11px] text-muted">Costo × existencias · {{ inventoryProductCount }} {{ inventoryProductCount === 1 ? 'producto activo' : 'productos activos' }}</span>
      </div>
    </div>

    <div class="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[1120px]:grid-cols-1">
      <div class="grid grid-cols-3 gap-3 max-[1120px]:grid-cols-2 max-[760px]:grid-cols-1">
        <div class="relative max-[1120px]:col-span-2 max-[760px]:col-span-1">
          <label for="inventory-search" class="mb-1.5 block text-[11px] font-semibold text-ink">Buscar</label>
          <IconSearch class="pointer-events-none absolute bottom-3 left-3 size-4 text-subtle" aria-hidden="true" />
          <PrimeInputText id="inventory-search" v-model="search" class="!pl-9" placeholder="Nombre o SKU" autocomplete="off" fluid />
        </div>
        <div>
          <label for="inventory-category" class="mb-1.5 block text-[11px] font-semibold text-ink">Categoría</label>
          <PrimeSelect id="inventory-category" v-model="categoryId" :options="categories" option-label="label" option-value="value" placeholder="Todas" show-clear fluid />
        </div>
        <div>
          <label for="inventory-supplier" class="mb-1.5 block text-[11px] font-semibold text-ink">Proveedor</label>
          <PrimeSelect id="inventory-supplier" v-model="supplierId" :options="suppliers" option-label="label" option-value="value" placeholder="Todos" show-clear fluid />
        </div>
      </div>
      <UiSegmented v-model="stockFilter" :options="stockFilters" label="Filtrar productos" class="max-[760px]:[&_.p-selectbutton]:w-full" />
    </div>

    <div v-if="loading" class="rounded-[9px] border border-black/10 bg-panel p-6" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="11.25rem" height="1.125rem" class="mb-5.5" />
      <PrimeSkeleton v-for="line in 6" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 7}%`" />
    </div>

    <template v-else>
      <p class="mb-3 text-[11px] text-muted" aria-live="polite" data-testid="inventory-count">
        {{ rows.length }} {{ rows.length === 1 ? 'producto' : 'productos' }}
        <button v-if="hasFilters" type="button" class="ml-2 cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline" @click="clearFilters">Quitar filtros</button>
      </p>

      <UiDataTable :columns="columns" :rows="rows" :empty-message="emptyMessage" @row-click="openProduct($event.data)">
        <template #cell-name="{ row }">
          <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-left" :data-testid="`row-${(row as ProductRow).sku}`" @click="openProduct(row as ProductRow)">
            <strong class="block font-semibold">{{ (row as ProductRow).name }}</strong>
            <span class="font-mono text-[10.5px] text-subtle">{{ (row as ProductRow).sku }}</span>
          </button>
        </template>
        <template #cell-categoryName="{ row }">
          <span class="text-muted">{{ (row as ProductRow).categoryName ?? 'Sin categoría' }}</span>
        </template>
        <template #cell-cost="{ row }">{{ formatMoney((row as ProductRow).cost) }}</template>
        <template #cell-price="{ row }">{{ formatMoney((row as ProductRow).price) }}</template>
        <template #cell-marginPct="{ row }">
          <span :class="(row as ProductRow).isThinMargin ? 'font-semibold text-negative' : ''">{{ formatPercent((row as ProductRow).marginPct) }}</span>
        </template>
        <template #cell-stock="{ row }">
          <span class="font-mono">{{ formatNumber((row as ProductRow).stock) }} / {{ formatNumber((row as ProductRow).minStock) }}</span>
          <UiChip v-if="(row as ProductRow).isLowStock" tone="negative" class="ml-2">Bajo</UiChip>
        </template>
        <template #cell-inventoryValue="{ row }">{{ formatMoney((row as ProductRow).inventoryValue) }}</template>
      </UiDataTable>

      <UiCardList :items="rows" :empty-message="emptyMessage">
        <template #default="{ item }">
          <div class="grid gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <strong class="block font-semibold">{{ (item as ProductRow).name }}</strong>
                <span class="font-mono text-[10.5px] text-subtle">{{ (item as ProductRow).sku }}</span>
              </div>
              <strong class="shrink-0 font-mono text-[13px]">{{ formatMoney((item as ProductRow).inventoryValue) }}</strong>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <UiChip>{{ (item as ProductRow).categoryName ?? 'Sin categoría' }}</UiChip>
              <UiChip v-if="(item as ProductRow).isLowStock" tone="negative">Stock bajo</UiChip>
              <UiChip v-if="(item as ProductRow).isThinMargin" tone="negative">Margen bajo</UiChip>
            </div>

            <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div class="flex justify-between gap-2"><dt class="text-subtle">Costo</dt><dd class="m-0 font-mono">{{ formatMoney((item as ProductRow).cost) }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-subtle">Precio</dt><dd class="m-0 font-mono">{{ formatMoney((item as ProductRow).price) }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-subtle">Margen</dt><dd class="m-0 font-mono">{{ formatPercent((item as ProductRow).marginPct) }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-subtle">Stock</dt><dd class="m-0 font-mono">{{ formatNumber((item as ProductRow).stock) }} / {{ formatNumber((item as ProductRow).minStock) }}</dd></div>
            </dl>

            <UiButton class="w-full" variant="secondary" :data-testid="`card-${(item as ProductRow).sku}`" @click="openProduct(item as ProductRow)">Editar producto</UiButton>
          </div>
        </template>
      </UiCardList>
    </template>

    <InventoryProductPanel v-model:open="panelOpen" :product="selectedProduct" @saved="reloadProductsAndSummary" />
    <InventoryProductFormModal v-model:open="createOpen" :categories="categories" :suppliers="suppliers" @created="reloadAll" />
    <InventoryImportModal v-model:open="importOpen" @imported="reloadAll" />
  </section>
</template>
