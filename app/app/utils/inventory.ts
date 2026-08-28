import type { Database } from '~/types/database'

/** Solo las columnas que pide PRODUCT_STATS_COLUMNS: el `select` de PostgREST
 *  ya estrecha la fila, así que aceptar la vista completa no compila. */
type ProductStatsRow = Pick<
  Database['public']['Views']['v_product_stats']['Row'],
  'id' | 'name' | 'sku' | 'category_id' | 'category_name' | 'supplier_id' | 'supplier_name'
  | 'cost' | 'price' | 'stock' | 'min_stock' | 'margin_amount' | 'margin_pct'
  | 'inventory_value' | 'is_low_stock' | 'is_thin_margin'
>

/**
 * Fila de inventario ya normalizada.
 *
 * Postgres no infiere `not null` en las vistas, así que `v_product_stats`
 * llega con todas sus columnas opcionales. En vez de arrastrar ese ruido por
 * toda la UI se normaliza una sola vez aquí; las columnas calculadas siempre
 * traen valor salvo `marginPct`, que es null cuando el precio es cero.
 */
export type ProductRow = {
  id: string
  name: string
  sku: string
  categoryId: string | null
  categoryName: string | null
  supplierId: string | null
  supplierName: string | null
  cost: number
  price: number
  stock: number
  minStock: number
  marginAmount: number
  marginPct: number | null
  inventoryValue: number
  isLowStock: boolean
  isThinMargin: boolean
}

export const PRODUCT_STATS_COLUMNS = 'id, name, sku, category_id, category_name, supplier_id, supplier_name, cost, price, stock, min_stock, margin_amount, margin_pct, inventory_value, is_low_stock, is_thin_margin'

export function toProductRow(row: ProductStatsRow): ProductRow {
  return {
    id: row.id ?? '',
    name: row.name ?? '',
    sku: row.sku ?? '',
    categoryId: row.category_id,
    categoryName: row.category_name,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    cost: row.cost ?? 0,
    price: row.price ?? 0,
    stock: row.stock ?? 0,
    minStock: row.min_stock ?? 0,
    marginAmount: row.margin_amount ?? 0,
    marginPct: row.margin_pct,
    inventoryValue: row.inventory_value ?? 0,
    isLowStock: row.is_low_stock ?? false,
    isThinMargin: row.is_thin_margin ?? false,
  }
}

/**
 * El filtro `or` de PostgREST separa condiciones con comas y las agrupa con
 * paréntesis, así que un término con esos caracteres rompería la consulta.
 * Se eliminan en vez de escaparlos: nadie busca un producto por ellos.
 */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()"\\]/g, ' ').trim()
}

/** Estimado del panel antes de guardar; el valor de verdad lo recalcula la vista. */
export function estimateMarginPct(cost: number, price: number) {
  if (price <= 0) return null
  return Math.round(((price - cost) * 100 / price) * 100) / 100
}

export const THIN_MARGIN_THRESHOLD = 20

export const adjustmentReasons = [
  { label: 'Conteo físico', value: 'Conteo físico' },
  { label: 'Merma o daño', value: 'Merma o daño' },
  { label: 'Devolución de cliente', value: 'Devolución de cliente' },
  { label: 'Corrección de carga', value: 'Corrección de carga' },
  { label: 'Otro motivo', value: 'custom' },
]

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

/** Encabezados que acepta la Edge Function, con una fila de ejemplo. */
export const CSV_TEMPLATE = [
  'sku,nombre,categoria,proveedor,costo,precio,stock,stock_minimo',
  'PER-100,Perfume de ejemplo 50 ml,Perfumería,Mi Proveedor,48000,79000,10,4',
].join('\n') + '\n'

/**
 * Prefijo de SKU a partir del nombre del producto.
 *
 * Tres letras sin tildes ni signos, tomadas de las primeras palabras: «Perfume
 * Aurora 50 ml» da `PER` y «Té verde» da `TEV`. Es la misma nomenclatura que
 * usa el seed, para que un catálogo escrito a mano y otro generado se lean
 * igual.
 */
export function skuPrefixFromName(name: string) {
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join('')

  if (!letters) return 'PRD'
  return letters.slice(0, 3).padEnd(3, 'X')
}

/** `PER` + 7 → `PER-007`. Cuatro dígitos solo si el catálogo los necesita. */
export function buildSku(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(3, '0')}`
}

/** Siguiente número libre del prefijo, mirando los SKU que ya existen. */
export function nextSkuSequence(existing: string[], prefix: string) {
  // El patrón se arma con plantilla, así que la barra del `\d` va escapada.
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  const used = existing
    .map(sku => pattern.exec(sku.trim())?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
  return used.length ? Math.max(...used) + 1 : 1
}
