<script setup lang="ts">
import { z } from 'zod'
import type { Database } from '~/types/database'
import type { ProductRow } from '~/utils/inventory'
import { adjustmentReasons, estimateMarginPct, THIN_MARGIN_THRESHOLD } from '~/utils/inventory'

const props = defineProps<{ product: ProductRow | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const { execute } = useSupabaseRequest()
const { formatMoney, formatPercent, formatNumber } = useMoney()

const priceSchema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120, 'Usa 120 caracteres o menos.'),
  cost: z.number({ error: 'Escribe un costo.' }).int('Usa un valor entero.').min(0, 'El costo no puede ser negativo.'),
  price: z.number({ error: 'Escribe un precio.' }).int('Usa un valor entero.').min(0, 'El precio no puede ser negativo.'),
  minStock: z.number({ error: 'Escribe un mínimo.' }).int('Usa un valor entero.').min(0, 'El mínimo no puede ser negativo.'),
})

const adjustSchema = z.object({
  delta: z.number({ error: 'Escribe cuántas unidades.' }).int('Usa un valor entero.').refine(value => value !== 0, 'El ajuste debe ser distinto de cero.'),
  reason: z.string().trim().min(3, 'Indica el motivo del ajuste.').max(120, 'Usa 120 caracteres o menos.'),
})

const form = reactive({ name: '', cost: 0, price: 0, minStock: 0 })
const adjust = reactive({ delta: null as number | null, reason: 'Conteo físico', customReason: '' })
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)
const adjusting = ref(false)

const stock = computed(() => props.product?.stock ?? 0)
const usesCustomReason = computed(() => adjust.reason === 'custom')
const resolvedReason = computed(() => (usesCustomReason.value ? adjust.customReason : adjust.reason))
const resultingStock = computed(() => stock.value + (adjust.delta ?? 0))

// Estimado en vivo mientras se edita: es la excepción permitida a calcular
// dinero fuera de Postgres, igual que el total del carrito antes de cobrar.
const previewMarginPct = computed(() => estimateMarginPct(form.cost, form.price))
const previewMarginAmount = computed(() => form.price - form.cost)
const previewValue = computed(() => form.cost * stock.value)
const previewIsThin = computed(() => (
  form.price === 0 ? form.cost > 0 : (previewMarginPct.value ?? 0) < THIN_MARGIN_THRESHOLD
))

function resetForm() {
  const product = props.product
  errors.name = errors.cost = errors.price = errors.minStock = errors.delta = errors.reason = undefined
  adjust.delta = null
  adjust.reason = 'Conteo físico'
  adjust.customReason = ''
  if (!product) return
  form.name = product.name
  form.cost = product.cost
  form.price = product.price
  form.minStock = product.minStock
}

watch(() => props.product?.id, resetForm, { immediate: true })
watch(open, value => { if (value) resetForm() })

async function submitPrices() {
  const product = props.product
  if (!product || saving.value) return

  errors.name = errors.cost = errors.price = errors.minStock = undefined
  const result = priceSchema.safeParse({ name: form.name, cost: form.cost, price: form.price, minStock: form.minStock })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (field && !errors[field]) errors[field] = issue.message
    }
    return
  }

  saving.value = true
  try {
    await execute(client
      .from('product')
      .update({
        name: result.data.name,
        cost: result.data.cost,
        price: result.data.price,
        min_stock: result.data.minStock,
      })
      .eq('id', product.id)
      .select('id')
      .single(), { successMessage: 'El producto fue actualizado.' })
    emit('saved')
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    saving.value = false
  }
}

async function submitAdjustment() {
  const product = props.product
  if (!product || adjusting.value) return

  errors.delta = errors.reason = undefined
  const result = adjustSchema.safeParse({ delta: adjust.delta, reason: resolvedReason.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (field && !errors[field]) errors[field] = issue.message
    }
    return
  }

  adjusting.value = true
  try {
    await execute(client.rpc('adjust_stock', {
      p_product: product.id,
      p_delta: result.data.delta,
      p_reason: result.data.reason,
    }), { successMessage: 'Las existencias fueron ajustadas.' })
    adjust.delta = null
    emit('saved')
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    adjusting.value = false
  }
}
</script>

<template>
  <UiDrawer
    v-model="open"
    position="right"
    panel-class="!w-[min(94vw,420px)]"
    :header="product?.name ?? 'Producto'"
    drawer-id="inventory-product-panel"
  >
    <div v-if="product" class="grid gap-6" data-testid="product-panel">
      <p class="-mt-2 font-mono text-[11px] text-subtle">{{ product.sku }}</p>

      <section class="grid grid-cols-3 gap-2 rounded-[9px] bg-surface p-3 text-center">
        <div>
          <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Margen</p>
          <strong class="font-display text-[15px] tracking-[-.02em]" :class="previewIsThin ? 'text-negative' : 'text-positive'" data-testid="panel-margin">{{ formatPercent(previewMarginPct) }}</strong>
        </div>
        <div>
          <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Por unidad</p>
          <strong class="font-mono text-[13px]">{{ formatMoney(previewMarginAmount) }}</strong>
        </div>
        <div>
          <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Valor</p>
          <strong class="font-mono text-[13px]" data-testid="panel-value">{{ formatMoney(previewValue) }}</strong>
        </div>
      </section>

      <form class="grid gap-4" novalidate @submit.prevent="submitPrices">
        <h3 class="font-display text-[15px] font-bold tracking-[-.02em]">Datos del producto</h3>

        <div>
          <label for="panel-name" class="mb-1.5 block text-[11px] font-semibold text-ink">Nombre</label>
          <PrimeInputText id="panel-name" v-model="form.name" :invalid="Boolean(errors.name)" :disabled="saving" autocomplete="off" fluid />
          <p v-if="errors.name" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.name }}</p>
          <!-- El nombre de la venta ya vendida no cambia: `sale_line` lo congela. -->
          <p v-else class="mt-1.5 text-[11px] text-muted">Las ventas ya registradas conservan el nombre que tenían.</p>
        </div>

        <div>
          <label for="panel-cost" class="mb-1.5 block text-[11px] font-semibold text-ink">Costo</label>
          <PrimeInputNumber v-model="form.cost" input-id="panel-cost" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.cost)" :disabled="saving" fluid />
          <p v-if="errors.cost" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.cost }}</p>
        </div>

        <div>
          <label for="panel-price" class="mb-1.5 block text-[11px] font-semibold text-ink">Precio de venta</label>
          <PrimeInputNumber v-model="form.price" input-id="panel-price" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.price)" :disabled="saving" fluid />
          <p v-if="errors.price" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.price }}</p>
        </div>

        <div>
          <label for="panel-min-stock" class="mb-1.5 block text-[11px] font-semibold text-ink">Stock mínimo</label>
          <PrimeInputNumber v-model="form.minStock" input-id="panel-min-stock" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.minStock)" :disabled="saving" fluid />
          <p v-if="errors.minStock" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.minStock }}</p>
        </div>

        <UiButton class="w-full" type="submit" :loading="saving" data-testid="panel-save">Guardar cambios</UiButton>
      </form>

      <form class="grid gap-4 border-t border-black/10 pt-6" novalidate @submit.prevent="submitAdjustment">
        <div>
          <h3 class="font-display text-[15px] font-bold tracking-[-.02em]">Existencias</h3>
          <p class="mt-1 text-[11px] text-muted">
            Hoy hay <strong class="font-mono" data-testid="panel-stock">{{ formatNumber(stock) }}</strong> unidades y el mínimo es {{ formatNumber(product.minStock) }}.
            El stock solo cambia con un ajuste, que queda registrado con su motivo.
          </p>
        </div>

        <div>
          <label for="panel-delta" class="mb-1.5 block text-[11px] font-semibold text-ink">Unidades a sumar o restar</label>
          <PrimeInputNumber v-model="adjust.delta" input-id="panel-delta" :max-fraction-digits="0" :invalid="Boolean(errors.delta)" :disabled="adjusting" placeholder="Por ejemplo 10 o -3" fluid />
          <p v-if="errors.delta" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.delta }}</p>
          <p v-else-if="adjust.delta" class="mt-1.5 text-[11px] text-muted">
            Quedará en <strong class="font-mono">{{ formatNumber(resultingStock) }}</strong> unidades.
          </p>
        </div>

        <div>
          <label for="panel-reason" class="mb-1.5 block text-[11px] font-semibold text-ink">Motivo</label>
          <PrimeSelect id="panel-reason" v-model="adjust.reason" :options="adjustmentReasons" option-label="label" option-value="value" :disabled="adjusting" fluid />
        </div>

        <AuthField v-if="usesCustomReason" id="panel-custom-reason" v-model="adjust.customReason" label="Describe el motivo" :error="errors.reason" :disabled="adjusting" />
        <p v-else-if="errors.reason" class="-mt-2 text-[11px] text-negative" role="alert">{{ errors.reason }}</p>

        <UiButton class="w-full" variant="secondary" type="submit" :loading="adjusting" data-testid="panel-adjust">Aplicar ajuste</UiButton>
      </form>
    </div>
  </UiDrawer>
</template>
