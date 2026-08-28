<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'

/**
 * Anulación de una venta ya registrada.
 *
 * `void_sale` devuelve el stock y deja la venta fuera de todas las cifras, pero
 * no la borra: el documento sigue existiendo con su sello de ANULADA. Por eso
 * el aviso habla de anular y no de eliminar.
 */

const props = defineProps<{ code: string | null; saleId: string | null; total: number }>()
const emit = defineEmits<{ voided: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()
const voiding = ref(false)

async function voidSale() {
  if (!props.saleId || voiding.value) return
  voiding.value = true
  try {
    await execute(client.rpc('void_sale', { p_sale: props.saleId }))
    toast.add({
      severity: 'success',
      summary: `Venta ${props.code ?? ''} anulada`.trim(),
      detail: 'Las existencias volvieron al inventario y la venta ya no cuenta en las cifras.',
      life: 5000,
    })
    open.value = false
    emit('voided')
  } catch {
    // `useSupabaseRequest` ya mostró el error seguro.
  } finally {
    voiding.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Anular venta">
    <p class="m-0 text-[13px] leading-6 text-muted">
      ¿Seguro que quieres anular <strong class="font-semibold text-ink">{{ code }}</strong>
      por {{ formatMoney(total) }}?
    </p>
    <p class="mt-3 mb-0 text-[13px] leading-6 text-muted">
      Las existencias vuelven al inventario y la venta deja de contar en ingresos,
      ganancia y cartera. El documento se conserva marcado como anulado, pero la
      anulación no se puede deshacer.
    </p>
    <template #footer>
      <UiButton variant="secondary" :disabled="voiding" @click="open = false">Cancelar</UiButton>
      <UiButton variant="danger" :loading="voiding" data-testid="void-sale-confirm" @click="voidSale">Anular venta</UiButton>
    </template>
  </UiModal>
</template>
