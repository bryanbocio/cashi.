import type { Database } from '~/types/database'
import { formatCalendarDate, instantToBusinessDate } from '~/utils/expenses'

type CreditViewRow = Database['public']['Views']['v_credits']['Row']

export type CreditRow = {
  customerId: string
  businessId: string
  name: string
  phone: string | null
  totalCredit: number
  totalPaid: number
  debt: number
  creditSalesCount: number
  oldestDueDate: string | null
  isOverdue: boolean
  daysOverdue: number
  lastCreditAt: string | null
  lastPaymentAt: string | null
}

export const PAYMENT_METHODS = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Tarjeta', value: 'CARD' },
]

export function toCreditRow(row: CreditViewRow): CreditRow | null {
  if (!row.customer_id || !row.business_id || !row.customer_name) return null
  return {
    customerId: row.customer_id,
    businessId: row.business_id,
    name: row.customer_name,
    phone: row.customer_phone,
    totalCredit: row.total_credit ?? 0,
    totalPaid: row.total_paid ?? 0,
    debt: row.debt ?? 0,
    creditSalesCount: row.credit_sales_count ?? 0,
    oldestDueDate: row.oldest_due_date,
    isOverdue: row.is_overdue ?? false,
    daysOverdue: row.days_overdue ?? 0,
    lastCreditAt: row.last_credit_at,
    lastPaymentAt: row.last_payment_at,
  }
}

export function formatCreditInstant(value: string | null, timezone: string) {
  if (!value) return '—'
  return formatCalendarDate(instantToBusinessDate(value, timezone))
}
