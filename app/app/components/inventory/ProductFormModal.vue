<script setup lang="ts">
import { z } from 'zod'
import type { Database } from '~/types/database'
import { buildSku, nextSkuSequence, skuPrefixFromName } from '~/utils/inventory'

type Option = { label: string; value: string }

const props = defineProps<{ categories: Option[]; suppliers: Option[] }>()
const emit = defineEmits<{ created: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const { execute, notifyError } = useSupabaseRequest()

const schema = z.object({
  // El SKU es opcional: si se deja vacío se genera a partir del nombre.
  sku: z.string().trim().max(40, 'Usa 40 caracteres o menos.'),
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120, 'Usa 120 caracteres o menos.'),
  cost: z.number({ error: 'Escribe un costo.' }).int('Usa un valor entero.').min(0, 'El costo no puede ser negativo.'),
  price: z.number({ error: 'Escribe un precio.' }).int('Usa un valor entero.').min(0, 'El precio no puede ser negativo.'),
  stock: z.number({ error: 'Escribe las existencias.' }).int('Usa un valor entero.').min(0, 'El stock inicial no puede ser negativo.'),
  minStock: z.number({ error: 'Escribe un mínimo.' }).int('Usa un valor entero.').min(0, 'El mínimo no puede ser negativo.'),
})

const emptyForm = () => ({ sku: '', name: '', category: '', supplier: '', cost: 0, price: 0, stock: 0, minStock: 0 })
const form = reactive(emptyForm())
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  Object.assign(form, emptyForm())
  Object.keys(errors).forEach(key => { errors[key] = undefined })
})

/**
 * Los selectores editables trabajan **con el nombre**, nunca con el id.
 *
 * Con `option-value` apuntando al id, elegir una categoría existente metía el
 * UUID en el campo y `resolveFacet` lo daba por un nombre nuevo: acababa
 * creando una categoría llamada como el UUID. Igualando etiqueta y valor, tanto
 * elegir como escribir devuelven un nombre.
 */
const categoryNames = computed(() => props.categories.map(option => ({ label: option.label, value: option.label })))
const supplierNames = computed(() => props.suppliers.map(option => ({ label: option.label, value: option.label })))

/** Sugerencia visible mientras se escribe el nombre. */
const suggestedSku = computed(() => (form.name.trim() ? buildSku(skuPrefixFromName(form.name), 1) : ''))

/**
 * SKU libre para el prefijo del nombre. Se consulta al guardar, no al escribir,
 * para no lanzar una petición por tecla; el índice único sigue siendo la última
 * defensa si dos altas coinciden.
 */
async function generateSku(businessId: string, name: string) {
  const prefix = skuPrefixFromName(name)
  const rows = await execute(client
    .from('product')
    .select('sku')
    .eq('business_id', businessId)
    .ilike('sku', `${prefix}-%`))
  return buildSku(prefix, nextSkuSequence((rows ?? []).map(row => row.sku), prefix))
}

/** Se acepta un nombre nuevo: el catálogo lo define el usuario y hoy no hay otra
 *  pantalla para crear categorías o proveedores. */
async function resolveFacet(table: 'category' | 'supplier', name: string, options: Option[]) {
  const clean = name.trim()
  if (!clean) return null

  const existing = options.find(option => option.label.toLowerCase() === clean.toLowerCase())
  if (existing) return existing.value

  const businessId = businessStore.activeBusinessId
  if (!businessId) return null

  const created = await execute(client
    .from(table)
    .insert({ business_id: businessId, name: clean })
    .select('id')
    .single())

  return created?.id ?? null
}

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
    const categoryId = await resolveFacet('category', form.category, props.categories)
    const supplierId = await resolveFacet('supplier', form.supplier, props.suppliers)
    const sku = result.data.sku || await generateSku(businessId, result.data.name)

    const { error } = await client.from('product').insert({
      business_id: businessId,
      sku,
      name: result.data.name,
      category_id: categoryId,
      supplier_id: supplierId,
      cost: result.data.cost,
      price: result.data.price,
      stock: result.data.stock,
      min_stock: result.data.minStock,
    })

    if (error) {
      // El índice único de (business_id, sku) es la causa habitual y merece un
      // mensaje que diga qué corregir.
      if (error.code === '23505') {
        errors.sku = 'Ya existe un producto con este SKU.'
        return
      }
      notifyError(error)
      return
    }

    open.value = false
    emit('created')
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Nuevo producto">
    <form id="product-create-form" class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" novalidate @submit.prevent="submit">
      <AuthField id="product-name" v-model="form.name" label="Nombre" :error="errors.name" :disabled="saving" />

      <div>
        <label for="product-sku" class="mb-1.5 block text-[11px] font-semibold text-ink">SKU <span class="font-normal text-subtle">(opcional)</span></label>
        <PrimeInputText id="product-sku" v-model="form.sku" :placeholder="suggestedSku || 'Se genera solo'" :invalid="Boolean(errors.sku)" :disabled="saving" autocomplete="off" fluid />
        <p v-if="errors.sku" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.sku }}</p>
        <p v-else-if="suggestedSku" class="mt-1.5 text-[11px] text-muted">Si lo dejas vacío se usará <strong class="font-mono">{{ suggestedSku }}</strong> o el siguiente libre.</p>
      </div>

      <div>
        <label for="product-category" class="mb-1.5 block text-[11px] font-semibold text-ink">Categoría</label>
        <PrimeSelect id="product-category" v-model="form.category" :options="categoryNames" option-label="label" option-value="value" editable placeholder="Elige o escribe una" :disabled="saving" fluid />
      </div>
      <div>
        <label for="product-supplier" class="mb-1.5 block text-[11px] font-semibold text-ink">Proveedor</label>
        <PrimeSelect id="product-supplier" v-model="form.supplier" :options="supplierNames" option-label="label" option-value="value" editable placeholder="Elige o escribe uno" :disabled="saving" fluid />
      </div>

      <div>
        <label for="product-cost" class="mb-1.5 block text-[11px] font-semibold text-ink">Costo</label>
        <PrimeInputNumber v-model="form.cost" input-id="product-cost" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.cost)" :disabled="saving" fluid />
        <p v-if="errors.cost" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.cost }}</p>
      </div>
      <div>
        <label for="product-price" class="mb-1.5 block text-[11px] font-semibold text-ink">Precio de venta</label>
        <PrimeInputNumber v-model="form.price" input-id="product-price" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.price)" :disabled="saving" fluid />
        <p v-if="errors.price" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.price }}</p>
      </div>

      <div>
        <label for="product-stock" class="mb-1.5 block text-[11px] font-semibold text-ink">Existencias iniciales</label>
        <PrimeInputNumber v-model="form.stock" input-id="product-stock" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.stock)" :disabled="saving" fluid />
        <p v-if="errors.stock" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.stock }}</p>
        <p v-else class="mt-1.5 text-[11px] text-muted">Después solo cambian con un ajuste registrado.</p>
      </div>
      <div>
        <label for="product-min-stock" class="mb-1.5 block text-[11px] font-semibold text-ink">Stock mínimo</label>
        <PrimeInputNumber v-model="form.minStock" input-id="product-min-stock" :min="0" :max-fraction-digits="0" :invalid="Boolean(errors.minStock)" :disabled="saving" fluid />
        <p v-if="errors.minStock" class="mt-1.5 text-[11px] text-negative" role="alert">{{ errors.minStock }}</p>
      </div>
    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</UiButton>
      <UiButton type="submit" form="product-create-form" :loading="saving" data-testid="product-create-submit">Crear producto</UiButton>
    </template>
  </UiModal>
</template>
