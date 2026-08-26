import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseCsv, type ProductInput, REQUIRED_HEADERS, type RowError, validateRow } from '../_shared/csv.ts'

const MAX_CSV_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 5000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ message: 'Usa POST para importar productos.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ message: 'Debes iniciar sesión para importar productos.' }, 401)

  let payload: { business_id?: unknown; csv?: unknown }
  try {
    payload = await request.json()
  } catch {
    return json({ message: 'El cuerpo debe ser JSON con business_id y csv.' }, 400)
  }

  const businessId = typeof payload.business_id === 'string' ? payload.business_id : ''
  const csv = typeof payload.csv === 'string' ? payload.csv : ''

  if (!UUID.test(businessId)) return json({ message: 'El negocio indicado no es válido.' }, 400)
  if (!csv.trim()) return json({ message: 'El archivo CSV está vacío.' }, 400)
  if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES) {
    return json({ message: 'El archivo supera los 2 MiB. Divídelo en partes.' }, 413)
  }

  // Se usa la sesión de quien llama, no la service_role: la RLS del negocio
  // sigue aplicando y la función no puede escribir donde el usuario no podría.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )

  const { headers, rows } = parseCsv(csv)
  const missingHeaders = REQUIRED_HEADERS.filter(header => !headers.includes(header))
  if (missingHeaders.length) {
    return json({ message: `Al archivo le faltan las columnas obligatorias: ${missingHeaders.join(', ')}.` }, 422)
  }
  if (!rows.length) return json({ message: 'El archivo no tiene filas de productos.' }, 422)
  if (rows.length > MAX_ROWS) {
    return json({ message: `El archivo tiene ${rows.length} filas y el máximo es ${MAX_ROWS}.` }, 413)
  }

  const errors: RowError[] = []
  const products: ProductInput[] = []
  const seen = new Map<string, number>()

  for (const row of rows) {
    const result = validateRow(row)
    if ('error' in result) { errors.push(result.error); continue }

    const key = result.product.sku.toLowerCase()
    const previous = seen.get(key)
    if (previous !== undefined) {
      errors.push({ row: row.line, sku: result.product.sku, message: `El SKU se repite; ya venía en la fila ${previous}.` })
      continue
    }

    seen.set(key, row.line)
    products.push(result.product)
  }

  if (!products.length) return json({ created: 0, updated: 0, stock_ignored: 0, errors })

  // La escritura vive en Postgres: una sola transacción que resuelve categorías
  // y proveedores por nombre y nunca toca el stock de un producto existente.
  const { data, error } = await supabase.rpc('import_products', {
    p_business: businessId,
    p_rows: products,
  })

  if (error) {
    const status = error.code === '42501' ? 403 : 400
    return json({ message: error.message ?? 'No pudimos importar los productos.', errors }, status)
  }

  const summary = (data ?? {}) as { created?: number; updated?: number; stock_ignored?: number }
  return json({
    created: summary.created ?? 0,
    updated: summary.updated ?? 0,
    stock_ignored: summary.stock_ignored ?? 0,
    errors,
  })
})
