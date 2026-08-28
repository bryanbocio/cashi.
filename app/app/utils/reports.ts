import type { Database, Json } from '~/types/database'
import { SALE_METHOD_LABELS } from '~/utils/metrics'

/**
 * Historial y exportación de Reportes.
 *
 * El historial sale de `v_sale_detail`, la misma vista que usa el Resumen, pero
 * acotado al periodo y sin límite de filas. Las cifras no se recalculan aquí:
 * `total` y `gross_profit` ya vienen resueltos por Postgres.
 */

type SaleHistoryViewRow = Pick<
  Database['public']['Views']['v_sale_detail']['Row'],
  'id' | 'code' | 'customer_name' | 'payment_method' | 'status' | 'sold_at' | 'total' | 'discount' | 'gross_profit' | 'items' | 'line_count'
>

export type SaleHistoryRow = {
  id: string
  code: string
  customerName: string | null
  paymentMethod: Database['public']['Enums']['payment_method']
  status: Database['public']['Enums']['sale_status']
  soldAt: string
  total: number
  discount: number
  grossProfit: number
  items: number
  lineCount: number
}

export const SALE_HISTORY_COLUMNS = 'id, code, customer_name, payment_method, status, sold_at, total, discount, gross_profit, items, line_count'

/**
 * `metrics_products` acota a 100 filas. Un negocio que venda más de cien
 * productos distintos en un periodo vería como «menos rentable» el número cien,
 * no el último; es el techo que impone la RPC y no se disimula en el cliente.
 */
export const REPORT_PRODUCT_LIMIT = 100

export function toSaleHistoryRow(row: SaleHistoryViewRow): SaleHistoryRow[] {
  if (!row.id || !row.code || !row.sold_at || !row.payment_method || !row.status) return []
  return [{
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    paymentMethod: row.payment_method,
    status: row.status,
    soldAt: row.sold_at,
    total: row.total ?? 0,
    discount: row.discount ?? 0,
    grossProfit: row.gross_profit ?? 0,
    items: row.items ?? 0,
    lineCount: row.line_count ?? 0,
  }]
}

export type CategoryProfit = {
  category: string
  qty: number
  revenue: number
  grossProfit: number
  marginPct: number | null
  salesCount: number
  productCount: number
}

function objectValue(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null
}

function numberValue(value: Json | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function toCategoryProfits(value: Json | null): CategoryProfit[] {
  const payload = objectValue(value ?? undefined)
  if (!payload) return []
  const rows = Array.isArray(payload.categories) ? payload.categories : []
  return rows.flatMap((raw) => {
    const item = objectValue(raw)
    const category = typeof item?.category === 'string' ? item.category : null
    if (!item || !category) return []
    return [{
      category,
      qty: numberValue(item.qty),
      revenue: numberValue(item.revenue),
      grossProfit: numberValue(item.gross_profit),
      marginPct: typeof item.margin_pct === 'number' ? item.margin_pct : null,
      salesCount: numberValue(item.sales_count),
      productCount: numberValue(item.product_count),
    }]
  })
}

/** Un valor por celda, con comillas solo cuando hace falta escaparlo. */
function csvCell(value: string | number) {
  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV del historial del periodo.
 *
 * Separador `;` y BOM: Excel en español abre así el archivo con las columnas
 * separadas y las tildes correctas. Los montos van como enteros sin formato
 * para que la hoja de cálculo pueda sumarlos.
 */
export function buildSalesCsv(rows: SaleHistoryRow[], businessDate: (instant: string) => string) {
  const header = ['Codigo', 'Fecha', 'Cliente', 'Pago', 'Estado', 'Articulos', 'Descuento', 'Total', 'Ganancia']
  const lines = rows.map(row => [
    row.code,
    businessDate(row.soldAt),
    row.customerName ?? 'Mostrador',
    SALE_METHOD_LABELS[row.paymentMethod],
    // La anulada se exporta con sus cifras, pero marcada: quien suma la hoja
    // debe poder descontarla igual que la hacen las métricas.
    row.status === 'VOID' ? 'Anulada' : 'Confirmada',
    row.items,
    row.discount,
    row.total,
    row.grossProfit,
  ].map(csvCell).join(';'))

  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`
}

/** Nombre estable y ordenable: `ventas-2026-08-01-2026-08-31.csv`. */
export function salesCsvName(from: string, to: string) {
  return `ventas-${from}-${to}.csv`
}
