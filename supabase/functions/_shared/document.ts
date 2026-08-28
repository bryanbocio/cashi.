/**
 * Modelo del documento imprimible: factura y cotización comparten plantilla.
 *
 * Este módulo es lógica pura —sin APIs de Deno ni de pdf-lib— para poder
 * probarlo fuera del runtime. Aquí no se calcula dinero nuevo: los importes
 * llegan resueltos por Postgres y solo se ordenan, se etiquetan y se formatean.
 */

export type DocumentType = 'SALE' | 'QUOTE'

export type DocumentBusiness = {
  name: string
  nit: string | null
  phone: string | null
  address: string | null
  currency: string
  timezone: string
}

export type DocumentLineInput = {
  name: string
  qty: number
  unitPrice: number
}

export type DocumentSource = {
  type: DocumentType
  code: string
  customerName: string | null
  /** Instante de la venta o de la creación de la cotización. */
  issuedAt: string
  /** Venta: método de pago. Cotización: null. */
  paymentMethod: string | null
  /** Venta a crédito: fecha de pago. Cotización: fecha de vigencia. */
  limitDate: string | null
  status: string
  discount: number
  total: number
  lines: DocumentLineInput[]
}

export type DocumentLine = DocumentLineInput & { lineTotal: number }

export type DocumentModel = {
  title: string
  code: string
  business: DocumentBusiness
  /** Pares etiqueta/valor del bloque de datos, ya en el orden de impresión. */
  meta: Array<{ label: string; value: string }>
  lines: DocumentLine[]
  totals: Array<{ label: string; value: string; emphasis: boolean }>
  note: string
  /** Sello diagonal para documentos que ya no valen. Vacío si el documento vale. */
  stamp: string
  fileName: string
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CREDIT: 'Fiado',
}

/** Los montos son enteros en la moneda del negocio; nunca se dividen entre 100. */
export function formatDocumentMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace(/\s/g, ' ')
}

/** Fecha de calendario `YYYY-MM-DD` en formato legible, sin conversión de zona. */
export function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

/** Instante del servidor expresado en la zona horaria del negocio. */
export function formatInstant(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace(/\s/g, ' ')
}

function saleNote(source: DocumentSource, business: DocumentBusiness) {
  if (source.status === 'VOID') return 'Esta venta fue anulada y no tiene valor como comprobante.'
  if (source.paymentMethod === 'CREDIT') {
    return source.limitDate
      ? `Venta a crédito. El pago vence el ${formatCalendarDate(source.limitDate)}.`
      : 'Venta a crédito, sin fecha de pago acordada.'
  }
  return `Gracias por su compra en ${business.name}.`
}

function quoteNote(source: DocumentSource) {
  if (source.status === 'CONVERTED') return 'Esta cotización ya se convirtió en venta.'
  if (source.status === 'EXPIRED') {
    return `Esta cotización venció el ${formatCalendarDate(source.limitDate ?? '')} y sus precios pueden haber cambiado.`
  }
  return source.limitDate
    ? `Precios válidos hasta el ${formatCalendarDate(source.limitDate)}. No incluye reserva de existencias.`
    : 'No incluye reserva de existencias.'
}

/** Un documento que ya no vale se marca en diagonal para que no se confunda. */
function stampFor(source: DocumentSource) {
  if (source.type === 'SALE') return source.status === 'VOID' ? 'ANULADA' : ''
  if (source.status === 'EXPIRED') return 'VENCIDA'
  if (source.status === 'CONVERTED') return 'CONVERTIDA'
  return ''
}

export function buildDocumentModel(business: DocumentBusiness, source: DocumentSource): DocumentModel {
  const isSale = source.type === 'SALE'
  const lines = source.lines.map(line => ({ ...line, lineTotal: line.qty * line.unitPrice }))
  const subtotal = lines.reduce((accumulated, line) => accumulated + line.lineTotal, 0)

  const meta: Array<{ label: string; value: string }> = [
    { label: 'Cliente', value: source.customerName?.trim() || 'Mostrador' },
    { label: isSale ? 'Fecha' : 'Emitida', value: formatInstant(source.issuedAt, business.timezone) },
  ]

  if (isSale && source.paymentMethod) {
    meta.push({ label: 'Pago', value: PAYMENT_METHOD_LABELS[source.paymentMethod] ?? source.paymentMethod })
  }
  if (!isSale && source.limitDate) {
    meta.push({ label: 'Válida hasta', value: formatCalendarDate(source.limitDate) })
  }
  if (isSale && source.paymentMethod === 'CREDIT' && source.limitDate) {
    meta.push({ label: 'Vence', value: formatCalendarDate(source.limitDate) })
  }

  const totals: Array<{ label: string; value: string; emphasis: boolean }> = [
    { label: 'Subtotal', value: formatDocumentMoney(subtotal, business.currency), emphasis: false },
  ]
  // El descuento solo se imprime cuando existe: una línea en cero confunde.
  if (source.discount > 0) {
    totals.push({ label: 'Descuento', value: `− ${formatDocumentMoney(source.discount, business.currency)}`, emphasis: false })
  }
  totals.push({ label: 'Total', value: formatDocumentMoney(source.total, business.currency), emphasis: true })

  return {
    title: isSale ? 'Factura de venta' : 'Cotización',
    code: source.code,
    business,
    meta,
    lines,
    totals,
    note: isSale ? saleNote(source, business) : quoteNote(source),
    stamp: stampFor(source),
    fileName: `${isSale ? 'factura' : 'cotizacion'}-${source.code.toLowerCase()}.pdf`,
  }
}

/**
 * Reparte las líneas en páginas. La primera cabe menos porque lleva el
 * encabezado del negocio; la última reserva sitio para totales y nota.
 */
export function paginateLines<T>(lines: T[], firstPage: number, nextPages: number): T[][] {
  if (!lines.length) return [[]]
  const pages: T[][] = []
  let index = 0
  while (index < lines.length) {
    const size = pages.length === 0 ? firstPage : nextPages
    pages.push(lines.slice(index, index + size))
    index += size
  }
  return pages
}
