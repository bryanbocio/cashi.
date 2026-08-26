/**
 * Parseo y validación de CSV de productos.
 *
 * Sin dependencias externas ni APIs de Deno a propósito: es lógica pura y así
 * se puede probar sin levantar el runtime.
 */

export type CsvRow = { line: number; values: Record<string, string> }

/** Excel en español exporta con punto y coma; se detecta en vez de asumir coma. */
function detectDelimiter(headerLine: string) {
  const best = [',', ';', '\t']
    .map(sep => ({ sep, count: headerLine.split(sep).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]
  return best.count > 0 ? best.sep : ','
}

/** Quita acentos y separadores para que «Stock mínimo» y «stock_minimo» sean lo mismo. */
export function normalizeHeader(header: string) {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const HEADER_ALIASES: Record<string, string> = {
  sku: 'sku', codigo: 'sku', code: 'sku', referencia: 'sku',
  nombre: 'name', name: 'name', producto: 'name', descripcion: 'name',
  categoria: 'category', category: 'category',
  proveedor: 'supplier', supplier: 'supplier',
  costo: 'cost', cost: 'cost', coste: 'cost',
  precio: 'price', price: 'price', precioventa: 'price',
  stock: 'stock', existencias: 'stock', cantidad: 'stock',
  stockminimo: 'min_stock', minimo: 'min_stock', minstock: 'min_stock', minimostock: 'min_stock',
}

/**
 * Lector de CSV con comillas dobles al estilo RFC 4180: `"a,b"` es un campo y
 * `""` dentro de comillas es una comilla literal.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^﻿/, '')
  const firstBreak = clean.search(/\r?\n/)
  const delimiter = detectDelimiter(firstBreak === -1 ? clean : clean.slice(0, firstBreak))

  const records: string[][] = []
  const lineOfRecord: number[] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let line = 1
  let recordStartLine = 1
  let hasContent = false

  const pushField = () => { record.push(field); field = '' }
  const pushRecord = () => {
    pushField()
    if (hasContent) { records.push(record); lineOfRecord.push(recordStartLine) }
    record = []
    hasContent = false
    recordStartLine = line
  }

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1 }
        else inQuotes = false
      } else {
        if (char === '\n') line += 1
        field += char
      }
      continue
    }

    if (char === '"') { inQuotes = true; hasContent = true; continue }
    if (char === delimiter) { pushField(); continue }
    if (char === '\r') continue
    if (char === '\n') { line += 1; pushRecord(); continue }

    if (char.trim() !== '') hasContent = true
    field += char
  }
  pushRecord()

  const headerRecord = records.shift()
  const headerLine = lineOfRecord.shift()
  if (!headerRecord || headerLine === undefined) return { headers: [], rows: [] }

  const headers = headerRecord.map(header => {
    const normalized = normalizeHeader(header)
    return HEADER_ALIASES[normalized] ?? normalized
  })

  const rows = records.map((values, index) => {
    const entry: Record<string, string> = {}
    headers.forEach((header, position) => { entry[header] = (values[position] ?? '').trim() })
    return { line: lineOfRecord[index], values: entry }
  })

  return { headers, rows }
}

export type ProductInput = {
  sku: string
  name: string
  category: string | null
  supplier: string | null
  cost: number
  price: number
  stock: number
  min_stock: number
}

export type RowError = { row: number; sku: string; message: string }

/**
 * Los montos son enteros en la moneda del negocio. Se aceptan los separadores
 * de miles habituales (`12.000`, `12,000`) porque es lo que exporta Excel, pero
 * cualquier decimal se rechaza en vez de redondearlo a la ligera.
 */
export function parseAmount(raw: string): number | null {
  const value = raw.replace(/\s/g, '').replace(/^[$€]/, '')
  if (value === '') return 0
  if (/^\d+$/.test(value)) return Number(value)
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) return Number(value.replace(/\./g, ''))
  if (/^\d{1,3}(,\d{3})+$/.test(value)) return Number(value.replace(/,/g, ''))
  return null
}

export const REQUIRED_HEADERS = ['sku', 'name']

const AMOUNT_FIELDS: Array<[keyof ProductInput, string]> = [
  ['cost', 'costo'],
  ['price', 'precio'],
  ['stock', 'stock'],
  ['min_stock', 'stock mínimo'],
]

export function validateRow(row: CsvRow): { product: ProductInput } | { error: RowError } {
  const { values, line } = row
  const sku = (values.sku ?? '').trim()
  const name = (values.name ?? '').trim()
  const fail = (message: string) => ({ error: { row: line, sku, message } })

  if (!sku) return fail('El SKU es obligatorio.')
  if (sku.length > 40) return fail('El SKU debe tener 40 caracteres o menos.')
  if (!name) return fail('El nombre es obligatorio.')
  if (name.length > 120) return fail('El nombre debe tener 120 caracteres o menos.')

  const amounts: Record<string, number> = {}
  for (const [field, label] of AMOUNT_FIELDS) {
    const parsed = parseAmount(values[field] ?? '')
    if (parsed === null) return fail(`El ${label} debe ser un número entero sin decimales.`)
    amounts[field] = parsed
  }

  return {
    product: {
      sku,
      name,
      category: (values.category ?? '').trim() || null,
      supplier: (values.supplier ?? '').trim() || null,
      cost: amounts.cost,
      price: amounts.price,
      stock: amounts.stock,
      min_stock: amounts.min_stock,
    },
  }
}
