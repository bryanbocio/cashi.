<script setup lang="ts">
import { z } from 'zod'
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import {
  EXPENSE_CATEGORIES,
  calendarDateToPicker,
  instantToBusinessDate,
  pickerToCalendarDate,
  type ExpenseRow,
} from '~/utils/expenses'

const props = defineProps<{ expense?: ExpenseRow | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const editing = computed(() => Boolean(props.expense))

const categoryOptions = EXPENSE_CATEGORIES.map(value => ({ label: value, value }))
const schema = z.object({
  category: z.string().trim().min(1, 'Elige una categoría.'),
  concept: z.string().trim().min(2, 'Describe el gasto.').max(160, 'Usa 160 caracteres o menos.'),
  amount: z.number({ error: 'Escribe el monto.' }).int('Usa un valor entero.').positive('El monto debe ser mayor que cero.'),
  spentAt: z.date({ error: 'Elige la fecha del gasto.' }),
})

const form = reactive({
  category: '',
  concept: '',
  amount: null as number | null,
  spentAt: null as Date | null,
  recurring: false,
})
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

function businessToday() {
  const timezone = businessStore.activeBusiness?.timezone ?? 'America/Bogota'
  return calendarDateToPicker(instantToBusinessDate(new Date().toISOString(), timezone))
}

watch([open, () => props.expense], ([isOpen]) => {
  if (!isOpen) return
  const expense = props.expense
  Object.assign(form, expense ? {
    category: expense.category,
    concept: expense.concept,
    amount: expense.amount,
    spentAt: calendarDateToPicker(expense.spent_at),
    recurring: expense.recurring,
  } : {
    category: '',
    concept: '',
    amount: null,
    spentAt: businessToday(),
    recurring: false,
  })
  Object.keys(errors).forEach(key => { errors[key] = undefined })
}, { immediate: true })

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
    const values = {
      business_id: businessId,
      category: result.data.category,
      concept: result.data.concept,
      amount: result.data.amount,
      spent_at: pickerToCalendarDate(result.data.spentAt)!,
      recurring: form.recurring,
    }

    if (props.expense) {
      await execute(client.from('expense').update(values)
        .eq('id', props.expense.id)
        .eq('business_id', businessId))
    } else {
      await execute(client.from('expense').insert(values))
    }

    toast.add({
      severity: 'success',
      summary: editing.value ? 'Gasto actualizado' : 'Gasto registrado',
      detail: editing.value ? 'Los cambios ya aparecen en el resumen.' : 'El gasto ya cuenta para la ganancia neta.',
      life: 4000,
    })
    open.value = false
    emit('saved')
  } catch {
    // useSupabaseRequest ya mostró un error seguro para el usuario.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" :title="editing ? 'Editar gasto' : 'Nuevo gasto'">
    <form id="expense-create-form" class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" novalidate @submit.prevent="submit">
      <div class="col-span-2 max-[560px]:col-span-1">
        <label for="expense-category" class="mb-1.5 block text-[11px] font-semibold text-ink">Categoría</label>
        <PrimeSelect id="expense-category" v-model="form.category" :options="categoryOptions" option-label="label" option-value="value" placeholder="Elige una categoría" :invalid="Boolean(errors.category)" :disabled="saving" fluid />
        <p v-if="errors.category" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.category }}</p>
      </div>

      <div v-if="form.category" class="col-span-2 max-[560px]:col-span-1" data-testid="expense-concept-wrap">
        <label for="expense-concept" class="mb-1.5 block text-[11px] font-semibold text-ink">Concepto</label>
        <PrimeInputText id="expense-concept" v-model="form.concept" :placeholder="form.category === 'Otro' ? 'Describe el gasto' : 'Ej. factura o detalle del gasto'" :invalid="Boolean(errors.concept)" :disabled="saving" autocomplete="off" fluid />
        <p v-if="errors.concept" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.concept }}</p>
        <p v-else-if="form.category === 'Otro'" class="mt-1.5 text-[11px] text-muted">Escribe qué salió del negocio para poder reconocerlo después.</p>
      </div>

      <div>
        <label for="expense-amount" class="mb-1.5 block text-[11px] font-semibold text-ink">Monto</label>
        <PrimeInputNumber v-model="form.amount" input-id="expense-amount" :min="1" :max-fraction-digits="0" :invalid="Boolean(errors.amount)" :disabled="saving" fluid />
        <p v-if="errors.amount" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.amount }}</p>
      </div>

      <div>
        <label for="expense-date" class="mb-1.5 block text-[11px] font-semibold text-ink">Fecha</label>
        <PrimeDatePicker v-model="form.spentAt" input-id="expense-date" date-format="dd/mm/yy" show-icon :invalid="Boolean(errors.spentAt)" :disabled="saving" fluid />
        <p v-if="errors.spentAt" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.spentAt }}</p>
      </div>

      <label class="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/10 bg-surface px-3 max-[560px]:col-span-1">
        <input v-model="form.recurring" type="checkbox" class="size-4 accent-accent" :disabled="saving">
        <span><strong class="block text-[11.5px]">Gasto recurrente</strong><span class="text-[10.5px] text-muted">Sirve para identificar pagos que se repiten cada mes.</span></span>
      </label>
    </form>

    <p class="mt-4 text-[11px] text-muted">Los gastos se restan de la ganancia bruta del periodo.</p>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</UiButton>
      <UiButton type="submit" form="expense-create-form" :loading="saving" data-testid="expense-create-submit">{{ editing ? 'Guardar cambios' : 'Registrar gasto' }}</UiButton>
    </template>
  </UiModal>
</template>
