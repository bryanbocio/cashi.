import { execFileSync } from 'node:child_process'
import { buildDocumentModel, formatCalendarDate, formatDocumentMoney, paginateLines } from '../functions/_shared/document.ts'

const apiUrl = process.env.SUPABASE_API_URL ?? 'http://127.0.0.1:54321'
const endpoint = `${apiUrl}/functions/v1/document-pdf`
const anonKey = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const demoUserId = '10000000-0000-0000-0000-000000000001'

/** El plan fija el techo del documento en 300 kB. */
const MAX_PDF_BYTES = 300 * 1024

/** PNG mínimo válido para probar la lectura del logo privado. */
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

let failures = 0
function check(condition, description, detail = '') {
  if (condition) {
    console.log(`  ok   ${description}`)
  } else {
    failures += 1
    console.log(`  FALLA ${description}${detail ? `\n        ${detail}` : ''}`)
  }
}

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function psqlValue(query) {
  return psql(query).split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1) ?? ''
}

function cleanup() {
  psql(`
    delete from public.stock_movement where ref_table = 'sale' and ref_id in (
      select id from public.sale where business_id = '${demoBusinessId}' and code like 'FAC-0000%');
    delete from public.sale where business_id = '${demoBusinessId}' and code like 'FAC-0000%';
    delete from public.quote where business_id = '${demoBusinessId}' and code like 'COT-000%';
    update public.doc_sequence set next_value = 1
      where business_id = '${demoBusinessId}' and doc_type in ('SALE', 'QUOTE');
    update public.product p set stock = seed.stock
    from (values
      ('PER-001', 12), ('PER-002', 6), ('CUI-001', 18), ('CUI-002', 3), ('CUI-003', 20),
      ('ACC-001', 4), ('ACC-002', 10), ('ACC-003', 2), ('ACC-004', 30)
    ) as seed(sku, stock)
    where p.business_id = '${demoBusinessId}' and p.sku = seed.sku;
    update public.business set logo_path = null where id = '${demoBusinessId}';
  `)
}

/** Storage no permite borrar desde SQL: el objeto sale por su propia API. */
async function removeLogo(token) {
  if (!token) return
  await fetch(`${apiUrl}/storage/v1/object/logos/${demoBusinessId}/logo.png`, {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

async function login(email, password) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  if (!body.access_token) throw new Error(`No se pudo iniciar sesión como ${email}: ${JSON.stringify(body)}`)
  return body.access_token
}

async function request(token, body, method = 'POST') {
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('pdf')) {
    return {
      status: response.status,
      pdf: new Uint8Array(await response.arrayBuffer()),
      filename: /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? '',
    }
  }
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

function isPdf(bytes) {
  return bytes && bytes.length > 4 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
}

console.log('Modelo del documento')

const business = {
  name: 'Cashi Demo',
  nit: '900123456-7',
  phone: '6015550101',
  address: 'Calle 10 # 20-30',
  currency: 'COP',
  timezone: 'America/Bogota',
}

const baseSale = {
  type: 'SALE',
  code: 'FAC-00007',
  customerName: null,
  issuedAt: '2026-08-27T15:00:00Z',
  paymentMethod: 'CASH',
  limitDate: null,
  status: 'CONFIRMED',
  discount: 4000,
  total: 25000,
  lines: [{ name: 'Cosmetiquera', qty: 1, unitPrice: 29000 }],
}

const baseQuote = {
  type: 'QUOTE',
  code: 'COT-0003',
  customerName: null,
  issuedAt: '2026-08-27T15:00:00Z',
  paymentMethod: null,
  limitDate: '2026-09-11',
  status: 'OPEN',
  discount: 0,
  total: 79000,
  lines: [{ name: 'Perfume Aurora 50 ml', qty: 1, unitPrice: 79000 }],
}

const saleModel = buildDocumentModel(business, baseSale)

check(saleModel.title === 'Factura de venta', 'la venta se titula factura')
check(saleModel.fileName === 'factura-fac-00007.pdf', 'el nombre del archivo usa el código en minúsculas', saleModel.fileName)
check(saleModel.meta[0].value === 'Mostrador', 'una venta sin cliente se imprime como Mostrador')
check(saleModel.lines[0].lineTotal === 29000, 'el importe de la línea es cantidad × precio')
check(saleModel.totals.length === 3, 'con descuento se imprimen subtotal, descuento y total')
check(saleModel.totals[1].value === formatDocumentMoney(-4000, 'COP'), 'el descuento se imprime en negativo', saleModel.totals[1].value)
check(saleModel.totals[2].value === formatDocumentMoney(25000, 'COP'), 'el total impreso es el del documento')
check(saleModel.stamp === '', 'una venta confirmada no lleva sello')
check(saleModel.note.includes('Gracias'), 'la venta de contado agradece la compra', saleModel.note)

const noDiscount = buildDocumentModel(business, {
  ...baseSale, code: 'FAC-00009', customerName: 'Ana', discount: 0, total: 29000,
})
check(noDiscount.totals.length === 2, 'sin descuento no se imprime la línea de descuento')

const creditModel = buildDocumentModel(business, {
  type: 'SALE',
  code: 'FAC-00008',
  customerName: 'Ana Pérez',
  issuedAt: '2026-08-27T15:00:00Z',
  paymentMethod: 'CREDIT',
  limitDate: '2026-09-10',
  status: 'CONFIRMED',
  discount: 0,
  total: 79000,
  lines: [{ name: 'Perfume Aurora 50 ml', qty: 1, unitPrice: 79000 }],
})
check(creditModel.meta.some(item => item.label === 'Vence'), 'el fiado imprime su fecha de vencimiento')
check(creditModel.note.includes(formatCalendarDate('2026-09-10')), 'la nota del fiado repite el vencimiento', creditModel.note)

const voidModel = buildDocumentModel(business, {
  ...baseSale, code: 'FAC-00010', status: 'VOID', discount: 0, total: 29000,
})
check(voidModel.stamp === 'ANULADA', 'la venta anulada lleva sello')
check(voidModel.note.includes('anulada'), 'la nota avisa que la venta no vale', voidModel.note)

const quoteModel = buildDocumentModel(business, baseQuote)
check(quoteModel.title === 'Cotización', 'la cotización se titula cotización')
check(quoteModel.fileName === 'cotizacion-cot-0003.pdf', 'el archivo de la cotización se distingue', quoteModel.fileName)
check(quoteModel.meta.some(item => item.label === 'Válida hasta'), 'la cotización imprime su vigencia')
check(quoteModel.stamp === '', 'una cotización vigente no lleva sello')

const discountedQuote = buildDocumentModel(business, {
  ...baseQuote, code: 'COT-0006', discount: 9000, total: 70000,
})
check(discountedQuote.totals.length === 3, 'la cotización con descuento imprime subtotal, descuento y total')
check(discountedQuote.totals[1].value === formatDocumentMoney(-9000, 'COP'), 'el descuento cotizado se imprime en negativo')
check(discountedQuote.totals[2].value === formatDocumentMoney(70000, 'COP'), 'la cotización imprime el total descontado')

const expired = buildDocumentModel(business, { ...baseQuote, code: 'COT-0004', limitDate: '2026-08-01', status: 'EXPIRED' })
check(expired.stamp === 'VENCIDA', 'la cotización vencida lleva sello')

const converted = buildDocumentModel(business, { ...baseQuote, code: 'COT-0005', status: 'CONVERTED' })
check(converted.stamp === 'CONVERTIDA', 'la cotización convertida lleva sello')

check(formatDocumentMoney(158000, 'COP').includes('158,000.00'), 'el dinero usa coma para los miles y punto para los decimales', formatDocumentMoney(158000, 'COP'))
check(!/\u00a0/.test(formatDocumentMoney(158000, 'COP')), 'el importe no lleva espacios duros que la fuente no dibuje')

const pages = paginateLines(Array.from({ length: 50 }, (_, index) => index), 18, 30)
check(pages.length === 3, 'las líneas se reparten por página según el espacio', String(pages.length))
check(pages[0].length === 18 && pages[1].length === 30 && pages[2].length === 2, 'la primera página cabe menos que las siguientes')
check(paginateLines([], 18, 30).length === 1, 'un documento sin líneas sigue teniendo una página')

console.log('Contrato HTTP')

let token = null

try {
  cleanup()

  psql(`
    select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select public.create_sale('${demoBusinessId}', null, 'CASH', 0, null, jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = 'PER-001'), 'qty', 2)
    ));
    select public.create_sale('${demoBusinessId}', null, 'CASH', 0, null, jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = 'CUI-001'), 'qty', 1)
    ));
    select public.create_quote('${demoBusinessId}', null, jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = 'ACC-002'), 'qty', 3)
    ), (current_date + 15)::date);
  `)

  const saleId = psqlValue(`select id from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00001';`)
  const voidedId = psqlValue(`select id from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00002';`)
  const quoteId = psqlValue(`select id from public.quote where business_id = '${demoBusinessId}' and code = 'COT-0001';`)
  psql(`
    select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select public.void_sale('${voidedId}');
  `)

  token = await login('demo@cashi.local', 'CashiDemo2026!')
  const otherToken = await login('other@cashi.local', 'CashiOther2026!')

  const anonymous = await request(null, { type: 'SALE', id: saleId })
  check(anonymous.status === 401, 'sin sesión responde 401', String(anonymous.status))

  const wrongMethod = await request(token, null, 'GET')
  check(wrongMethod.status === 405, 'un GET responde 405', String(wrongMethod.status))

  const badType = await request(token, { type: 'RECIBO', id: saleId })
  check(badType.status === 400, 'un tipo desconocido responde 400', JSON.stringify(badType.body))

  const badId = await request(token, { type: 'SALE', id: 'no-es-uuid' })
  check(badId.status === 400, 'un id inválido responde 400', JSON.stringify(badId.body))

  const missing = await request(token, { type: 'SALE', id: '00000000-0000-4000-8000-000000000000' })
  check(missing.status === 404, 'una venta inexistente responde 404', JSON.stringify(missing.body))

  const foreign = await request(otherToken, { type: 'SALE', id: saleId })
  check(foreign.status === 404, 'un usuario ajeno no alcanza la venta de otro negocio', JSON.stringify(foreign.body))

  const invoice = await request(token, { type: 'SALE', id: saleId })
  check(invoice.status === 200 && isPdf(invoice.pdf), 'la venta propia devuelve un PDF', String(invoice.status))
  check(invoice.filename === 'factura-fac-00001.pdf', 'la factura viaja con su nombre de archivo', invoice.filename)
  check(invoice.pdf.length < MAX_PDF_BYTES, `el PDF pesa menos de 300 kB (${invoice.pdf?.length} bytes)`)

  const voided = await request(token, { type: 'SALE', id: voidedId })
  check(voided.status === 200 && isPdf(voided.pdf), 'una venta anulada también genera su comprobante', String(voided.status))

  const quote = await request(token, { type: 'QUOTE', id: quoteId })
  check(quote.status === 200 && isPdf(quote.pdf), 'la cotización propia devuelve un PDF', String(quote.status))
  check(quote.filename === 'cotizacion-cot-0001.pdf', 'la cotización viaja con su nombre de archivo', quote.filename)
  check(quote.pdf.length < MAX_PDF_BYTES, `la cotización pesa menos de 300 kB (${quote.pdf?.length} bytes)`)

  const foreignQuote = await request(otherToken, { type: 'QUOTE', id: quoteId })
  check(foreignQuote.status === 404, 'un usuario ajeno no alcanza la cotización de otro negocio', String(foreignQuote.status))

  const lowercase = await request(token, { type: 'sale', id: saleId })
  check(lowercase.status === 200 && isPdf(lowercase.pdf), 'el tipo se acepta en minúsculas', String(lowercase.status))

  // El logo vive en un bucket privado: la función debe poder leerlo con la
  // sesión de quien pide el documento, y seguir componiendo si no está.
  const upload = await fetch(`${apiUrl}/storage/v1/object/logos/${demoBusinessId}/logo.png`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
    body: PIXEL_PNG,
  })
  check(upload.ok, 'el logo de prueba se sube al bucket privado', String(upload.status))
  psql(`update public.business set logo_path = '${demoBusinessId}/logo.png' where id = '${demoBusinessId}';`)

  const withLogo = await request(token, { type: 'SALE', id: saleId })
  check(withLogo.status === 200 && isPdf(withLogo.pdf), 'la factura se compone con el logo del negocio', String(withLogo.status))
  check(withLogo.pdf.length > invoice.pdf.length, 'el PDF con logo pesa más que el mismo sin logo')
  check(withLogo.pdf.length < MAX_PDF_BYTES, `el PDF con logo sigue bajo 300 kB (${withLogo.pdf?.length} bytes)`)

  // Una ruta que ya no existe no puede tumbar el documento.
  psql(`update public.business set logo_path = '${demoBusinessId}/borrado.png' where id = '${demoBusinessId}';`)
  const brokenLogo = await request(token, { type: 'SALE', id: saleId })
  check(brokenLogo.status === 200 && isPdf(brokenLogo.pdf), 'un logo que ya no está no impide generar el documento', String(brokenLogo.status))

  if (failures) throw new Error(`${failures} comprobaciones fallaron.`)
  console.log('PASS: document-pdf compuso factura y cotización, respetó el aislamiento y se mantuvo bajo 300 kB.')
} finally {
  cleanup()
  await removeLogo(token)
}
