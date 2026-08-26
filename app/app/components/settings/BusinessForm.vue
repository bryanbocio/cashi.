<script setup lang="ts">
import { z } from 'zod'
import IconImage from '~icons/lucide/image'
import IconUpload from '~icons/lucide/upload'
import { currencyOptions, timezoneOptions } from '~/utils/business-options'

const MAX_LOGO_SIZE = 2 * 1024 * 1024
const schema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(80, 'Usa 80 caracteres o menos.'),
  nit: z.string().trim().max(30, 'Usa 30 caracteres o menos.'),
  phone: z.string().trim().max(30, 'Usa 30 caracteres o menos.'),
  address: z.string().trim().max(160, 'Usa 160 caracteres o menos.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Selecciona una moneda válida.'),
  timezone: z.string().min(1, 'Selecciona una zona horaria.'),
})

const client = useSupabaseClient()
const businessStore = useBusinessStore()
const { execute, notifyError } = useSupabaseRequest()
const form = reactive({ name: '', nit: '', phone: '', address: '', currency: 'COP', timezone: 'America/Bogota' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const saving = ref(false)
const uploading = ref(false)
const logoError = ref<string | null>(null)
const selectedLogo = ref<File | null>(null)
const storedLogoUrl = ref<string | null>(null)
const selectedLogoUrl = ref<string | null>(null)
let currentStoredObjectUrl: string | null = null
let currentSelectedObjectUrl: string | null = null

const canEdit = computed(() => businessStore.activeMembership?.role === 'OWNER')
const business = computed(() => businessStore.activeBusiness)
const displayLogoUrl = computed(() => selectedLogoUrl.value ?? storedLogoUrl.value)
const logoInitials = computed(() => {
  const parts = business.value?.name.split(/\s+/).filter(Boolean) ?? []
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '—'
})

function resetForm() {
  const current = business.value
  if (!current) return
  Object.assign(form, {
    name: current.name,
    nit: current.nit ?? '',
    phone: current.phone ?? '',
    address: current.address ?? '',
    currency: current.currency,
    timezone: current.timezone,
  })
}

async function loadStoredLogo(path?: string | null) {
  if (currentStoredObjectUrl) URL.revokeObjectURL(currentStoredObjectUrl)
  currentStoredObjectUrl = null
  storedLogoUrl.value = null
  if (!path) return

  const { data, error } = await client.storage.from('logos').download(path)
  if (error || !data) return
  currentStoredObjectUrl = URL.createObjectURL(data)
  storedLogoUrl.value = currentStoredObjectUrl
}

watch(business, resetForm, { immediate: true })
watch(() => business.value?.logo_path, path => loadStoredLogo(path), { immediate: true })

onUnmounted(() => {
  if (currentStoredObjectUrl) URL.revokeObjectURL(currentStoredObjectUrl)
  if (currentSelectedObjectUrl) URL.revokeObjectURL(currentSelectedObjectUrl)
})

function validate() {
  Object.keys(errors).forEach(key => delete errors[key as keyof typeof errors])
  const result = schema.safeParse(form)
  if (result.success) return result.data

  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof typeof form
    if (field && !errors[field]) errors[field] = issue.message
  }
}

async function submit() {
  const values = validate()
  const businessId = businessStore.activeBusinessId
  if (!values || !businessId || !canEdit.value || saving.value) return

  saving.value = true
  try {
    await execute(client
      .from('business')
      .update({
        name: values.name,
        nit: values.nit || null,
        phone: values.phone || null,
        address: values.address || null,
        currency: values.currency,
        timezone: values.timezone,
      })
      .eq('id', businessId)
      .select('id')
      .single(), { successMessage: 'Los datos del negocio fueron actualizados.' })

    await businessStore.loadMemberships(true)
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    saving.value = false
  }
}

function chooseLogo(event: Event) {
  logoError.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (file.type !== 'image/png') {
    logoError.value = 'Selecciona una imagen PNG.'
    return
  }
  if (file.size > MAX_LOGO_SIZE) {
    logoError.value = 'El logo debe pesar 2 MiB o menos.'
    return
  }

  if (currentSelectedObjectUrl) URL.revokeObjectURL(currentSelectedObjectUrl)
  currentSelectedObjectUrl = URL.createObjectURL(file)
  selectedLogoUrl.value = currentSelectedObjectUrl
  selectedLogo.value = file
}

async function uploadLogo() {
  const businessId = businessStore.activeBusinessId
  const file = selectedLogo.value
  if (!businessId || !canEdit.value || uploading.value) return
  if (!file) {
    logoError.value = 'Selecciona un archivo PNG antes de subirlo.'
    return
  }

  uploading.value = true
  logoError.value = null
  const path = `${businessId}/logo.png`

  try {
    await execute(client.storage.from('logos').upload(path, file, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: true,
    }))
    await execute(client
      .from('business')
      .update({ logo_path: path })
      .eq('id', businessId)
      .select('id')
      .single(), { successMessage: 'El logo del negocio fue actualizado.' })

    selectedLogo.value = null
    selectedLogoUrl.value = null
    if (currentSelectedObjectUrl) URL.revokeObjectURL(currentSelectedObjectUrl)
    currentSelectedObjectUrl = null
    await businessStore.loadMemberships(true)
    await loadStoredLogo(path)
  } catch (error) {
    if (!logoError.value) {
      logoError.value = 'No pudimos subir el logo. Inténtalo nuevamente.'
      if (!(error instanceof Error)) notifyError(error)
    }
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <article class="rounded-[10px] border border-black/10 bg-panel p-6 max-[600px]:p-4">
    <header class="mb-5">
      <p class="mb-1 text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Negocio activo</p>
      <h2 class="font-display text-xl font-bold tracking-[-.025em]">Datos del negocio</h2>
      <p class="mt-1 text-muted">Nombre, información comercial y formato de operación.</p>
    </header>

    <PrimeMessage v-if="!canEdit" severity="info" :closable="false" class="mb-5">
      Solo el propietario puede modificar estos datos.
    </PrimeMessage>

    <div class="mb-6 flex items-center gap-4 rounded-[9px] bg-surface p-4 max-[520px]:items-start">
      <span class="grid size-18 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-ink font-display text-lg font-bold text-white">
        <img v-if="displayLogoUrl" :src="displayLogoUrl" alt="Logo del negocio" class="size-full object-cover" />
        <span v-else>{{ logoInitials }}</span>
      </span>
      <div class="min-w-0 flex-1">
        <strong class="block">Logotipo</strong>
        <p class="mb-3 text-[11px] text-muted">PNG de hasta 2 MiB. Se guarda de forma privada.</p>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[7px] border border-black/15 bg-panel px-3 font-semibold transition-colors hover:bg-white" :class="!canEdit || uploading ? 'pointer-events-none opacity-50' : ''">
            <IconImage class="size-4" aria-hidden="true" />Seleccionar PNG
            <input class="sr-only" type="file" accept="image/png,.png" :disabled="!canEdit || uploading" @change="chooseLogo" />
          </label>
          <UiButton :disabled="!selectedLogo || !canEdit" :loading="uploading" @click="uploadLogo">
            <IconUpload class="size-4" aria-hidden="true" />Subir logo
          </UiButton>
        </div>
        <p v-if="selectedLogo" class="mt-2 truncate text-[11px] text-muted">{{ selectedLogo.name }}</p>
        <p v-if="logoError" class="mt-2 text-[11px] text-negative" role="alert">{{ logoError }}</p>
      </div>
    </div>

    <form class="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1" novalidate @submit.prevent="submit">
      <AuthField id="settings-business-name" v-model="form.name" label="Nombre del negocio" autocomplete="organization" :error="errors.name" :disabled="!canEdit || saving" />
      <AuthField id="settings-business-nit" v-model="form.nit" label="NIT o identificación fiscal" :error="errors.nit" :disabled="!canEdit || saving" />
      <AuthField id="settings-business-phone" v-model="form.phone" label="Teléfono" autocomplete="tel" :error="errors.phone" :disabled="!canEdit || saving" />
      <AuthField id="settings-business-address" v-model="form.address" label="Dirección" autocomplete="street-address" :error="errors.address" :disabled="!canEdit || saving" />

      <div>
        <label for="settings-business-currency" class="mb-1.5 block text-[11px] font-semibold text-ink">Moneda</label>
        <PrimeSelect id="settings-business-currency" v-model="form.currency" :options="currencyOptions" option-label="label" option-value="value" :disabled="!canEdit || saving" fluid />
      </div>
      <div>
        <label for="settings-business-timezone" class="mb-1.5 block text-[11px] font-semibold text-ink">Zona horaria</label>
        <PrimeSelect id="settings-business-timezone" v-model="form.timezone" :options="timezoneOptions" option-label="label" option-value="value" filter filter-placeholder="Busca una ciudad" :disabled="!canEdit || saving" fluid />
      </div>

      <div class="col-span-2 mt-1 flex justify-end max-[680px]:col-span-1">
        <UiButton class="max-[680px]:w-full" type="submit" :disabled="!canEdit" :loading="saving">Guardar negocio</UiButton>
      </div>
    </form>
  </article>
</template>
