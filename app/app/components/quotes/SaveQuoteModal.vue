<script setup lang="ts">
import {
  addCalendarDays,
  calendarDateToPicker,
  instantToBusinessDate,
  pickerToCalendarDate,
} from '~/utils/expenses'

const props = defineProps<{
  saving: boolean
  subtotal: number
  discount: number
  total: number
  customerName: string
}>()
const emit = defineEmits<{ save: [validUntil: string] }>()
const open = defineModel<boolean>('open', { default: false })

const businessStore = useBusinessStore()
const { formatMoney } = useMoney()
const validUntil = ref<Date | null>(null)
const error = ref<string | null>(null)

const timezone = computed(() => businessStore.activeBusiness?.timezone ?? 'America/Bogota')
const localToday = computed(() => instantToBusinessDate(new Date().toISOString(), timezone.value))
const minimumDate = computed(() => calendarDateToPicker(localToday.value))

watch(open, isOpen => {
  if (!isOpen) return
  validUntil.value = calendarDateToPicker(addCalendarDays(localToday.value, 15))
  error.value = null
})

function submit() {
  const date = pickerToCalendarDate(validUntil.value)
  if (!date) {
    error.value = 'Elige hasta cuándo será válida la cotización.'
    return
  }
  if (date < localToday.value) {
    error.value = 'La vigencia no puede terminar antes de hoy.'
    return
  }
  error.value = null
  emit('save', date)
}
</script>

<template>
  <UiModal v-model="open" title="Guardar cotización">
    <form id="save-quote-form" class="grid gap-4" novalidate @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-3 rounded-lg border border-black/10 bg-surface px-4 py-3">
        <div>
          <span class="block text-[9.5px] font-semibold tracking-[.05em] text-subtle uppercase">Cliente</span>
          <strong class="mt-1 block truncate text-[12px] font-medium">{{ customerName }}</strong>
        </div>
        <div class="text-right">
          <span class="block text-[9.5px] font-semibold tracking-[.05em] text-subtle uppercase">Total cotizado</span>
          <strong class="mt-1 block font-mono text-[15px]">{{ formatMoney(total) }}</strong>
        </div>
        <dl v-if="discount > 0" class="col-span-2 grid grid-cols-2 gap-2 border-t border-black/10 pt-2 text-[10.5px]">
          <div class="flex justify-between gap-2"><dt class="text-muted">Subtotal</dt><dd class="m-0 font-mono">{{ formatMoney(subtotal) }}</dd></div>
          <div class="flex justify-between gap-2"><dt class="text-muted">Descuento</dt><dd class="m-0 font-mono text-negative">{{ formatMoney(-discount) }}</dd></div>
        </dl>
      </div>

      <div>
        <label for="quote-valid-until" class="mb-1.5 block text-[11px] font-semibold text-ink">Válida hasta</label>
        <PrimeDatePicker
          v-model="validUntil"
          input-id="quote-valid-until"
          date-format="dd/mm/yy"
          :min-date="minimumDate"
          :invalid="Boolean(error)"
          :disabled="saving"
          show-icon
          fluid
          data-testid="quote-valid-until"
        />
        <p v-if="error" class="mt-1.5 text-[11px] text-negative" role="alert">{{ error }}</p>
        <p v-else class="mt-1.5 text-[11px] text-muted">Por defecto vence en 15 días. El último día todavía se puede convertir.</p>
      </div>
    </form>

    <p class="mt-4 text-[11px] leading-relaxed text-muted">La cotización conservará el descuento y no afectará el inventario hasta convertirse en venta.</p>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</UiButton>
      <UiButton type="submit" form="save-quote-form" :loading="saving" data-testid="quote-save-submit">Guardar cotización</UiButton>
    </template>
  </UiModal>
</template>
