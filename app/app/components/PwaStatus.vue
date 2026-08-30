<script setup lang="ts">
const { $pwa } = useNuxtApp()

const online = ref(true)

const installAvailable = computed(() => Boolean($pwa?.showInstallPrompt))
const updateAvailable = computed(() => Boolean($pwa?.needRefresh))

function updateConnectivity() {
  online.value = navigator.onLine
}

async function install() {
  await $pwa?.install()
}

async function update() {
  await $pwa?.updateServiceWorker(true)
}

onMounted(() => {
  updateConnectivity()
  window.addEventListener('online', updateConnectivity)
  window.addEventListener('offline', updateConnectivity)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnectivity)
  window.removeEventListener('offline', updateConnectivity)
})
</script>

<template>
  <div
    v-if="!online"
    class="fixed inset-0 z-[10000] grid place-items-center bg-ink/45 px-5 backdrop-blur-[2px]"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="offline-title"
    aria-describedby="offline-description"
    data-testid="pwa-offline-guard"
  >
    <section class="w-full max-w-100 rounded-xl border border-surface bg-panel p-6 text-center shadow-2xl">
      <img src="/pwa-192x192.png" alt="" class="mx-auto mb-4 size-16 rounded-[15px]" aria-hidden="true">
      <p class="mb-2 font-mono text-[10px] font-medium tracking-[.08em] text-accent uppercase">Sin conexión</p>
      <h2 id="offline-title" class="font-display text-[22px] font-semibold tracking-[-.03em] text-ink">Cashi necesita internet</h2>
      <p id="offline-description" class="mx-auto mt-2 max-w-78 text-[13px] leading-5 text-muted">
        Tus datos no se guardan en este dispositivo. Las ventas y demás operaciones quedan pausadas hasta recuperar la conexión.
      </p>
      <PrimeButton class="mt-5 min-h-11 w-full" label="Intentar nuevamente" @click="updateConnectivity" />
    </section>
  </div>

  <aside
    v-else-if="updateAvailable"
    class="fixed right-4 bottom-4 z-[9000] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-[#bdceff] bg-panel p-3 shadow-xl"
    role="status"
    data-testid="pwa-update-prompt"
  >
    <p class="text-[12.5px] text-ink">Hay una nueva versión de Cashi.</p>
    <PrimeButton class="min-h-11" size="small" label="Actualizar" @click="update" />
    <button class="min-h-11 px-2 text-[12px] text-muted underline" type="button" @click="$pwa?.cancelPrompt()">Después</button>
  </aside>

  <aside
    v-else-if="installAvailable"
    class="fixed right-4 bottom-4 z-[9000] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-surface bg-panel p-3 shadow-xl"
    role="status"
    data-testid="pwa-install-prompt"
  >
    <img src="/pwa-192x192.png" alt="" class="size-10 rounded-[9px]" aria-hidden="true">
    <p class="text-[12.5px] text-ink">Instala Cashi en este dispositivo.</p>
    <PrimeButton class="min-h-11" size="small" label="Instalar" @click="install" />
    <button class="min-h-11 px-2 text-[12px] text-muted underline" type="button" @click="$pwa?.cancelInstall()">Ahora no</button>
  </aside>
</template>
