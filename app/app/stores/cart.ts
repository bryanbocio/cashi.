export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'CREDIT'

export type CartProduct = {
  id: string
  sku: string
  name: string
  price: number
  cost: number
  stock: number
}

export type CartItem = CartProduct & { qty: number }

/**
 * Carrito de la Caja.
 *
 * El precio y el costo que guarda son una **copia para mostrar**: sirven para
 * el estimado en pantalla, nunca se envían al cobrar. `create_sale` resuelve
 * los valores actuales en el servidor, que es la única fuente de verdad.
 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const customerId = ref<string | null>(null)
  const paymentMethod = ref<PaymentMethod>('CASH')
  const discount = ref(0)
  const dueDate = ref<Date | null>(null)

  const itemCount = computed(() => items.value.reduce((total, item) => total + item.qty, 0))
  const subtotal = computed(() => items.value.reduce((total, item) => total + item.qty * item.price, 0))
  const total = computed(() => Math.max(subtotal.value - discount.value, 0))

  // Estimado antes de cobrar: la excepción permitida a calcular dinero fuera de
  // Postgres. El descuento resta de la ganancia, igual que en `create_sale`.
  const estimatedProfit = computed(() => (
    items.value.reduce((profit, item) => profit + item.qty * (item.price - item.cost), 0) - discount.value
  ))

  const hasStockWarning = computed(() => items.value.some(item => item.qty > item.stock))
  const isEmpty = computed(() => items.value.length === 0)

  /** Lo único que viaja al servidor: producto y cantidad. */
  const saleLines = computed(() => items.value.map(item => ({ product_id: item.id, qty: item.qty })))

  function add(product: CartProduct, qty = 1) {
    const existing = items.value.find(item => item.id === product.id)
    if (existing) {
      existing.qty += qty
      // El precio pudo cambiar entre búsquedas; se refresca la copia visible.
      existing.price = product.price
      existing.cost = product.cost
      existing.stock = product.stock
      return
    }
    items.value.push({ ...product, qty })
  }

  function setQty(productId: string, qty: number) {
    const item = items.value.find(entry => entry.id === productId)
    if (!item) return
    if (qty <= 0) {
      remove(productId)
      return
    }
    item.qty = qty
  }

  function increment(productId: string) {
    const item = items.value.find(entry => entry.id === productId)
    if (item) item.qty += 1
  }

  function decrement(productId: string) {
    const item = items.value.find(entry => entry.id === productId)
    if (!item) return
    setQty(productId, item.qty - 1)
  }

  function remove(productId: string) {
    items.value = items.value.filter(item => item.id !== productId)
  }

  function clear() {
    items.value = []
    customerId.value = null
    paymentMethod.value = 'CASH'
    discount.value = 0
    dueDate.value = null
  }

  return {
    items,
    customerId,
    paymentMethod,
    discount,
    dueDate,
    itemCount,
    subtotal,
    total,
    estimatedProfit,
    hasStockWarning,
    isEmpty,
    saleLines,
    add,
    setQty,
    increment,
    decrement,
    remove,
    clear,
  }
})
