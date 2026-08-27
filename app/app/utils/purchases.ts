import type { Database, Json } from '~/types/database'
import { formatCalendarDate, instantToBusinessDate } from '~/utils/expenses'

type PurchaseViewRow = Database['public']['Views']['v_purchase_orders']['Row']
export type PurchaseStatus = Database['public']['Enums']['purchase_status']

export type PurchaseSuggestionLine = {
  productId: string
  name: string
  sku: string
  categoryName: string | null
  supplierId: string | null
  supplierName: string | null
  stock: number
  minStock: number
  suggestedQty: number
  unitCost: number
  estimatedCost: number
}

export type PurchaseSuggestion = {
  productCount: number
  totalUnits: number
  estimatedTotal: number
  lines: PurchaseSuggestionLine[]
}

export type PurchaseOrderRow = {
  id: string
  businessId: string
  code: string
  supplierId: string | null
  supplierName: string
  status: PurchaseStatus
  expectedAt: string | null
  receivedAt: string | null
  createdAt: string
  lineCount: number
  totalUnits: number
  totalCost: number
}

export const EMPTY_PURCHASE_SUGGESTION: PurchaseSuggestion = {
  productCount: 0,
  totalUnits: 0,
  estimatedTotal: 0,
  lines: [],
}

function objectValue(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null
}

function textValue(value: Json | undefined) {
  return typeof value === 'string' ? value : null
}

function numberValue(value: Json | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function toPurchaseSuggestion(value: Json | null): PurchaseSuggestion {
  const payload = objectValue(value ?? undefined)
  if (!payload) return { ...EMPTY_PURCHASE_SUGGESTION, lines: [] }
  const rawLines = Array.isArray(payload.lines) ? payload.lines : []
  const lines = rawLines.flatMap((raw) => {
    const line = objectValue(raw)
    const productId = textValue(line?.product_id)
    const name = textValue(line?.name)
    const sku = textValue(line?.sku)
    if (!line || !productId || !name || !sku) return []
    return [{
      productId,
      name,
      sku,
      categoryName: textValue(line.category_name),
      supplierId: textValue(line.supplier_id),
      supplierName: textValue(line.supplier_name),
      stock: numberValue(line.stock),
      minStock: numberValue(line.min_stock),
      suggestedQty: numberValue(line.suggested_qty),
      unitCost: numberValue(line.unit_cost),
      estimatedCost: numberValue(line.estimated_cost),
    }]
  })

  return {
    productCount: numberValue(payload.product_count),
    totalUnits: numberValue(payload.total_units),
    estimatedTotal: numberValue(payload.estimated_total),
    lines,
  }
}

export function toPurchaseOrderRow(row: PurchaseViewRow): PurchaseOrderRow | null {
  if (!row.id || !row.business_id || !row.code || !row.status || !row.created_at) return null
  return {
    id: row.id,
    businessId: row.business_id,
    code: row.code,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? 'Sin proveedor',
    status: row.status,
    expectedAt: row.expected_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    lineCount: row.line_count ?? 0,
    totalUnits: row.total_units ?? 0,
    totalCost: row.total_cost ?? 0,
  }
}

export function purchaseStatusLabel(status: PurchaseStatus) {
  return ({ PENDING: 'Pendiente', RECEIVED: 'Recibida', CANCELLED: 'Cancelada' } as const)[status]
}

export function purchaseStatusTone(status: PurchaseStatus): 'negative' | 'positive' | 'neutral' {
  return status === 'PENDING' ? 'negative' : status === 'RECEIVED' ? 'positive' : 'neutral'
}

export function formatPurchaseInstant(value: string, timezone: string) {
  return formatCalendarDate(instantToBusinessDate(value, timezone))
}
