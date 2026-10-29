import type { Database } from '~/types/database'
import { formatCalendarDate, instantToBusinessDate } from '~/utils/expenses'

type QuoteViewRow = Pick<Database['public']['Views']['v_quote_detail']['Row'],
  'id' | 'business_id' | 'code' | 'customer_id' | 'customer_name' |
  'valid_until' | 'status' | 'subtotal' | 'discount' | 'total' | 'created_at' | 'line_count' |
  'total_units' | 'detail'
>
export type QuoteStatus = Database['public']['Enums']['quote_status']

export type QuoteRow = {
  id: string
  businessId: string
  code: string
  customerId: string | null
  customerName: string
  validUntil: string
  status: QuoteStatus
  subtotal: number
  discount: number
  total: number
  createdAt: string
  lineCount: number
  totalUnits: number
  detail: string
}

export function toQuoteRow(row: QuoteViewRow): QuoteRow | null {
  if (!row.id || !row.business_id || !row.code || !row.valid_until || !row.status || !row.created_at) return null
  return {
    id: row.id,
    businessId: row.business_id,
    code: row.code,
    customerId: row.customer_id,
    customerName: row.customer_name ?? 'Sin cliente',
    validUntil: row.valid_until,
    status: row.status,
    subtotal: row.subtotal ?? row.total ?? 0,
    discount: row.discount ?? 0,
    total: row.total ?? 0,
    createdAt: row.created_at,
    lineCount: row.line_count ?? 0,
    totalUnits: row.total_units ?? 0,
    detail: row.detail ?? '',
  }
}

export function quoteStatusLabel(status: QuoteStatus) {
  return ({ OPEN: 'Vigente', EXPIRED: 'Vencida', CONVERTED: 'Convertida', CANCELLED: 'Cancelada' } as const)[status]
}

export function quoteStatusTone(status: QuoteStatus): 'accent' | 'negative' | 'positive' | 'neutral' {
  if (status === 'OPEN') return 'accent'
  if (status === 'EXPIRED') return 'negative'
  if (status === 'CONVERTED') return 'positive'
  return 'neutral'
}

export function formatQuoteInstant(value: string, timezone: string) {
  return formatCalendarDate(instantToBusinessDate(value, timezone))
}
