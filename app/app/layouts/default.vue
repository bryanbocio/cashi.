<script setup lang="ts">
import IconBarChart from '~icons/lucide/chart-no-axes-combined'
import IconFile from '~icons/lucide/file-text'
import IconHandCoins from '~icons/lucide/hand-coins'
import IconLayout from '~icons/lucide/layout-dashboard'
import IconMenu from '~icons/lucide/menu'
import IconPackage from '~icons/lucide/package-search'
import IconReceipt from '~icons/lucide/receipt-text'
import IconSettings from '~icons/lucide/settings'
import IconShoppingCart from '~icons/lucide/shopping-cart'
import IconTruck from '~icons/lucide/truck'

const route = useRoute()
const drawerOpen = ref(false)
const navigation = [
  { label: 'Resumen', to: '/', icon: IconLayout },
  { label: 'Caja', to: '/caja', icon: IconShoppingCart },
  { label: 'Cotizaciones', to: '/cotizaciones', icon: IconFile },
  { label: 'Inventario', to: '/inventario', icon: IconPackage },
  { label: 'Fiados', to: '/fiados', icon: IconHandCoins },
  { label: 'Gastos', to: '/gastos', icon: IconReceipt },
  { label: 'Compras', to: '/compras', icon: IconTruck },
  { label: 'Reportes', to: '/reportes', icon: IconBarChart },
  { label: 'Ajustes', to: '/ajustes', icon: IconSettings },
]

watch(() => route.fullPath, () => { drawerOpen.value = false })
</script>

<template>
  <div class="min-h-screen bg-paper text-ink">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-(--sidebar-width) border-r border-black/10 bg-panel min-[760px]:block" aria-label="Navegación principal">
      <AppSidebarContent :navigation="navigation" />
    </aside>

    <header class="sticky top-0 z-15 grid min-h-15 grid-cols-[44px_1fr_44px] items-center border-b border-black/10 bg-paper/95 px-3 py-2 backdrop-blur-xl min-[760px]:hidden">
      <button class="grid size-11 cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent" type="button" aria-label="Abrir navegación" aria-controls="mobile-navigation" :aria-expanded="drawerOpen" @click="drawerOpen = true">
        <IconMenu class="size-5" aria-hidden="true" />
      </button>
      <NuxtLink class="justify-self-center font-display text-[21px] font-bold tracking-[-.04em]" to="/">cashi<span class="text-accent">.</span></NuxtLink>
      <BusinessSwitcher compact />
    </header>

    <UiDrawer v-model="drawerOpen" drawer-id="mobile-navigation">
      <AppSidebarContent :navigation="navigation" @action="drawerOpen = false" />
    </UiDrawer>

    <main class="min-h-screen min-[760px]:ml-(--sidebar-width)"><slot /></main>
  </div>
</template>
