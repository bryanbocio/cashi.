<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Crear negocio · Cashi' })

const route = useRoute()
const client = useSupabaseClient()
const businessStore = useBusinessStore()
const { execute, notifyError } = useSupabaseRequest()
const invalidBusiness = computed(() => route.query.reason === 'invalid-business')

const currencies = [
  { label: 'Peso colombiano (COP)', value: 'COP' },
  { label: 'Peso dominicano (DOP)', value: 'DOP' },
  { label: 'Dólar estadounidense (USD)', value: 'USD' },
  { label: 'Peso mexicano (MXN)', value: 'MXN' },
  { label: 'Sol peruano (PEN)', value: 'PEN' },
  { label: 'Euro (EUR)', value: 'EUR' },
]

const timezones = [
  { label: 'Bogotá (America/Bogota)', value: 'America/Bogota' },
  { label: 'Santo Domingo (America/Santo_Domingo)', value: 'America/Santo_Domingo' },
  { label: 'Ciudad de México (America/Mexico_City)', value: 'America/Mexico_City' },
  { label: 'Lima (America/Lima)', value: 'America/Lima' },
  { label: 'Panamá (America/Panama)', value: 'America/Panama' },
  { label: 'Caracas (America/Caracas)', value: 'America/Caracas' },
  { label: 'Santiago (America/Santiago)', value: 'America/Santiago' },
  { label: 'Buenos Aires (America/Argentina/Buenos_Aires)', value: 'America/Argentina/Buenos_Aires' },
  { label: 'Guatemala (America/Guatemala)', value: 'America/Guatemala' },
  { label: 'San José (America/Costa_Rica)', value: 'America/Costa_Rica' },
  { label: 'Madrid (Europe/Madrid)', value: 'Europe/Madrid' },
]

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(80, 'Usa 80 caracteres o menos.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Selecciona una moneda válida.'),
  timezone: z.string().min(1, 'Selecciona una zona horaria.'),
})

const form = reactive({
  name: '',
  currency: 'COP',
  timezone: 'America/Bogota',
})
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const loading = ref(false)

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
  if (!values || loading.value) return

  loading.value = true
  let businessId: string | null = null

  try {
    businessId = await execute(client.rpc('create_business', {
      p_name: values.name,
      p_currency: values.currency,
      p_timezone: values.timezone,
    }), { errorTitle: 'No pudimos crear el negocio' })
  } catch {
    // El wrapper ya presentó el error traducido.
    loading.value = false
    return
  }

  try {
    if (!businessId) throw new Error('El servidor no devolvió el identificador del negocio.')
    await businessStore.loadMemberships(true)
    if (!businessStore.setActiveBusiness(businessId)) {
      throw new Error('No fue posible activar el negocio recién creado.')
    }
    await navigateTo('/')
  } catch (error) {
    notifyError(error, {
      errorTitle: 'El negocio fue creado, pero no pudimos abrirlo',
      fallbackMessage: 'Recarga la página para volver a intentarlo.',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthHeader title="Crea tu negocio" description="Configura nombre, moneda y zona horaria para comenzar." />
  <PrimeMessage v-if="invalidBusiness" severity="warn" :closable="false" class="mb-5">
    El negocio guardado no pertenece a tu cuenta. Selecciona o crea un negocio para continuar.
  </PrimeMessage>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <AuthField
      id="business-name"
      v-model="form.name"
      label="Nombre del negocio"
      autocomplete="organization"
      placeholder="Ej. Perfumería Aurora"
      :error="errors.name"
      :disabled="loading"
    />

    <div>
      <label for="business-currency" class="mb-1.5 block text-[11px] font-semibold text-ink">
        Moneda
      </label>
      <PrimeSelect
        id="business-currency"
        v-model="form.currency"
        :options="currencies"
        option-label="label"
        option-value="value"
        :invalid="Boolean(errors.currency)"
        :disabled="loading"
        :aria-invalid="Boolean(errors.currency)"
        :aria-describedby="errors.currency ? 'business-currency-error' : undefined"
        fluid
      />
      <p v-if="errors.currency" id="business-currency-error" class="mt-1.5 text-[11px] text-negative" role="alert">
        {{ errors.currency }}
      </p>
    </div>

    <div>
      <label for="business-timezone" class="mb-1.5 block text-[11px] font-semibold text-ink">
        Zona horaria
      </label>
      <PrimeSelect
        id="business-timezone"
        v-model="form.timezone"
        :options="timezones"
        option-label="label"
        option-value="value"
        filter
        filter-placeholder="Busca una ciudad"
        :invalid="Boolean(errors.timezone)"
        :disabled="loading"
        :aria-invalid="Boolean(errors.timezone)"
        :aria-describedby="errors.timezone ? 'business-timezone-error' : undefined"
        fluid
      />
      <p v-if="errors.timezone" id="business-timezone-error" class="mt-1.5 text-[11px] text-negative" role="alert">
        {{ errors.timezone }}
      </p>
    </div>

    <p class="text-[11px] leading-5 text-muted">
      Podrás cambiar la moneda y la zona horaria desde Ajustes.
    </p>
    <UiButton class="w-full" type="submit" :loading="loading">Crear negocio</UiButton>
  </form>
</template>
