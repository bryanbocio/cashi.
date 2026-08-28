import { createClient } from 'npm:@supabase/supabase-js@2'
import type { DocumentBusiness, DocumentSource, DocumentType } from '../_shared/document.ts'
import { buildDocumentModel, formatDocumentMoney } from '../_shared/document.ts'
import { DOCUMENT_FONTS } from '../_shared/fonts/index.ts'
import { renderDocument } from '../_shared/pdf.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPES: DocumentType[] = ['SALE', 'QUOTE']

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ message: 'Usa POST para generar un documento.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ message: 'Debes iniciar sesión para generar el documento.' }, 401)

  let payload: { type?: unknown; id?: unknown }
  try {
    payload = await request.json()
  } catch {
    return json({ message: 'El cuerpo debe ser JSON con type e id.' }, 400)
  }

  const type = typeof payload.type === 'string' ? payload.type.toUpperCase() as DocumentType : null
  const id = typeof payload.id === 'string' ? payload.id : ''

  if (!type || !TYPES.includes(type)) return json({ message: 'El tipo debe ser SALE o QUOTE.' }, 400)
  if (!UUID.test(id)) return json({ message: 'El documento indicado no es válido.' }, 400)

  // Se usa la sesión de quien llama, nunca la service_role: la RLS decide si
  // este usuario puede ver este documento, igual que en import-products.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ message: 'La sesión no es válida o expiró.' }, 401)

  const source = type === 'SALE'
    ? await loadSale(supabase, id)
    : await loadQuote(supabase, id)

  if ('error' in source) return json({ message: source.error }, source.status)

  const { data: business, error: businessError } = await supabase
    .from('business')
    .select('id, name, nit, phone, address, currency, timezone, logo_path')
    .eq('id', source.businessId)
    .maybeSingle()

  if (businessError || !business) return json({ message: 'No se pudo leer el negocio del documento.' }, 404)

  const documentBusiness: DocumentBusiness = {
    name: business.name,
    nit: business.nit,
    phone: business.phone,
    address: business.address,
    currency: business.currency,
    timezone: business.timezone,
  }

  // El logo vive en un bucket privado; se descarga con la misma sesión.
  let logo: Uint8Array | null = null
  if (business.logo_path) {
    const { data: file } = await supabase.storage.from('logos').download(business.logo_path)
    if (file) logo = new Uint8Array(await file.arrayBuffer())
  }

  const model = buildDocumentModel(documentBusiness, source.document)
  const bytes = await renderDocument(model, DOCUMENT_FONTS, logo, line => ({
    unitPrice: formatDocumentMoney(line.unitPrice, documentBusiness.currency),
    lineTotal: formatDocumentMoney(line.lineTotal, documentBusiness.currency),
  }))

  return new Response(bytes, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${model.fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
})

type Loaded = { businessId: string; document: DocumentSource } | { error: string; status: number }

// deno-lint-ignore no-explicit-any
async function loadSale(supabase: any, id: string): Promise<Loaded> {
  const { data: sale } = await supabase
    .from('v_sale_detail')
    .select('id, business_id, code, customer_name, payment_method, status, discount, total, due_date, sold_at')
    .eq('id', id)
    .maybeSingle()

  if (!sale) return { error: 'La venta no existe o no pertenece a tu negocio.', status: 404 }

  const { data: lines } = await supabase
    .from('sale_line')
    .select('name_snapshot, qty, unit_price')
    .eq('sale_id', id)
    .order('name_snapshot')

  return {
    businessId: sale.business_id,
    document: {
      type: 'SALE',
      code: sale.code,
      customerName: sale.customer_name,
      issuedAt: sale.sold_at,
      paymentMethod: sale.payment_method,
      limitDate: sale.due_date,
      status: sale.status,
      discount: sale.discount ?? 0,
      total: sale.total ?? 0,
      // deno-lint-ignore no-explicit-any
      lines: (lines ?? []).map((line: any) => ({
        name: line.name_snapshot,
        qty: line.qty,
        unitPrice: line.unit_price,
      })),
    },
  }
}

// deno-lint-ignore no-explicit-any
async function loadQuote(supabase: any, id: string): Promise<Loaded> {
  const { data: quote } = await supabase
    .from('v_quote_detail')
    .select('id, business_id, code, customer_name, valid_until, status, total, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!quote) return { error: 'La cotización no existe o no pertenece a tu negocio.', status: 404 }

  const { data: lines } = await supabase
    .from('v_quote_line_detail')
    .select('name_snapshot, qty, unit_price')
    .eq('quote_id', id)
    .order('name_snapshot')

  return {
    businessId: quote.business_id,
    document: {
      type: 'QUOTE',
      // `v_quote_detail` ya devuelve «Sin cliente» cuando no hay uno asociado.
      code: quote.code,
      customerName: quote.customer_name === 'Sin cliente' ? null : quote.customer_name,
      issuedAt: quote.created_at,
      paymentMethod: null,
      limitDate: quote.valid_until,
      status: quote.status,
      // Las cotizaciones no llevan descuento: el total es el subtotal.
      discount: 0,
      total: quote.total ?? 0,
      // deno-lint-ignore no-explicit-any
      lines: (lines ?? []).map((line: any) => ({
        name: line.name_snapshot,
        qty: line.qty,
        unitPrice: line.unit_price,
      })),
    },
  }
}
