<script setup lang="ts">
import { z } from 'zod'
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import { PAYMENT_METHODS, type CreditRow } from '~/utils/credits'

const props = defineProps<{ credit: CreditRow | null }>()
const emit = defineEmits<{ paid: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()

const schema = z.object({
  amount: z.number({ error: 'Escribe el monto del abono.' }).int('Usa un valor entero.').positive('El monto debe ser mayor que cero.'),
  method: z.enum(['CASH', 'TRANSFER', 'CARD'], { error: 'Elige el método de pago.' }),
})

const form = reactive({
  amount: null as number | null,
  method: 'CASH' as 'CASH' | 'TRANSFER' | 'CARD',
})
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

watch(open, isOpen => {
  if (!isOpen) return
  form.amount = null
  form.method = 'CASH'
  Object.keys(errors).forEach(key => { errors[key] = undefined })
})

function payAll() {
  if (props.credit) form.amount = props.credit.debt
  errors.amount = undefined
}

async function submit() {
  const credit = props.credit
  const businessId = businessStore.activeBusinessId
  if (!credit || !businessId || saving.value) return

  Object.keys(errors).forEach(key => { errors[key] = undefined })
  const result = schema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (field && !errors[field]) errors[field] = issue.message
    }
    return
  }
  if (result.data.amount > credit.debt) {
    errors.amount = `El abono no puede superar ${formatMoney(credit.debt)}.`
    return
  }

  saving.value = true
  try {
    const response = await execute(client.rpc('register_payment', {
      p_business: businessId,
      p_customer: credit.customerId,
      p_amount: result.data.amount,
      p_method: result.data.method,
    })) as { debt?: number } | null
    const remainingDebt = response?.debt ?? Math.max(0, credit.debt - result.data.amount)

    toast.add({
      severity: 'success',
      summary: 'Abono registrado',
      detail: remainingDebt === 0
        ? `${credit.name} quedó al día.`
        : `La deuda restante es ${formatMoney(remainingDebt)}.`,
      life: 4500,
    })
    open.value = false
    emit('paid')
  } catch {
    // useSupabaseRequest ya mostró un error seguro para el usuario.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" :title="`Abono de ${credit?.name ?? ''}`">
    <form id="credit-payment-form" class="grid gap-4" novalidate @submit.prevent="submit">
      <div class="rounded-lg border border-black/10 bg-surface px-4 py-3">
        <span class="block font-mono text-[9.5px] tracking-[.05em] text-subtle uppercase">Deuda pendiente</span>
        <strong class="mt-1 block font-display text-[24px] tracking-[-.03em]">{{ formatMoney(credit?.debt) }}</strong>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <label for="credit-payment-amount" class="block text-[11px] font-semibold text-ink">Monto del abono</label>
          <button type="button" class="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[11px] font-semibold text-accent underline" data-testid="credit-pay-all" :disabled="saving" @click="payAll">
            Abonar todo · {{ formatMoney(credit?.debt) }}
          </button>
        </div>
        <PrimeInputNumber :locale="MONEY_LOCALE" v-model="form.amount" input-id="credit-payment-amount" :min="1" :max-fraction-digits="0" :invalid="Boolean(errors.amount)" :disabled="saving" fluid />
        <p v-if="errors.amount" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.amount }}</p>
      </div>

      <div>
        <label for="credit-payment-method" class="mb-1.5 block text-[11px] font-semibold text-ink">Método de pago</label>
        <PrimeSelect id="credit-payment-method" v-model="form.method" :options="PAYMENT_METHODS" option-label="label" option-value="value" :invalid="Boolean(errors.method)" :disabled="saving" fluid />
        <p v-if="errors.method" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.method }}</p>
      </div>
    </form>

    <p class="mt-4 text-[11px] text-muted">El abono baja la deuda del cliente al instante y queda guardado en el historial.</p>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</UiButton>
      <UiButton type="submit" form="credit-payment-form" :loading="saving" data-testid="credit-payment-submit">Registrar abono</UiButton>
    </template>
  </UiModal>
</template>
