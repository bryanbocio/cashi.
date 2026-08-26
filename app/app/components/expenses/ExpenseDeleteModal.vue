<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { ExpenseRow } from '~/utils/expenses'

const props = defineProps<{ expense: ExpenseRow | null }>()
const emit = defineEmits<{ deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const deleting = ref(false)

async function removeExpense() {
  const businessId = businessStore.activeBusinessId
  if (!businessId || !props.expense || deleting.value) return

  deleting.value = true
  try {
    await execute(client.from('expense')
      .delete()
      .eq('id', props.expense.id)
      .eq('business_id', businessId)
      .select('id')
      .single())
    toast.add({
      severity: 'success',
      summary: 'Gasto eliminado',
      detail: 'El resumen mensual fue actualizado.',
      life: 4000,
    })
    open.value = false
    emit('deleted')
  } catch {
    // useSupabaseRequest ya mostró un error seguro para el usuario.
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Eliminar gasto">
    <p class="m-0 text-[13px] leading-6 text-muted">
      ¿Seguro que quieres eliminar <strong class="font-semibold text-ink">{{ expense?.concept }}</strong>?
      Esta acción quitará el monto del cálculo de ganancias y no se puede deshacer.
    </p>

    <template #footer>
      <UiButton variant="secondary" :disabled="deleting" @click="open = false">Cancelar</UiButton>
      <UiButton variant="danger" :loading="deleting" data-testid="expense-delete-confirm" @click="removeExpense">Eliminar gasto</UiButton>
    </template>
  </UiModal>
</template>
