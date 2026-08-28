import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

/**
 * Aislamiento entre dos negocios **del mismo usuario** (X9.2).
 *
 * Aquí la RLS no protege nada: el usuario es miembro de los dos. Lo que se
 * comprueba es que cada consulta filtre por el negocio activo; un `business_id`
 * olvidado en cualquier vista mezcla datos de dos tiendas y esta prueba lo caza.
 */

const port = 3580
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const activeBusinessKey = 'cashi.active-business-id'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de aislamiento.')

const timestamp = Date.now()
const secondName = `Aislado X9.2 ${timestamp}`
const sku = `AIS-${timestamp}`
const productName = `Producto aislado ${timestamp}`
const expenseConcept = `Gasto aislado ${timestamp}`

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

async function waitForText(locator, expected, description) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText({ timeout: 1000 }).catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontró «${actual}».`)
}

/** Comprueba que un texto NO aparece en la página, tras dejarla asentarse. */
async function expectAbsent(page, text, description) {
  const found = await page.getByText(text, { exact: false }).count()
  if (found) throw new Error(`${description}: «${text}» se ve desde el otro negocio.`)
}

async function openSwitcher(page) {
  await page.getByRole('button', { name: /Cambiar negocio\. Activo:/ }).click()
  await page.locator('[data-testid="business-switcher-menu"]:visible').last().waitFor()
}

async function switchTo(page, name, businessId) {
  await openSwitcher(page)
  await page.getByRole('button', { name: `Cambiar a ${name}` }).click()
  await page.waitForFunction(({ key, expected }) => localStorage.getItem(key) === expected, {
    key: activeBusinessKey,
    expected: businessId,
  })
  await page.locator('[data-testid="business-switcher-menu"]:visible').waitFor({ state: 'hidden' })
}

let browser
let page
let secondBusinessId = null
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

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')

  // --- El segundo negocio del mismo usuario nace vacío ---
  await openSwitcher(page)
  await page.getByRole('link', { name: 'Crear otro negocio' }).click()
  await page.waitForURL(url => url.pathname === '/onboarding')
  await page.locator('#business-name').fill(secondName)
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await page.waitForURL(url => url.pathname === '/')

  secondBusinessId = await page.evaluate(key => localStorage.getItem(key), activeBusinessKey)
  if (!secondBusinessId || secondBusinessId === demoBusinessId) {
    throw new Error('El segundo negocio no quedó activo.')
  }

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '0 productos', 'Inventario del negocio nuevo')
  await expectAbsent(page, 'Perfume Aurora 50 ml', 'Inventario del negocio nuevo')

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="expense-count"]'), '0 gastos', 'Gastos del negocio nuevo')

  await page.goto(`${baseUrl}/fiados`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="credit-count"]'), '0 clientes con deuda', 'Fiados del negocio nuevo')
  await expectAbsent(page, 'Ana Pérez', 'Fiados del negocio nuevo')

  // --- Se registra actividad solo en el negocio nuevo ---
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="open-create"]').click()
  await page.locator('#product-sku').fill(sku)
  await page.locator('#product-name').fill(productName)
  await page.locator('#product-cost').fill('4000')
  await page.locator('#product-price').fill('9000')
  await page.locator('#product-stock').fill('6')
  await page.locator('#product-min-stock').fill('2')
  await page.locator('[data-testid="product-create-submit"]').click()
  await waitForText(page.locator('[data-testid="inventory-count"]'), '1 producto', 'Inventario con el producto nuevo')

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="caja-search"]').fill(sku)
  await page.locator(`[data-testid="result-${sku}"]`).click()
  await page.locator('[data-testid="caja-charge"]').click()
  await page.getByText('Venta FAC-00001 registrada').waitFor()

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="open-expense"]').click()
  await page.locator('#expense-category').click()
  await page.getByRole('option', { name: 'Otro', exact: true }).click()
  await page.locator('[data-testid="expense-concept-wrap"]').waitFor()
  await page.locator('#expense-concept').fill(expenseConcept)
  await page.locator('#expense-amount').fill('15000')
  await page.locator('[data-testid="expense-create-submit"]').click()
  await waitForText(page.locator('[data-testid="expense-count"]'), '1 gasto', 'Gasto del negocio nuevo')

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="caja-search"]').fill(sku)
  await page.locator(`[data-testid="result-${sku}"]`).click()
  await page.locator('[data-testid="caja-save-quote"]').click()
  await page.locator('[data-testid="quote-save-submit"]').click()
  await page.waitForURL(url => url.pathname === '/cotizaciones')
  await waitForText(page.locator('[data-testid="quote-list-count"]'), '1 cotización pendiente', 'Cotización del negocio nuevo')

  // --- Desde el negocio demo nada de lo anterior existe ---
  await switchTo(page, 'Cashi Demo', demoBusinessId)

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '9 productos', 'Inventario del demo')
  await expectAbsent(page, productName, 'Inventario del demo')

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="caja-search"]').fill(sku)
  await waitForText(page.locator('[data-testid="caja-results"]'), 'Ningún producto coincide', 'Buscador de Caja del demo')

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="expense-count"]'), '5 gastos', 'Gastos del demo')
  await expectAbsent(page, expenseConcept, 'Gastos del demo')

  await page.goto(`${baseUrl}/cotizaciones`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="quote-list-count"]'), '0 cotizaciones pendientes', 'Cotizaciones del demo')

  await page.goto(`${baseUrl}/reportes`, { waitUntil: 'networkidle' })
  await expectAbsent(page, productName, 'Reportes del demo')

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await expectAbsent(page, productName, 'Resumen del demo')

  // --- Y al revés: el negocio nuevo tampoco ve el demo ---
  await switchTo(page, secondName, secondBusinessId)

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '1 producto', 'Inventario del negocio nuevo al volver')
  await expectAbsent(page, 'Perfume Aurora 50 ml', 'Inventario del negocio nuevo al volver')

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="expense-count"]'), '1 gasto', 'Gastos del negocio nuevo al volver')
  await expectAbsent(page, 'Arriendo', 'Gastos del negocio nuevo al volver')

  await page.goto(`${baseUrl}/fiados`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="credit-count"]'), '0 clientes con deuda', 'Fiados del negocio nuevo al volver')

  // --- La base confirma el reparto ---
  const counts = psql(`select
      (select count(*) from public.product where business_id = '${secondBusinessId}'),
      (select count(*) from public.sale where business_id = '${secondBusinessId}'),
      (select count(*) from public.expense where business_id = '${secondBusinessId}'),
      (select count(*) from public.quote where business_id = '${secondBusinessId}'),
      (select count(*) from public.product where business_id = '${demoBusinessId}'),
      (select count(*) from public.expense where business_id = '${demoBusinessId}');`)
  if (counts !== '1|1|1|1|9|5') {
    throw new Error(`El reparto entre negocios no es el esperado: ${counts}`)
  }

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log(`PASS: ${secondName} y Cashi Demo no comparten inventario, ventas, gastos, cotizaciones ni fiados.`)
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 2500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  // Solo se borra el negocio creado aquí; el demo queda intacto.
  if (secondBusinessId) {
    psql(`
      delete from public.stock_movement where business_id = '${secondBusinessId}';
      delete from public.purchase_line where purchase_order_id in (
        select id from public.purchase_order where business_id = '${secondBusinessId}');
      delete from public.purchase_order where business_id = '${secondBusinessId}';
      delete from public.sale where business_id = '${secondBusinessId}';
      delete from public.business where id = '${secondBusinessId}';
    `)
  }
}
