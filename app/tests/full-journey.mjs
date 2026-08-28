import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

/**
 * Recorrido completo sobre un negocio recién creado (X9.2).
 *
 * A diferencia del resto de pruebas, esta no toca el negocio demo: nace de un
 * registro nuevo y encadena registro → negocio → producto → venta → cotización
 * a fiado → abono total → compra recibida → mes anterior. Si el seed cambia,
 * esta prueba sigue valiendo.
 */

const port = 3570
const baseUrl = `http://localhost:${port}`
const mailpitUrl = 'http://127.0.0.1:54324'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para el recorrido completo.')

const timestamp = Date.now()
const email = `x9.2-${timestamp}@cashi.local`
const password = `Cashi-${timestamp}!`
const businessName = `Recorrido X9.2 ${timestamp}`
const sku = `REC-${timestamp}`
const customerName = `Cliente ${timestamp}`

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, HOST: 'localhost', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput += chunk.toString() })
server.stderr.on('data', chunk => { serverOutput += chunk.toString() })

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`El servidor no respondió a tiempo.\n${serverOutput}`)
}

async function listMessages() {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`)
  if (!response.ok) throw new Error(`Mailpit respondió ${response.status}.`)
  return (await response.json()).messages ?? []
}

async function waitForMessage(recipient, excludedIds) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const messages = await listMessages()
    const message = messages.find(item => (
      !excludedIds.has(item.ID) && item.To?.some(address => address.Address === recipient)
    ))
    if (message) return message
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`No llegó un correo para ${recipient}.`)
}

async function getActionLink(messageId) {
  const response = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`)
  if (!response.ok) throw new Error(`No se pudo leer el correo ${messageId}.`)
  const message = await response.json()
  const content = `${message.HTML ?? ''}\n${message.Text ?? ''}`.replaceAll('&amp;', '&')
  const link = (content.match(/https?:\/\/[^\s"'<>]+/g) ?? []).find(item => item.includes('/auth/v1/verify'))
  if (!link) throw new Error(`El correo ${messageId} no trae enlace de autenticación.`)
  return link
}

/** Compara solo los dígitos: el formato de moneda usa espacio duro. */
async function waitForMoney(locator, amount, description) {
  const expected = String(amount)
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText({ timeout: 1000 }).catch(() => null)
    if (text !== null && text.replace(/\D/g, '') === expected) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba ${amount} y encontró «${actual}».`)
}

async function waitForText(locator, expected, description) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText({ timeout: 1000 }).catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontró «${actual}».`)
}

let browser
let page
let businessId = null
const browserErrors = []

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  // --- 1. Registro, confirmación y negocio nuevo ---
  const existingIds = new Set((await listMessages()).map(message => message.ID))
  await page.goto(`${baseUrl}/registro`, { waitUntil: 'networkidle' })
  await page.locator('#register-name').fill('Recorrido X9.2')
  await page.locator('#register-email').fill(email)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirmation').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByRole('heading', { name: 'Revisa tu correo' }).waitFor()

  const confirmation = await waitForMessage(email, existingIds)
  await page.goto(await getActionLink(confirmation.ID), { waitUntil: 'networkidle' })
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')

  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/onboarding')

  await page.locator('#business-name').fill(businessName)
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await page.waitForURL(url => url.pathname === '/')

  businessId = await page.evaluate(() => localStorage.getItem('cashi.active-business-id'))
  if (!businessId) throw new Error('El negocio nuevo no quedó activo.')

  // --- 2. Producto por debajo del mínimo desde el primer día ---
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '0 productos', 'Inventario del negocio nuevo')
  await page.locator('[data-testid="open-create"]').click()
  await page.locator('#product-sku').fill(sku)
  await page.locator('#product-name').fill('Producto del recorrido')
  await page.locator('#product-cost').fill('6000')
  await page.locator('#product-price').fill('10000')
  await page.locator('#product-stock').fill('10')
  await page.locator('#product-min-stock').fill('12')
  await page.locator('[data-testid="product-create-submit"]').click()
  await waitForText(page.locator('[data-testid="inventory-count"]'), '1 producto', 'Inventario tras crear el producto')

  // --- 3. Venta de contado ---
  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="caja-search"]').fill(sku)
  await page.locator(`[data-testid="result-${sku}"]`).click()
  await page.locator(`[data-testid="cart-plus-${sku}"]`).click()
  await waitForText(page.locator('[data-testid="cart-total"]'), '20.000', 'Total de la venta de contado')
  await page.locator('[data-testid="caja-charge"]').click()
  await page.getByText('Venta FAC-00001 registrada').waitFor()

  // --- 4. Cliente creado desde la propia Caja, sin perder el carrito ---
  await page.locator('[data-testid="caja-search"]').fill(sku)
  await page.locator(`[data-testid="result-${sku}"]`).click()
  await waitForText(page.locator('[data-testid="cart-count"]'), '1 producto', 'Carrito antes de crear el cliente')

  await page.locator('[data-testid="caja-new-customer"]').click()
  await page.locator('#customer-name').fill(customerName)
  await page.locator('#customer-phone').fill('3005550000')
  await page.locator('[data-testid="customer-create-submit"]').click()
  await page.getByText('Cliente creado').waitFor()

  // El carrito sigue intacto y el cliente nuevo queda seleccionado.
  await waitForText(page.locator('[data-testid="cart-count"]'), '1 producto', 'Carrito después de crear el cliente')
  await waitForText(page.locator('#caja-customer'), customerName, 'Cliente seleccionado tras crearlo')
  await page.locator('[data-testid="caja-save-quote"]').click()
  await page.locator('[data-testid="quote-save-submit"]').click()
  await page.waitForURL(url => url.pathname === '/cotizaciones')

  const quoteId = psql(`select id from public.quote where business_id = '${businessId}' and code = 'COT-0001';`)
  await page.locator(`[data-testid="quote-credit-${quoteId}"]`).click()
  await page.getByText('Cotización pasada a fiado').waitFor()

  // --- 5. Fiados: la deuda aparece y se salda entera ---
  await page.goto(`${baseUrl}/fiados`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="credit-count"]'), '1 cliente con deuda', 'Deudores tras el fiado')
  await waitForText(page.locator('[data-testid="credit-total-debt"]'), '10.000', 'Deuda del recorrido')

  const customerId = psql(`select id from public.customer where business_id = '${businessId}';`)
  await page.locator(`[data-testid="credit-pay-${customerId}"]`).click()
  await page.locator('[data-testid="credit-pay-all"]').click()
  await page.locator('[data-testid="credit-payment-submit"]').click()
  await waitForText(page.locator('[data-testid="credit-count"]'), '0 clientes con deuda', 'Deudores tras abonar todo')

  // --- 6. Compras: sugerencia, orden y recepción ---
  await page.goto(`${baseUrl}/compras`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="purchase-suggestion-title"]'), '1 productos', 'Sugerencia del recorrido')
  await page.locator('[data-testid="purchase-create-suggested"]').click()
  await waitForText(page.locator('[data-testid="purchase-pending-count"]'), '1 orden pendiente', 'Orden creada')

  const orderId = psql(`select id from public.purchase_order where business_id = '${businessId}';`)
  await page.locator(`[data-testid="purchase-receive-${orderId}"]`).click()
  await waitForText(page.locator('[data-testid="purchase-pending-count"]'), '0 órdenes pendientes', 'Orden recibida')
  await waitForText(page.locator('[data-testid="purchase-suggestion-title"]'), 'Todo por encima del mínimo', 'Sugerencia tras recibir')

  // --- 7. El mes en curso cuadra y el anterior está vacío ---
  await page.goto(`${baseUrl}/reportes`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="report-revenue"]'), '30.000', 'Ingresos del mes del recorrido')
  await waitForText(page.locator('[data-testid="report-history-count"]'), '2 ventas', 'Historial del mes')

  await page.locator('[data-testid="month-prev"]').click()
  await waitForText(page.locator('[data-testid="report-history-empty"]'), 'No hay ventas confirmadas', 'Historial del mes anterior')
  await waitForMoney(page.locator('[data-testid="report-revenue"]'), 0, 'Ingresos del mes anterior')

  // --- Comprobación final en PostgreSQL ---
  const stored = psql(`select
      (select count(*) from public.sale where business_id = '${businessId}' and status = 'CONFIRMED'),
      (select stock from public.product where business_id = '${businessId}'),
      (select coalesce(sum(amount), 0) from public.payment where business_id = '${businessId}'),
      (select status from public.purchase_order where business_id = '${businessId}');`)
  // 2 ventas · 10 − 2 − 1 + 17 repuestas = 24 · 10.000 abonados · orden recibida
  if (stored !== '2|24|10000|RECEIVED') {
    throw new Error(`El recorrido no dejó el estado esperado en PostgreSQL: ${stored}`)
  }

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log(`PASS: el recorrido completo creó ${businessName}, vendió, cotizó a fiado, abonó, recibió la compra y cuadró el mes.`)
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 2500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  // El recorrido se lleva su negocio y su usuario: no ensucia el entorno local.
  // Los movimientos y las líneas de compra apuntan al producto con
  // `on delete restrict`, así que salen antes de que el negocio arrastre todo.
  if (businessId) {
    psql(`
      delete from public.stock_movement where business_id = '${businessId}';
      delete from public.purchase_line where purchase_order_id in (
        select id from public.purchase_order where business_id = '${businessId}');
      delete from public.purchase_order where business_id = '${businessId}';
      delete from public.payment where business_id = '${businessId}';
      delete from public.sale where business_id = '${businessId}';
      delete from public.business where id = '${businessId}';
    `)
  }
  psql(`delete from auth.users where email = '${email}';`)
}
