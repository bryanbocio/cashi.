import type { Database, Json } from '~/types/database'

/**
 * Normalización de las métricas de la Fase 7.
 *
 * Las cuatro RPC devuelven `jsonb`, así que el generador de tipos solo promete
 * `Json`. Aquí se valida una vez la forma del contrato y el resto de la vista
 * trabaja con objetos tipados. Ninguna cifra se recalcula: los montos, los
 * porcentajes y los rangos ya vienen resueltos por Postgres.
 */

export type MetricsPeriod = 'today' | '7d' | 'month'

export const METRICS_PERIODS: Array<{ label: string; shortLabel: string; value: MetricsPeriod }> = [
  { label: 'Hoy', shortLabel: 'Hoy', value: 'today' },
  { label: '7 días', shortLabel: '7 d', value: '7d' },
  { label: 'Mes', shortLabel: 'Mes', value: 'month' },
]

/** Meses navegables del selector de periodo, fijados por el `PLAN.md`. */
export const METRICS_MONTH_OPTIONS = 18

/** Días de la gráfica del Resumen, fijados por el `PLAN.md`. */
export const METRICS_CHART_DAYS = 14

/** Filas de rentabilidad por producto que caben en el panel del Resumen. */
export const METRICS_PRODUCT_LIMIT = 6

/** Ventas recientes listadas bajo la gráfica. */
export const METRICS_RECENT_SALES = 6

export type MetricsRange = {
  from: string
  to: string
  label: string
  previousLabel: string
}

export type MetricsSummary = {
  range: MetricsRange
  revenue: number
  grossProfit: number
  expenses: number
  netProfit: number
  receivable: number
  salesCount: number
  debtorsCount: number
  revenueChange: number
  grossMargin: number
  grossMarginPp: number
  expenseRatio: number
  expenseRatioPp: number
  netMargin: number
  netProfitChange: number
}

export type MetricsDay = {
  date: string
  revenue: number
  grossProfit: number
  salesCount: number
}

export type MetricsProduct = {
  key: string
  productId: string | null
  name: string
  sku: string | null
  category: string
  qty: number
  revenue: number
  grossProfit: number
  marginPct: number | null
  salesCount: number
}

export type MetricsAlertType = 'LOW_STOCK' | 'OVERDUE_CREDIT' | 'PENDING_PURCHASE' | 'THIN_MARGIN'

/**
 * Detalle de una alerta. Cada tipo llena solo sus campos; el resto queda en
 * null y la vista decide qué mostrar según `type`.
 */
export type MetricsAlertItem = {
  key: string
  name: string
  sku: string | null
  stock: number | null
  minStock: number | null
  suggestedQty: number | null
  debt: number | null
  daysOverdue: number | null
  supplier: string | null
  expectedAt: string | null
  totalCost: number | null
  marginPct: number | null
}

export type MetricsAlert = {
  type: MetricsAlertType
  severity: 'negative' | 'neutral'
  count: number
  amount: number | null
  title: string
  target: string
  items: MetricsAlertItem[]
}

export const EMPTY_RANGE: MetricsRange = { from: '', to: '', label: '', previousLabel: '' }

export const EMPTY_SUMMARY: MetricsSummary = {
  range: EMPTY_RANGE,
  revenue: 0,
  grossProfit: 0,
  expenses: 0,
  netProfit: 0,
  receivable: 0,
  salesCount: 0,
  debtorsCount: 0,
  revenueChange: 0,
  grossMargin: 0,
  grossMarginPp: 0,
  expenseRatio: 0,
  expenseRatioPp: 0,
  netMargin: 0,
  netProfitChange: 0,
}

function objectValue(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null
}

function arrayValue(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : []
}

function textValue(value: Json | undefined) {
  return typeof value === 'string' ? value : null
}

function numberValue(value: Json | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** El margen indefinido (ingreso cero) llega como null y debe seguir siendo null. */
function optionalNumber(value: Json | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toRange(value: Json | undefined): MetricsRange {
  const range = objectValue(value)
  if (!range) return EMPTY_RANGE
  return {
    from: textValue(range.from) ?? '',
    to: textValue(range.to) ?? '',
    label: textValue(range.label) ?? '',
    previousLabel: textValue(range.previous_label) ?? '',
  }
}

export function toMetricsSummary(value: Json | null): MetricsSummary {
  const payload = objectValue(value ?? undefined)
  if (!payload) return { ...EMPTY_SUMMARY }
  const pct = objectValue(payload.pct) ?? {}
  return {
    range: toRange(payload.range),
    revenue: numberValue(payload.revenue),
    grossProfit: numberValue(payload.gross_profit),
    expenses: numberValue(payload.expenses),
    netProfit: numberValue(payload.net_profit),
    receivable: numberValue(payload.receivable),
    salesCount: numberValue(payload.sales_count),
    debtorsCount: numberValue(payload.debtors_count),
    revenueChange: numberValue(pct.revenue_change),
    grossMargin: numberValue(pct.gross_margin),
    grossMarginPp: numberValue(pct.gross_margin_pp),
    expenseRatio: numberValue(pct.expense_ratio),
    expenseRatioPp: numberValue(pct.expense_ratio_pp),
    netMargin: numberValue(pct.net_margin),
    netProfitChange: numberValue(pct.net_profit_change),
  }
}

export function toMetricsDays(value: Json | null): MetricsDay[] {
  const payload = objectValue(value ?? undefined)
  if (!payload) return []
  return arrayValue(payload.days).flatMap((raw) => {
    const day = objectValue(raw)
    const date = textValue(day?.date)
    if (!day || !date) return []
    return [{
      date,
      revenue: numberValue(day.revenue),
      grossProfit: numberValue(day.gross_profit),
      salesCount: numberValue(day.sales_count),
    }]
  })
}

export function toMetricsProducts(value: Json | null): MetricsProduct[] {
  const payload = objectValue(value ?? undefined)
  if (!payload) return []
  return arrayValue(payload.products).flatMap((raw, index) => {
    const product = objectValue(raw)
    const name = textValue(product?.name)
    if (!product || !name) return []
    const productId = textValue(product.product_id)
    return [{
      // El producto borrado no tiene id, pero sigue necesitando una clave estable.
      key: productId ?? `${name}:${index}`,
      productId,
      name,
      sku: textValue(product.sku),
      category: textValue(product.category) ?? 'Sin categoría',
      qty: numberValue(product.qty),
      revenue: numberValue(product.revenue),
      grossProfit: numberValue(product.gross_profit),
      marginPct: optionalNumber(product.margin_pct),
      salesCount: numberValue(product.sales_count),
    }]
  })
}

function toAlertItem(raw: Json, index: number): MetricsAlertItem[] {
  const item = objectValue(raw)
  if (!item) return []
  const name = textValue(item.name) ?? textValue(item.code)
  if (!name) return []
  const id = textValue(item.product_id) ?? textValue(item.customer_id) ?? textValue(item.order_id)
  return [{
    key: id ?? `${name}:${index}`,
    name,
    sku: textValue(item.sku),
    stock: optionalNumber(item.stock),
    minStock: optionalNumber(item.min_stock),
    suggestedQty: optionalNumber(item.suggested_qty),
    debt: optionalNumber(item.debt),
    daysOverdue: optionalNumber(item.days_overdue),
    supplier: textValue(item.supplier),
    expectedAt: textValue(item.expected_at),
    totalCost: optionalNumber(item.total_cost),
    marginPct: optionalNumber(item.margin_pct),
  }]
}

const ALERT_TYPES: MetricsAlertType[] = ['LOW_STOCK', 'OVERDUE_CREDIT', 'PENDING_PURCHASE', 'THIN_MARGIN']

export function toMetricsAlerts(value: Json | null): MetricsAlert[] {
  const payload = objectValue(value ?? undefined)
  if (!payload) return []
  return arrayValue(payload.alerts).flatMap((raw) => {
    const alert = objectValue(raw)
    const type = textValue(alert?.type)
    const title = textValue(alert?.title)
    const target = textValue(alert?.target)
    if (!alert || !title || !target || !ALERT_TYPES.includes(type as MetricsAlertType)) return []
    return [{
      type: type as MetricsAlertType,
      severity: textValue(alert.severity) === 'negative' ? 'negative' as const : 'neutral' as const,
      count: numberValue(alert.count),
      amount: optionalNumber(alert.amount),
      title,
      target,
      items: arrayValue(alert.items).flatMap(toAlertItem),
    }]
  })
}

/** Llamada a la acción de cada grupo, según a dónde lleva su `target`. */
export function alertActionLabel(type: MetricsAlertType) {
  return ({
    LOW_STOCK: 'Reponer',
    OVERDUE_CREDIT: 'Cobrar',
    PENDING_PURCHASE: 'Recibir',
    THIN_MARGIN: 'Revisar',
  } as const)[type]
}

/**
 * Color de una variación. Los gastos y la proporción de gastos mejoran cuando
 * bajan, así que el signo por sí solo no basta para decidir el color.
 */
export function changeTone(value: number, higherIsBetter = true) {
  if (!value) return 'neutral' as const
  return (value > 0) === higherIsBetter ? 'positive' as const : 'negative' as const
}

/** Escala de color del margen usada en la rentabilidad por producto. */
export function marginTone(marginPct: number | null) {
  if (marginPct === null) return 'neutral' as const
  if (marginPct >= 35) return 'positive' as const
  if (marginPct >= 20) return 'neutral' as const
  return 'negative' as const
}

/**
 * Nombres de mes en español, copiados de `private.period_label`: la etiqueta
 * del selector tiene que coincidir letra por letra con la que devuelve
 * `metrics_summary`, o el mismo mes aparecería escrito de dos formas.
 */
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Los últimos meses contados desde el mes en curso **del negocio**: quien
 * consulta desde otra zona horaria no debe ver un mes de más ni de menos.
 * El valor es el `month_offset` que espera Postgres: 0 es el mes actual.
 */
export function monthOffsetOptions(timezone: string, count = METRICS_MONTH_OPTIONS) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric' })
    .formatToParts(new Date())
  const current = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]))
  const year = current.year ?? new Date().getFullYear()
  const month = current.month ?? new Date().getMonth() + 1

  return Array.from({ length: count }, (_, offset) => {
    // `month` es 1–12; el índice negativo se resuelve con Date en UTC.
    const date = new Date(Date.UTC(year, month - 1 - offset, 1))
    return {
      value: offset,
      label: `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    }
  })
}

/** Etiqueta corta del eje de la gráfica: `27 ago`. */
export function formatChartDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
    .replace('.', '')
}

/** Solo las columnas que pide RECENT_SALE_COLUMNS. */
type SaleDetailRow = Pick<
  Database['public']['Views']['v_sale_detail']['Row'],
  'id' | 'code' | 'customer_name' | 'payment_method' | 'sold_at' | 'total' | 'gross_profit' | 'items'
>

export type RecentSale = {
  id: string
  code: string
  customerName: string | null
  paymentMethod: Database['public']['Enums']['payment_method']
  soldAt: string
  total: number
  grossProfit: number
  items: number
}

export const RECENT_SALE_COLUMNS = 'id, code, customer_name, payment_method, sold_at, total, gross_profit, items'

export const SALE_METHOD_LABELS: Record<Database['public']['Enums']['payment_method'], string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CREDIT: 'Fiado',
}

export function toRecentSale(row: SaleDetailRow): RecentSale[] {
  if (!row.id || !row.code || !row.sold_at || !row.payment_method) return []
  return [{
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    paymentMethod: row.payment_method,
    soldAt: row.sold_at,
    total: row.total ?? 0,
    grossProfit: row.gross_profit ?? 0,
    items: row.items ?? 0,
  }]
}

/** Hora local del negocio para la lista de últimas ventas. */
export function formatSaleTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant))
}
