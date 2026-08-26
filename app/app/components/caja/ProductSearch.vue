<script setup lang="ts">
import IconSearch from '~icons/lucide/search'
import type { Database } from '~/types/database'
import type { CartProduct } from '~/stores/cart'

type SearchRow = Database['public']['Functions']['search_products']['Returns'][number]
type FrequentRow = Database['public']['Functions']['frequent_products']['Returns'][number]

const emit = defineEmits<{ select: [CartProduct] }>()

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const { execute } = useSupabaseRequest()
const { formatMoney, formatNumber } = useMoney()

const term = ref('')
const results = ref<SearchRow[]>([])
const frequent = ref<FrequentRow[]>([])
const searching = ref(false)

const showingResults = computed(() => term.value.trim().length > 0)

function toCartProduct(row: SearchRow | FrequentRow): CartProduct {
  return { id: row.id, sku: row.sku, name: row.name, price: row.price, cost: row.cost, stock: row.stock }
}

async function loadFrequent() {
  const businessId = businessStore.activeBusinessId
  if (!businessId) return
  const data = await execute(client.rpc('frequent_products', { p_business: businessId, p_limit: 8 }))
  frequent.value = data ?? []
}

async function search() {
  const businessId = businessStore.activeBusinessId
  const query = term.value.trim()
  if (!businessId || !query) {
    results.value = []
    return
  }

  searching.value = true
  try {
    const data = await execute(client.rpc('search_products', { p_business: businessId, p_q: query, p_limit: 8 }))
    results.value = data ?? []
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
watch(term, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(search, 200)
})
onUnmounted(() => { if (timer) clearTimeout(timer) })

watch(() => businessStore.activeBusinessId, () => {
  term.value = ''
  results.value = []
  loadFrequent()
}, { immediate: true })

function choose(row: SearchRow | FrequentRow) {
  emit('select', toCartProduct(row))
  term.value = ''
  results.value = []
}

defineExpose({ loadFrequent })
</script>

<template>
  <section class="grid gap-4">
    <div class="relative">
      <label for="caja-search" class="mb-1.5 block text-[11px] font-semibold text-ink">Buscar producto</label>
      <IconSearch class="pointer-events-none absolute bottom-3 left-3 size-4 text-subtle" aria-hidden="true" />
      <PrimeInputText id="caja-search" v-model="term" class="!pl-9" placeholder="Nombre o SKU" autocomplete="off" data-testid="caja-search" fluid />
    </div>

    <div v-if="showingResults" class="rounded-[9px] border border-black/10 bg-panel" data-testid="caja-results">
      <p v-if="searching" class="m-0 p-4 text-muted">Buscando…</p>
      <p v-else-if="!results.length" class="m-0 p-4 text-muted">Ningún producto coincide con «{{ term }}».</p>
      <ul v-else class="m-0 list-none p-0">
        <li v-for="row in results" :key="row.id" class="border-b border-black/10 last:border-b-0">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-3 text-left transition-colors hover:bg-surface max-[760px]:min-h-11"
            :data-testid="`result-${row.sku}`"
            @click="choose(row)"
          >
            <span class="min-w-0">
              <strong class="block truncate font-semibold">{{ row.name }}</strong>
              <span class="font-mono text-[10.5px] text-subtle">{{ row.sku }}</span>
            </span>
            <span class="shrink-0 text-right">
              <strong class="block font-mono text-[13px]">{{ formatMoney(row.price) }}</strong>
              <span class="text-[10.5px]" :class="row.is_low_stock ? 'font-semibold text-negative' : 'text-subtle'">
                {{ formatNumber(row.stock) }} en stock
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <div v-else-if="frequent.length">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Más vendidos</p>
      <div class="flex flex-wrap gap-2" data-testid="caja-frequent">
        <button
          v-for="row in frequent"
          :key="row.id"
          type="button"
          class="grid min-h-11 cursor-pointer content-center gap-0.5 rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-left transition-colors hover:border-accent hover:bg-white"
          :data-testid="`frequent-${row.sku}`"
          @click="choose(row)"
        >
          <strong class="max-w-40 truncate text-[11.5px] font-semibold">{{ row.name }}</strong>
          <span class="font-mono text-[10.5px] text-muted">{{ formatMoney(row.price) }}</span>
        </button>
      </div>
    </div>

    <p v-else class="m-0 rounded-[9px] border border-dashed border-black/15 p-4 text-center text-muted">
      Los más vendidos aparecerán aquí en cuanto registres ventas.
    </p>
  </section>
</template>
