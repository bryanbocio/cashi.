<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { QuoteRow } from '~/utils/quotes'

const props = defineProps<{ quote: QuoteRow | null }>()
const emit = defineEmits<{ deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const deleting = ref(false)

async function removeQuote() {
  const businessId = businessStore.activeBusinessId
  if (!businessId || !props.quote || deleting.value) return
  deleting.value = true
  try {
    await execute(client.from('quote')
      .delete()
      .eq('id', props.quote.id)
      .eq('business_id', businessId)
      .select('id')
      .single())
    toast.add({ severity: 'success', summary: 'Cotización eliminada', detail: `${props.quote.code} fue eliminada.`, life: 4000 })
    open.value = false
    emit('deleted')
  } catch {
    // useSupabaseRequest ya mostró el error seguro.
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Eliminar cotización">
    <p class="m-0 text-[13px] leading-6 text-muted">
      ¿Seguro que quieres eliminar <strong class="font-semibold text-ink">{{ quote?.code }}</strong>?
      Sus líneas también se eliminarán y esta acción no se puede deshacer.
    </p>
    <template #footer>
      <UiButton variant="secondary" :disabled="deleting" @click="open = false">Cancelar</UiButton>
      <UiButton variant="danger" :loading="deleting" data-testid="quote-delete-confirm" @click="removeQuote">Eliminar cotización</UiButton>
    </template>
  </UiModal>
</template>
