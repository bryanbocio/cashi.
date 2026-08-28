import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3480
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const productA = '50000000-0000-0000-0000-000000000004'
const productB = '50000000-0000-0000-0000-000000000008'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Compras.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function cleanupFixture() {
  psql(`
    delete from public.stock_movement where ref_id in (
      select id from public.purchase_order
      where business_id = '${demoBusinessId}' and code = 'OC-0001'
    );
    delete from public.purchase_order
      where business_id = '${demoBusinessId}' and code = 'OC-0001';
    update public.product set stock = 3, cost = 9500 where id = '${productA}';
    update public.product set stock = 2, cost = 7000 where id = '${productB}';
    update public.doc_sequence set next_value = 1
      where business_id = '${demoBusinessId}' and doc_type = 'PURCHASE';
  `)
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
    const value = await locator.innerText().catch(() => null)
    if (value && value.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontró «${actual}».`)
}

let browser
let page
const browserErrors = []

try {
  cleanupFixture()
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

  await page.goto(`${baseUrl}/compras`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="purchase-suggestion-title"]'), '2 productos', 'Sugerencia inicial')
  await waitForText(page.locator('[data-testid="purchase-suggestion-detail"]'), '13 unidades', 'Unidades sugeridas')
  await waitForText(page.locator('[data-testid="purchase-suggestion-detail"]'), '108,500.00', 'Costo sugerido')
  await waitForText(page.locator('[data-testid="purchase-order-count"]'), '0 órdenes', 'Lista inicialmente vacía')

  await page.locator('[data-testid="purchase-create-suggested"]').click()
  await page.getByText('OC-0001 quedó pendiente de recepción.').waitFor()
  await waitForText(page.locator('[data-testid="purchase-order-count"]'), '1 orden', 'Conteo después de crear')
  await waitForText(page.locator('[data-testid="purchase-pending-count"]'), '1 orden pendiente', 'Pendientes después de crear')
  await waitForText(page.locator('body'), 'Varios proveedores', 'Proveedor de la orden mixta')
  await waitForText(page.locator('body'), '108,500.00', 'Costo de la orden creada')

  const created = psql(`
    select po.id, po.code, po.status, po.supplier_id is null,
      v.line_count, v.total_units, v.total_cost,
      (select stock from public.product where id = '${productA}'),
      (select stock from public.product where id = '${productB}'),
      (select count(*) from public.stock_movement m where m.ref_id = po.id)
    from public.purchase_order po
    join public.v_purchase_orders v on v.id = po.id
    where po.business_id = '${demoBusinessId}' and po.code = 'OC-0001';
  `)
  const [orderId, ...createdValues] = created.split('|')
  if (!orderId || createdValues.join('|') !== 'OC-0001|PENDING|t|2|13|108500|3|2|0') {
    throw new Error(`La orden sugerida no quedó como se esperaba: ${created}`)
  }

  await page.locator(`[data-testid="purchase-receive-${orderId}"]`).click()
  await page.getByText('OC-0001 actualizó existencias y costos.').waitFor()
  await waitForText(page.locator('[data-testid="purchase-pending-count"]'), '0 órdenes pendientes', 'Pendientes después de recibir')
  await waitForText(page.locator('[data-testid="purchase-suggestion-title"]'), 'Todo por encima del mínimo', 'Sugerencia después de recibir')
  await waitForText(page.locator('body'), 'RECIBIDA', 'Estado recibido visible')
  if (await page.locator(`[data-testid="purchase-receive-${orderId}"]`).count()) {
    throw new Error('La acción Recibir continúa visible en una orden recibida.')
  }

  const received = psql(`
    select po.status, po.received_at is not null,
      (select stock from public.product where id = '${productA}'),
      (select cost from public.product where id = '${productA}'),
      (select stock from public.product where id = '${productB}'),
      (select cost from public.product where id = '${productB}'),
      (select count(*) from public.stock_movement m where m.ref_id = po.id and m.type = 'PURCHASE'),
      (select sum(qty_delta) from public.stock_movement m where m.ref_id = po.id and m.type = 'PURCHASE')
    from public.purchase_order po
    where po.id = '${orderId}';
  `)
  if (received !== 'RECEIVED|t|10|9500|8|7000|2|13') {
    throw new Error(`La recepción no actualizó inventario y auditoría como se esperaba: ${received}`)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const card = page.locator(`[data-testid="purchase-card-${orderId}"]`)
  await card.waitFor({ state: 'visible' })
  await waitForText(card, 'OC-0001', 'Código en tarjeta móvil')
  await waitForText(card, 'Varios proveedores', 'Proveedor en tarjeta móvil')
  await waitForText(card, 'RECIBIDA', 'Estado en tarjeta móvil')
  await waitForText(card, '108,500.00', 'Costo en tarjeta móvil')

  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('button, input, [role="combobox"]')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.id || `${el.tagName}.${el.className}`,
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles por debajo de 44 px en móvil: ${smallTargets.join(', ')}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: Compras creó la sugerencia, recibió una sola vez, actualizó inventario y mostró tabla/tarjeta móvil accesible.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanupFixture()
}
