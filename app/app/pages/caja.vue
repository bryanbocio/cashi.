<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { CartProduct } from '~/stores/cart'

definePageMeta({ middleware: 'business' })
useHead({ title: 'Caja · Cashi' })

type Option = { label: string; value: string }
type SaleResult = { code?: string; total?: number }

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const cart = useCartStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()

const customers = ref<Option[]>([])
const charging = ref(false)
const search = ref<{ loadFrequent: () => Promise<void> } | null>(null)

async function loadCustomers(businessId: string) {
  const data = await execute(client.from('customer').select('id, name').eq('business_id', businessId).order('name'))
  customers.value = (data ?? []).map(item => ({ label: item.name, value: item.id }))
}

// Cambiar de negocio no puede dejar el carrito del anterior en pantalla.
watch(() => businessStore.activeBusinessId, businessId => {
  cart.clear()
  customers.value = []
  if (businessId) loadCustomers(businessId)
}, { immediate: true })

function addProduct(product: CartProduct) {
  cart.add(product)
}

/** La fecha viaja como `YYYY-MM-DD`: es una fecha del negocio, no un instante. */
function toIsoDate(value: Date | null) {
  if (!value) return null
  const offset = value.getTimezoneOffset() * 60000
  return new Date(value.getTime() - offset).toISOString().slice(0, 10)
}

async function charge() {
  const businessId = businessStore.activeBusinessId
  if (!businessId || cart.isEmpty || charging.value) return

  charging.value = true
  try {
    // El carrito manda producto y cantidad; el precio lo resuelve el servidor.
    // `p_customer` y `p_due` aceptan null en SQL, pero el generador de tipos no
    // modela la nulabilidad de los argumentos y los declara obligatorios.
    const args = {
      p_business: businessId,
      p_customer: cart.customerId,
      p_method: cart.paymentMethod,
      p_discount: cart.discount,
      p_due: toIsoDate(cart.dueDate),
      p_lines: cart.saleLines,
    } as Database['public']['Functions']['create_sale']['Args']

    const sale = await execute(client.rpc('create_sale', args)) as SaleResult | null

    toast.add({
      severity: 'success',
      summary: `Venta ${sale?.code ?? ''} registrada`.trim(),
      detail: `Cobraste ${formatMoney(sale?.total ?? cart.total)}.`,
      life: 5000,
    })

    cart.clear()
    await search.value?.loadFrequent()
  } catch {
    // El wrapper ya mostró el error del backend, incluido el de fiado sin cliente.
  } finally {
    charging.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Punto de venta</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Caja</h1>
      <p class="max-w-155 text-[13.5px] text-muted">Busca productos, arma el carrito y cobra. El stock baja al confirmar la venta.</p>
    </header>

    <div class="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-4 max-[1120px]:grid-cols-1">
      <div class="grid gap-4">
        <CajaProductSearch ref="search" @select="addProduct" />
        <CajaCartList
          :items="cart.items"
          @increment="cart.increment"
          @decrement="cart.decrement"
          @remove="cart.remove"
        />
      </div>

      <CajaPaymentPanel
        class="min-[1120px]:sticky min-[1120px]:top-6"
        :customers="customers"
        :charging="charging"
        @charge="charge"
      />
    </div>
  </section>
</template>
