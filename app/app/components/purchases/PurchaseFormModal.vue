<script setup lang="ts">
import IconPlus from '~icons/lucide/plus'
import IconTrash2 from '~icons/lucide/trash-2'
import { useToast } from 'primevue/usetoast'
import { z } from 'zod'
import type { Database, Json } from '~/types/database'

type Option = { label: string; value: string }
export type PurchaseProductOption = Option & { sku: string; cost: number }
type CreatedProduct = { id: string; supplierId: string | null }

const props = defineProps<{ products: PurchaseProductOption[]; suppliers: Option[]; createdProduct?: CreatedProduct | null }>()
const emit = defineEmits<{ created: []; createProduct: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()

type FormLine = { key: number; productId: string | null; qty: number; unitCost: number }
let nextKey = 1
const supplierId = ref<string | null>(null)
const lines = ref<FormLine[]>([])
const error = ref('')
const savingMode = ref<'pending' | 'received' | null>(null)

const lineSchema = z.object({
  productId: z.string({ error: 'Selecciona un producto.' }).min(1, 'Selecciona un producto.'),
  qty: z.number({ error: 'Escribe una cantidad.' }).int('La cantidad debe ser entera.').min(1, 'La cantidad debe ser mayor que cero.'),
  unitCost: z.number({ error: 'Escribe el costo unitario.' }).int('El costo debe ser entero.').min(0, 'El costo no puede ser negativo.'),
})

function emptyLine(): FormLine {
  return { key: nextKey++, productId: null, qty: 1, unitCost: 0 }
}

function reset() {
  supplierId.value = null
  lines.value = [emptyLine()]
  error.value = ''
  savingMode.value = null
}

watch(open, value => { if (value) reset() })

watch(() => props.createdProduct, (created) => {
  if (!created || !open.value) return
  const product = props.products.find(item => item.value === created.id)
  if (!product) return

  let target = lines.value.find(line => !line.productId)
  if (!target && lines.value.length < props.products.length) {
    target = emptyLine()
    lines.value.push(target)
  }
  if (!target) return

  target.productId = product.value
  target.unitCost = product.cost
  if (!supplierId.value && created.supplierId) supplierId.value = created.supplierId
})

const total = computed(() => lines.value.reduce((sum, line) => (
  sum + (Number.isFinite(line.qty) && Number.isFinite(line.unitCost) ? line.qty * line.unitCost : 0)
), 0))

function productOptions(line: FormLine) {
  const selected = new Set(lines.value.filter(item => item.key !== line.key).map(item => item.productId))
  return props.products.filter(product => !selected.has(product.value))
}

function selectProduct(line: FormLine) {
  const product = props.products.find(item => item.value === line.productId)
  if (product) line.unitCost = product.cost
}

function addLine() {
  if (lines.value.length >= props.products.length) return
  lines.value.push(emptyLine())
}

function removeLine(key: number) {
  if (lines.value.length === 1) return
  lines.value = lines.value.filter(line => line.key !== key)
}

async function submit(receive: boolean) {
  const businessId = businessStore.activeBusinessId
  if (!businessId || savingMode.value) return
  error.value = ''

  if (!props.products.length) {
    error.value = 'Primero crea un producto en Inventario.'
    return
  }

  const parsed = z.array(lineSchema).min(1).safeParse(lines.value)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Revisa los productos de la compra.'
    return
  }

  if (new Set(parsed.data.map(line => line.productId)).size !== parsed.data.length) {
    error.value = 'No repitas un producto dentro de la misma compra.'
    return
  }

  savingMode.value = receive ? 'received' : 'pending'
  try {
    const data = await execute(client.rpc('create_purchase_order', {
      p_business: businessId,
      p_supplier: supplierId.value,
      p_expected: null,
      p_receive: receive,
      p_lines: parsed.data.map(line => ({
        product_id: line.productId,
        qty: line.qty,
        unit_cost: line.unitCost,
      })) as Json,
    }))
    const payload = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, Json | undefined> : null
    const code = payload && typeof payload.code === 'string' ? payload.code : 'La compra'
    toast.add({
      severity: 'success',
      summary: receive ? 'Compra registrada' : 'Orden creada',
      detail: receive
        ? `${code} actualizó existencias y costos.`
        : `${code} quedó pendiente de recepción.`,
      life: 4500,
    })
    open.value = false
    emit('created')
  } catch {
    // useSupabaseRequest ya mostró el error seguro.
  } finally {
    savingMode.value = null
  }
}
</script>

<template>
  <UiModal v-model="open" title="Nueva compra" width="min(760px, calc(100vw - 32px))">
    <div class="grid gap-5">
      <div>
        <label for="purchase-supplier" class="mb-1.5 block text-[11px] font-semibold text-ink">Proveedor <span class="font-normal text-subtle">(opcional)</span></label>
        <PrimeSelect id="purchase-supplier" v-model="supplierId" :options="suppliers" option-label="label" option-value="value" placeholder="Selecciona un proveedor" show-clear :disabled="Boolean(savingMode)" fluid />
      </div>

      <div class="grid gap-3">
        <div class="flex items-center justify-between gap-3 max-[640px]:items-start max-[640px]:flex-col">
          <div>
            <strong class="block text-[12.5px] font-semibold">Productos comprados</strong>
            <span class="text-[11px] text-muted">El costo indicado será el nuevo costo del producto al recibir.</span>
          </div>
          <div class="flex gap-2 max-[640px]:w-full max-[640px]:flex-col">
            <UiButton variant="secondary" class="w-40 justify-start max-[640px]:w-full" :disabled="Boolean(savingMode)" data-testid="purchase-create-product" @click="emit('createProduct')">
              <IconPlus class="size-4 shrink-0" aria-hidden="true" />Nuevo producto
            </UiButton>
            <UiButton variant="secondary" class="w-40 justify-start max-[640px]:w-full" :disabled="Boolean(savingMode) || lines.length >= products.length" data-testid="purchase-add-line" @click="addLine">
              <IconPlus class="size-4 shrink-0" aria-hidden="true" />Agregar compra
            </UiButton>
          </div>
        </div>

        <p v-if="!products.length" class="m-0 rounded-[8px] bg-surface p-3 text-[12px] text-muted">Primero crea al menos un producto en Inventario.</p>

        <div
          v-for="(line, index) in lines"
          v-else
          :key="line.key"
          class="grid grid-cols-[minmax(0,1fr)_110px_150px_44px] items-end gap-2 rounded-[9px] border border-black/10 bg-surface p-3 max-[640px]:grid-cols-2"
          :data-testid="`purchase-line-${index}`"
        >
          <div class="max-[640px]:col-span-2">
            <label :for="`purchase-product-${line.key}`" class="mb-1.5 block text-[11px] font-semibold text-ink">Producto</label>
            <PrimeSelect :input-id="`purchase-product-${line.key}`" v-model="line.productId" :options="productOptions(line)" option-label="label" option-value="value" placeholder="Selecciona un producto" :disabled="Boolean(savingMode)" filter fluid @change="selectProduct(line)" />
          </div>
          <div>
            <label :for="`purchase-qty-${line.key}`" class="mb-1.5 block text-[11px] font-semibold text-ink">Cantidad</label>
            <PrimeInputNumber v-model="line.qty" :input-id="`purchase-qty-${line.key}`" :min="1" :max-fraction-digits="0" :disabled="Boolean(savingMode)" fluid />
          </div>
          <div>
            <label :for="`purchase-cost-${line.key}`" class="mb-1.5 block text-[11px] font-semibold text-ink">Costo unitario</label>
            <PrimeInputNumber :locale="MONEY_LOCALE" v-model="line.unitCost" :input-id="`purchase-cost-${line.key}`" :min="0" :max-fraction-digits="0" :disabled="Boolean(savingMode)" fluid />
          </div>
          <button
            type="button"
            class="grid size-11 cursor-pointer place-items-center rounded-[7px] border border-black/10 bg-panel text-subtle transition-colors hover:bg-white hover:text-negative disabled:cursor-not-allowed disabled:opacity-40 max-[640px]:justify-self-end"
            :disabled="Boolean(savingMode) || lines.length === 1"
            :aria-label="`Quitar producto ${index + 1}`"
            @click="removeLine(line.key)"
          ><IconTrash2 class="size-4" aria-hidden="true" /></button>
        </div>
      </div>

      <div class="flex items-baseline justify-between border-t border-black/10 pt-4">
        <span class="text-[12px] font-semibold">Total de la compra</span>
        <strong class="font-display text-[22px]" data-testid="purchase-form-total">{{ formatMoney(total) }}</strong>
      </div>
      <p v-if="error" class="m-0 text-[11px] text-negative" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="Boolean(savingMode)" @click="open = false">Cancelar</UiButton>
      <UiButton variant="secondary" :loading="savingMode === 'pending'" :disabled="Boolean(savingMode)" data-testid="purchase-save-pending" @click="submit(false)">Guardar pendiente</UiButton>
      <UiButton :loading="savingMode === 'received'" :disabled="Boolean(savingMode)" data-testid="purchase-save-received" @click="submit(true)">Registrar y recibir</UiButton>
    </template>
  </UiModal>
</template>
