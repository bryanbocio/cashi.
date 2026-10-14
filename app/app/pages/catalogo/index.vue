<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconCopy from '~icons/lucide/copy'
import IconExternalLink from '~icons/lucide/external-link'
import IconEyeOff from '~icons/lucide/eye-off'
import IconGlobe from '~icons/lucide/globe-2'
import IconMessageCircle from '~icons/lucide/message-circle'
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Catálogo público · Cashi' })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const requestUrl = useRequestURL()

const saving = ref(false)
const copied = ref(false)
const business = computed(() => businessStore.activeBusiness)
const canEdit = computed(() => businessStore.activeMembership?.role === 'OWNER')
const catalogUrl = computed(() => {
  const token = business.value?.catalog_token
  return token ? `${requestUrl.origin}/catalogo/${token}` : ''
})

async function copyLink() {
  if (!catalogUrl.value) return
  try {
    await navigator.clipboard.writeText(catalogUrl.value)
    copied.value = true
    toast.add({ severity: 'success', summary: 'Enlace copiado', detail: 'Ya puedes enviárselo a tus clientes.', life: 3000 })
    window.setTimeout(() => { copied.value = false }, 1800)
  } catch {
    toast.add({ severity: 'error', summary: 'No se pudo copiar', detail: 'Selecciona el enlace y cópialo manualmente.', life: 4000 })
  }
}

function shareOnWhatsApp() {
  if (!catalogUrl.value || !business.value) return
  const message = `Mira el catálogo de ${business.value.name}: ${catalogUrl.value}`
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
}

async function toggleCatalog() {
  const current = business.value
  if (!current || !canEdit.value || saving.value) return
  saving.value = true
  const enabled = !current.catalog_enabled
  try {
    await execute(client
      .from('business')
      .update({ catalog_enabled: enabled })
      .eq('id', current.id)
      .select('id')
      .single(), {
        successMessage: enabled ? 'El catálogo ya está visible.' : 'El catálogo fue desactivado.',
      })
    await businessStore.loadMemberships(true)
  } catch {
    // useSupabaseRequest presenta el error seguro.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Vitrina digital</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Catálogo público</h1>
      <p class="max-w-180 text-[13.5px] text-muted">Comparte tus productos y precios con cualquier cliente, sin pedirle una cuenta.</p>
    </header>

    <article class="overflow-hidden rounded-[12px] border border-black/10 bg-panel">
      <div class="grid grid-cols-[1fr_auto] gap-6 border-b border-black/10 bg-[linear-gradient(135deg,#eef3ff_0%,#ffffff_58%,#f3f0e9_100%)] p-7 max-[700px]:grid-cols-1 max-[700px]:p-5">
        <div class="min-w-0">
          <span class="mb-4 grid size-11 place-items-center rounded-[10px] bg-accent text-white shadow-[0_8px_22px_rgba(31,90,255,.24)]">
            <IconGlobe class="size-5" aria-hidden="true" />
          </span>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <h2 class="font-display text-[22px] font-bold tracking-[-.03em]">{{ business?.name }}</h2>
            <UiChip :tone="business?.catalog_enabled ? 'positive' : 'negative'">
              {{ business?.catalog_enabled ? 'Publicado' : 'Desactivado' }}
            </UiChip>
          </div>
          <p class="max-w-160 text-[12.5px] leading-5 text-muted">
            El catálogo muestra productos activos, precios de venta y disponibilidad. Los costos, proveedores y cantidades nunca son públicos.
          </p>
        </div>

        <div class="flex items-start max-[700px]:w-full">
          <UiButton
            :variant="business?.catalog_enabled ? 'secondary' : 'primary'"
            :disabled="!canEdit"
            :loading="saving"
            class="max-[700px]:w-full"
            data-testid="catalog-toggle"
            @click="toggleCatalog"
          >
            <IconEyeOff v-if="business?.catalog_enabled" class="size-4" aria-hidden="true" />
            <IconGlobe v-else class="size-4" aria-hidden="true" />
            {{ business?.catalog_enabled ? 'Desactivar catálogo' : 'Publicar catálogo' }}
          </UiButton>
        </div>
      </div>

      <div class="p-7 max-[700px]:p-5">
        <label for="catalog-public-url" class="mb-2 block text-[11px] font-semibold text-ink">Enlace para tus clientes</label>
        <div class="flex gap-2 max-[700px]:flex-col">
          <PrimeInputText id="catalog-public-url" :model-value="catalogUrl" readonly class="min-w-0 flex-1 font-mono text-[11px]" data-testid="catalog-url" />
          <UiButton variant="secondary" class="shrink-0 max-[700px]:w-full" data-testid="catalog-copy" @click="copyLink">
            <IconCheck v-if="copied" class="size-4" aria-hidden="true" />
            <IconCopy v-else class="size-4" aria-hidden="true" />
            {{ copied ? 'Copiado' : 'Copiar enlace' }}
          </UiButton>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 max-[700px]:grid">
          <UiButton :disabled="!business?.catalog_enabled" data-testid="catalog-whatsapp" @click="shareOnWhatsApp">
            <IconMessageCircle class="size-4" aria-hidden="true" />Compartir por WhatsApp
          </UiButton>
          <a
            v-if="catalogUrl"
            :href="catalogUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-10 items-center justify-center gap-2 rounded-[7px] border border-black/15 bg-panel px-3 font-semibold text-ink no-underline transition-colors hover:bg-surface max-[760px]:min-h-11"
            data-testid="catalog-preview"
          ><IconExternalLink class="size-4" aria-hidden="true" />Ver como cliente</a>
        </div>

        <p v-if="!canEdit" class="mt-4 text-[11px] text-muted">Solo el propietario puede publicar o desactivar el catálogo.</p>
      </div>
    </article>
  </section>
</template>
