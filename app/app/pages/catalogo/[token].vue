<script setup lang="ts">
import IconMapPin from '~icons/lucide/map-pin'
import IconPackageOpen from '~icons/lucide/package-open'
import IconPhone from '~icons/lucide/phone'
import IconSearch from '~icons/lucide/search'
import IconStore from '~icons/lucide/store'
import { MONEY_LOCALE } from '~/composables/useMoney'
import { toPublicCatalog } from '~/utils/catalog'

definePageMeta({ layout: false })

const route = useRoute()
const token = String(route.params.token ?? '')
const loadFailed = ref(false)
const loading = ref(true)
const catalog = ref<ReturnType<typeof toPublicCatalog>>(null)

try {
  const data = await $fetch(`/api/catalog/${encodeURIComponent(token)}`)
  catalog.value = toPublicCatalog(data)
} catch {
  loadFailed.value = true
} finally {
  loading.value = false
}

useSeoMeta({
  title: () => catalog.value ? `${catalog.value.business.name} · Catálogo` : 'Catálogo no disponible · Cashi',
  description: () => catalog.value
    ? `Consulta los productos y precios de ${catalog.value.business.name}.`
    : 'Este catálogo no está disponible.',
  robots: () => catalog.value ? 'index, follow' : 'noindex, nofollow',
})

const search = ref('')
const selectedCategory = ref('Todas')
const categories = computed(() => [
  'Todas',
  ...Array.from(new Set(catalog.value?.products.map(product => product.category ?? 'Otros') ?? [])).sort((a, b) => a.localeCompare(b, 'es')),
])
const visibleProducts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')
  return (catalog.value?.products ?? []).filter(product => {
    const category = product.category ?? 'Otros'
    const matchesCategory = selectedCategory.value === 'Todas' || category === selectedCategory.value
    const matchesSearch = !term || product.name.toLocaleLowerCase('es').includes(term) || category.toLocaleLowerCase('es').includes(term)
    return matchesCategory && matchesSearch
  })
})
const initials = computed(() => catalog.value?.business.name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('') || 'C')
const phoneHref = computed(() => catalog.value?.business.phone
  ? `tel:${catalog.value.business.phone.replace(/[^+\d]/g, '')}`
  : '')

function formatMoney(amount: number) {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency: catalog.value?.business.currency ?? 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function productInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}
</script>

<template>
  <div class="min-h-screen bg-paper text-ink">
    <div v-if="loading" class="mx-auto max-w-300 px-5 py-16" aria-live="polite" aria-busy="true">
      <PrimeSkeleton width="12rem" height="2rem" class="mb-5" />
      <PrimeSkeleton height="10rem" class="mb-8" />
      <div class="grid grid-cols-3 gap-4 max-[850px]:grid-cols-2 max-[560px]:grid-cols-1">
        <PrimeSkeleton v-for="item in 6" :key="item" height="14rem" />
      </div>
    </div>

    <main v-else-if="catalog" class="pb-16">
      <header class="border-b border-black/10 bg-panel">
        <div class="mx-auto flex max-w-300 items-center justify-between gap-4 px-5 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-[10px] bg-ink font-display text-[13px] font-bold text-white">{{ initials }}</span>
            <div class="min-w-0">
              <strong class="block truncate font-display text-[17px] tracking-[-.02em]">{{ catalog.business.name }}</strong>
              <span class="block text-[10px] text-subtle">Catálogo en línea</span>
            </div>
          </div>
          <span class="font-display text-lg font-bold tracking-[-.04em] text-ink">cashi<span class="text-accent">.</span></span>
        </div>
      </header>

      <section class="border-b border-black/10 bg-[radial-gradient(circle_at_85%_15%,rgba(31,90,255,.16),transparent_28%),linear-gradient(135deg,#eef3ff_0%,#fbfaf6_62%)]">
        <div class="mx-auto max-w-300 px-5 py-12 max-[600px]:py-9">
          <p class="mb-3 text-[10px] font-semibold tracking-[.12em] text-accent uppercase">Compra en {{ catalog.business.name }}</p>
          <h1 class="max-w-190 font-display text-[clamp(32px,6vw,58px)] leading-[1.02] font-bold tracking-[-.055em]">Encuentra lo que buscas.</h1>
          <p class="mt-4 max-w-150 text-[14px] leading-6 text-muted">Explora nuestros productos, consulta precios y disponibilidad sin registrarte.</p>
          <div v-if="catalog.business.phone || catalog.business.address" class="mt-6 flex flex-wrap gap-3 text-[11.5px] text-muted">
            <a v-if="catalog.business.phone" :href="phoneHref" class="inline-flex items-center gap-1.5 text-inherit no-underline hover:text-ink"><IconPhone class="size-4" aria-hidden="true" />{{ catalog.business.phone }}</a>
            <span v-if="catalog.business.address" class="inline-flex items-center gap-1.5"><IconMapPin class="size-4" aria-hidden="true" />{{ catalog.business.address }}</span>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-300 px-5 pt-8">
        <div class="mb-5 flex items-end justify-between gap-4 max-[700px]:items-stretch max-[700px]:flex-col">
          <div>
            <p class="mb-1 text-[10px] font-semibold tracking-[.09em] text-subtle uppercase">Productos</p>
            <h2 class="font-display text-[25px] font-bold tracking-[-.035em]">Nuestro catálogo</h2>
          </div>
          <div class="relative w-full max-w-90 max-[700px]:max-w-none">
            <label for="public-catalog-search" class="sr-only">Buscar productos</label>
            <IconSearch class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <PrimeInputText id="public-catalog-search" v-model="search" class="!pl-9" placeholder="Buscar productos" autocomplete="off" fluid />
          </div>
        </div>

        <div class="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por categoría">
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="min-h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-[11px] font-semibold transition-colors"
            :class="selectedCategory === category ? 'border-ink bg-ink text-white' : 'border-black/10 bg-panel text-muted hover:border-black/25 hover:text-ink'"
            @click="selectedCategory = category"
          >{{ category }}</button>
        </div>

        <p class="mb-4 text-[11px] text-muted" aria-live="polite">{{ visibleProducts.length }} {{ visibleProducts.length === 1 ? 'producto' : 'productos' }}</p>

        <div v-if="visibleProducts.length" class="grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1" data-testid="public-catalog-products">
          <article
            v-for="product in visibleProducts"
            :key="product.id"
            class="group overflow-hidden rounded-[12px] border border-black/10 bg-panel transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_14px_34px_rgba(25,24,23,.09)]"
            :data-testid="`catalog-product-${product.id}`"
          >
            <div class="grid h-34 place-items-center bg-[linear-gradient(145deg,#f3f0e9,#eef3ff)]">
              <span class="grid size-16 place-items-center rounded-2xl border border-white/80 bg-white/75 font-display text-[20px] font-bold tracking-[-.04em] text-accent shadow-sm backdrop-blur">{{ productInitials(product.name) }}</span>
            </div>
            <div class="p-4.5">
              <div class="mb-3 flex items-center justify-between gap-2">
                <span class="truncate text-[10px] font-semibold tracking-[.06em] text-subtle uppercase">{{ product.category ?? 'Otros' }}</span>
                <span class="shrink-0 rounded-full px-2 py-1 text-[9.5px] font-semibold" :class="product.available ? 'bg-[#e8f5f1] text-positive' : 'bg-[#f8ece7] text-negative'">
                  {{ product.available ? 'Disponible' : 'Agotado' }}
                </span>
              </div>
              <h3 class="min-h-10 font-display text-[16px] leading-5 font-semibold tracking-[-.02em]">{{ product.name }}</h3>
              <strong class="mt-3 block font-mono text-[17px] text-ink" :data-testid="`catalog-price-${product.id}`">{{ formatMoney(product.price) }}</strong>
            </div>
          </article>
        </div>

        <div v-else class="grid min-h-60 place-items-center rounded-[12px] border border-dashed border-black/15 bg-panel p-8 text-center">
          <div>
            <IconPackageOpen class="mx-auto mb-3 size-8 text-subtle" aria-hidden="true" />
            <strong class="block font-display text-[17px]">No encontramos productos</strong>
            <p class="mt-1 text-[12px] text-muted">Prueba con otra búsqueda o categoría.</p>
          </div>
        </div>
      </section>
    </main>

    <main v-else class="grid min-h-screen place-items-center px-5 py-12">
      <section class="w-full max-w-110 rounded-[14px] border border-black/10 bg-panel p-8 text-center shadow-[0_18px_50px_rgba(25,24,23,.08)]">
        <span class="mx-auto mb-5 grid size-14 place-items-center rounded-[12px] bg-surface"><IconStore class="size-6 text-subtle" aria-hidden="true" /></span>
        <h1 class="font-display text-[24px] font-bold tracking-[-.04em]">Catálogo no disponible</h1>
        <p class="mx-auto mt-2 max-w-80 text-[13px] leading-5 text-muted">Este enlace no existe o la tienda desactivó temporalmente su catálogo.</p>
        <p v-if="loadFailed" class="mt-4 text-[11px] text-negative">No pudimos conectarnos. Inténtalo nuevamente en unos minutos.</p>
        <span class="mt-6 block font-display text-lg font-bold tracking-[-.04em]">cashi<span class="text-accent">.</span></span>
      </section>
    </main>
  </div>
</template>
