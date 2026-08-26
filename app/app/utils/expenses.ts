import type { Database } from '~/types/database'

export const EXPENSE_CATEGORIES = [
  'Arriendo',
  'Servicios',
  'Publicidad',
  'Nómina',
  'Insumos',
  'Domicilios',
  'Transporte',
  'Impuestos',
  'Otro',
] as const

export type ExpenseRow = Database['public']['Tables']['expense']['Row']
export type ExpenseCategoryTotal = Database['public']['Functions']['expense_category_totals']['Returns'][number]

/** Convierte un instante del servidor en la fecha de calendario de la zona del negocio. */
export function instantToBusinessDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

/** DatePicker trabaja con Date, pero el gasto guarda una fecha sin zona horaria. */
export function calendarDateToPicker(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!, 12)
}

export function pickerToCalendarDate(value: Date | null) {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(value: string, amount: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day! + amount))
  return date.toISOString().slice(0, 10)
}

export function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
    .replace('.', '')
}
