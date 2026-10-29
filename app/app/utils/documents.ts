import type { Database } from '~/types/database'
import { SALE_METHOD_LABELS, formatSaleTime } from '~/utils/metrics'
import { formatCalendarDate, instantToBusinessDate } from '~/utils/expenses'

/**
 * Documento imprimible visto desde el cliente.
 *
 * El PDF lo compone la Edge Function `document-pdf`; esta vista HTML existe
 * para que el usuario vea lo que va a descargar y para poder exportarlo como
 * imagen sin salir del navegador. Las dos representaciones cuentan lo mismo:
 * si aquí cambia una nota o un sello, hay que cambiarlo también en
 * `supabase/functions/_shared/document.ts`.
 */

export type DocumentKind = 'SALE' | 'QUOTE'

export type DocumentLine = {
  id: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export type DocumentView = {
  kind: DocumentKind
  id: string
  code: string
  title: string
  customerName: string
  customerPhone: string | null
  issuedLabel: string
  /** Segunda etiqueta del encabezado: método de pago o vigencia. */
  detail: { label: string; value: string } | null
  status: string
  subtotal: number
  discount: number
  total: number
  lines: DocumentLine[]
  note: string
  stamp: string
  /** Solo una cotización vigente se puede convertir desde el visor. */
  canConvert: boolean
}

type Client = ReturnType<typeof useSupabaseClient<Database>>

function saleNote(status: string, method: string, dueDate: string | null, businessName: string) {
  if (status === 'VOID') return 'Esta venta fue anulada y no tiene valor como comprobante.'
  if (method === 'CREDIT') {
    return dueDate
      ? `Venta a crédito. El pago vence el ${formatCalendarDate(dueDate)}.`
      : 'Venta a crédito, sin fecha de pago acordada.'
  }
  return `Gracias por su compra en ${businessName}.`
}

function quoteNote(status: string, validUntil: string) {
  if (status === 'CONVERTED') return 'Esta cotización ya se convirtió en venta.'
  if (status === 'EXPIRED') return `Esta cotización venció el ${formatCalendarDate(validUntil)} y sus precios pueden haber cambiado.`
  return `Precios válidos hasta el ${formatCalendarDate(validUntil)}. No incluye reserva de existencias.`
}

function issuedLabel(instant: string, timezone: string) {
  return `${formatCalendarDate(instantToBusinessDate(instant, timezone))} · ${formatSaleTime(instant, timezone)}`
}

export async function loadSaleDocument(client: Client, id: string, timezone: string, businessName: string) {
  const { data: sale, error } = await client
    .from('v_sale_detail')
    .select('id, code, customer_name, payment_method, status, discount, subtotal, total, due_date, sold_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !sale?.id || !sale.code || !sale.sold_at || !sale.payment_method) return null

  const { data: lines } = await client
    .from('sale_line')
    .select('id, name_snapshot, qty, unit_price')
    .eq('sale_id', id)
    .order('name_snapshot')

  const view: DocumentView = {
    kind: 'SALE',
    id: sale.id,
    code: sale.code,
    title: 'Factura de venta',
    customerName: sale.customer_name ?? 'Mostrador',
    customerPhone: null,
    issuedLabel: issuedLabel(sale.sold_at, timezone),
    detail: { label: 'Pago', value: SALE_METHOD_LABELS[sale.payment_method] },
    status: sale.status ?? 'CONFIRMED',
    subtotal: sale.subtotal ?? 0,
    discount: sale.discount ?? 0,
    total: sale.total ?? 0,
    lines: (lines ?? []).map(line => ({
      id: line.id,
      name: line.name_snapshot,
      qty: line.qty,
      unitPrice: line.unit_price,
      lineTotal: line.qty * line.unit_price,
    })),
    note: saleNote(sale.status ?? 'CONFIRMED', sale.payment_method, sale.due_date, businessName),
    stamp: sale.status === 'VOID' ? 'ANULADA' : '',
    canConvert: false,
  }
  return view
}

export async function loadQuoteDocument(client: Client, id: string, timezone: string) {
  const { data: quote, error } = await client
    .from('v_quote_detail')
    .select('id, code, customer_name, customer_phone, valid_until, status, subtotal, discount, total, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !quote?.id || !quote.code || !quote.created_at || !quote.valid_until) return null

  const { data: lines } = await client
    .from('v_quote_line_detail')
    .select('line_id, name_snapshot, qty, unit_price, line_total')
    .eq('quote_id', id)
    .order('name_snapshot')

  const status = quote.status ?? 'OPEN'
  const view: DocumentView = {
    kind: 'QUOTE',
    id: quote.id,
    code: quote.code,
    title: 'Cotización',
    customerName: quote.customer_name ?? 'Sin cliente',
    customerPhone: quote.customer_phone,
    issuedLabel: issuedLabel(quote.created_at, timezone),
    detail: { label: 'Válida hasta', value: formatCalendarDate(quote.valid_until) },
    status,
    subtotal: quote.subtotal ?? quote.total ?? 0,
    discount: quote.discount ?? 0,
    total: quote.total ?? 0,
    lines: (lines ?? []).map(line => ({
      id: line.line_id ?? '',
      name: line.name_snapshot ?? '',
      qty: line.qty ?? 0,
      unitPrice: line.unit_price ?? 0,
      lineTotal: line.line_total ?? 0,
    })),
    note: quoteNote(status, quote.valid_until),
    stamp: status === 'EXPIRED' ? 'VENCIDA' : status === 'CONVERTED' ? 'CONVERTIDA' : '',
    canConvert: status === 'OPEN',
  }
  return view
}

export function documentFileName(view: DocumentView, extension: 'pdf' | 'png') {
  const prefix = view.kind === 'SALE' ? 'factura' : 'cotizacion'
  return `${prefix}-${view.code.toLowerCase()}.${extension}`
}

/** Descarga en el navegador sin pasar por el servidor. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadDocumentPdf(client: Client, view: DocumentView) {
  const { data, error } = await client.functions.invoke('document-pdf', {
    body: { type: view.kind, id: view.id },
  })
  if (error || !(data instanceof Blob)) throw error ?? new Error('La función no devolvió un PDF.')
  saveBlob(data, documentFileName(view, 'pdf'))
}

/**
 * Exporta el papel como PNG dibujando su HTML dentro de un SVG `foreignObject`.
 *
 * Es la misma técnica del prototipo y no necesita ninguna librería, pero exige
 * que el papel esté maquetado con estilos en línea: una hoja de estilos externa
 * no viaja dentro del SVG. Tampoco viajan las tipografías web ni las imágenes
 * remotas, por eso el logo se incrusta como `data:`. Algunos navegadores lo
 * rechazan, así que la función avisa en vez de romperse.
 */
export async function exportNodeAsPng(node: HTMLElement, fileName: string) {
  const { width, height } = node.getBoundingClientRect()
  const pixelWidth = Math.ceil(width)
  const pixelHeight = Math.ceil(height)
  const markup = new XMLSerializer().serializeToString(node)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}">`
    + `<foreignObject width="100%" height="100%">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${pixelWidth}px;background:#ffffff">${markup}</div>`
    + `</foreignObject></svg>`

  const blob = await new Promise<Blob | null>((resolve) => {
    const image = new Image()
    image.onload = () => {
      // El doble de resolución para que el texto no salga borroso al ampliar.
      const canvas = document.createElement('canvas')
      canvas.width = pixelWidth * 2
      canvas.height = pixelHeight * 2
      const context = canvas.getContext('2d')
      if (!context) return resolve(null)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.scale(2, 2)
      context.drawImage(image, 0, 0)
      canvas.toBlob(resolve, 'image/png')
    }
    image.onerror = () => resolve(null)
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })

  if (!blob) return false
  saveBlob(blob, fileName)
  return true
}

/** El logo viaja como `data:` para que también se dibuje dentro del SVG. */
export async function loadLogoDataUrl(client: Client, path: string | null | undefined) {
  if (!path) return null
  const { data, error } = await client.storage.from('logos').download(path)
  if (error || !data) return null
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(data)
  })
}
