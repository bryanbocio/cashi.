<script setup lang="ts">
import { z } from 'zod'
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'

/**
 * Alta de cliente sin salir de donde estabas.
 *
 * Se abre desde el panel de cobro de Caja: quien está cobrando un fiado
 * descubre allí mismo que el cliente no existe, y mandarlo a otra pantalla le
 * costaría el carrito. Al guardar, quien la abrió recibe el cliente ya creado
 * para seleccionarlo.
 */

const emit = defineEmits<{ created: [customer: { id: string; name: string }] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del cliente.').max(120, 'Usa 120 caracteres o menos.'),
  phone: z.string().trim().max(40, 'Usa 40 caracteres o menos.'),
  notes: z.string().trim().max(300, 'Usa 300 caracteres o menos.'),
})

const form = reactive({ name: '', phone: '', notes: '' })
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, { name: '', phone: '', notes: '' })
  Object.keys(errors).forEach(key => { errors[key] = undefined })
})

async function submit() {
  const businessId = businessStore.activeBusinessId
  if (!businessId || saving.value) return

  Object.keys(errors).forEach(key => { errors[key] = undefined })
  const result = schema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (field && !errors[field]) errors[field] = issue.message
    }
    return
  }

  saving.value = true
  try {
    const created = await execute(client
      .from('customer')
      .insert({
        business_id: businessId,
        name: result.data.name,
        // Los opcionales vacíos se guardan como null, no como cadena vacía.
        phone: result.data.phone || null,
        notes: result.data.notes || null,
      })
      .select('id, name')
      .single())

    if (!created) return
    toast.add({
      severity: 'success',
      summary: 'Cliente creado',
      detail: `${created.name} ya está disponible para cobrar y fiar.`,
      life: 4000,
    })
    open.value = false
    emit('created', created)
  } catch {
    // `useSupabaseRequest` ya mostró el error seguro.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Nuevo cliente">
    <form id="customer-create-form" class="grid gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="customer-name" class="mb-1.5 block text-[11px] font-semibold text-ink">Nombre</label>
        <PrimeInputText id="customer-name" v-model="form.name" placeholder="Ej. Ana Pérez" :invalid="Boolean(errors.name)" :disabled="saving" autocomplete="off" fluid />
        <p v-if="errors.name" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.name }}</p>
      </div>

      <div>
        <label for="customer-phone" class="mb-1.5 block text-[11px] font-semibold text-ink">Teléfono <span class="font-normal text-subtle">(opcional)</span></label>
        <PrimeInputText id="customer-phone" v-model="form.phone" placeholder="Ej. 3005550000" :invalid="Boolean(errors.phone)" :disabled="saving" autocomplete="off" fluid />
        <p v-if="errors.phone" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.phone }}</p>
        <p v-else class="mt-1.5 text-[11px] text-muted">Sirve para cobrarle después si queda debiendo.</p>
      </div>

      <div>
        <label for="customer-notes" class="mb-1.5 block text-[11px] font-semibold text-ink">Nota <span class="font-normal text-subtle">(opcional)</span></label>
        <PrimeInputText id="customer-notes" v-model="form.notes" placeholder="Ej. vecina del local" :invalid="Boolean(errors.notes)" :disabled="saving" autocomplete="off" fluid />
        <p v-if="errors.notes" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.notes }}</p>
      </div>
    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</UiButton>
      <UiButton type="submit" form="customer-create-form" :loading="saving" data-testid="customer-create-submit">Guardar cliente</UiButton>
    </template>
  </UiModal>
</template>
