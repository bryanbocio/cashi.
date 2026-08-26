import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3450
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Caja.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

// Las ventas creadas aquí se borran al final y el stock del seed se restaura
// entero: la fase móvil vende cinco productos distintos.
function cleanup() {
  psql(`
    delete from public.stock_movement where ref_table = 'sale' and ref_id in (
      select id from public.sale where business_id = '${demoBusinessId}'
    );
    delete from public.sale where business_id = '${demoBusinessId}';
    update public.doc_sequence set next_value = 1
      where business_id = '${demoBusinessId}' and doc_type = 'SALE';
    update public.product p set stock = seed.stock
    from (values
      ('PER-001', 12), ('PER-002', 6), ('CUI-001', 18), ('CUI-002', 3), ('CUI-003', 20),
      ('ACC-001', 4), ('ACC-002', 10), ('ACC-003', 2), ('ACC-004', 30)
    ) as seed(sku, stock)
    where p.business_id = '${demoBusinessId}' and p.sku = seed.sku;
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
    const text = await locator.innerText().catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontré «${actual}».`)
}

let browser
let page
const browserErrors = []

try {
  cleanup()
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  // Cobrar a fiado sin cliente devuelve 400 a propósito: el criterio de F3.1 es
  // que se muestre el error del backend, y el navegador registra la petición.
  const expectedBadRequest = /400 \(Bad Request\)/
  page.on('console', message => {
    if (message.type() === 'error' && !expectedBadRequest.test(message.text())) browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="cart-empty"]').waitFor()

  // Buscar y agregar. PER-001: 79.000 con costo 48.000.
  await page.locator('[data-testid="caja-search"]').fill('aurora')
  await page.locator('[data-testid="result-PER-001"]').click()
  await waitForText(page.locator('[data-testid="cart-qty-PER-001"]'), '1', 'Cantidad inicial en el carrito')
  await waitForText(page.locator('[data-testid="cart-total"]'), '79.000', 'Total con un producto')
  await waitForText(page.locator('[data-testid="cart-profit"]'), '31.000', 'Ganancia estimada con un producto')

  // El botón + suma unidades y el margen por línea se recalcula.
  await page.locator('[data-testid="cart-plus-PER-001"]').click()
  await waitForText(page.locator('[data-testid="cart-qty-PER-001"]'), '2', 'Cantidad tras sumar')
  await waitForText(page.locator('[data-testid="cart-total"]'), '158.000', 'Total con dos unidades')

  // Buscar por SKU y agregar un segundo producto. CUI-001: 32.000 / costo 18.000.
  await page.locator('[data-testid="caja-search"]').fill('CUI-001')
  await page.locator('[data-testid="result-CUI-001"]').click()
  await waitForText(page.locator('[data-testid="cart-count"]'), '2 productos', 'Productos en el carrito')
  await waitForText(page.locator('[data-testid="cart-subtotal"]'), '190.000', 'Subtotal con dos productos')

  // El descuento baja el total y la ganancia por igual.
  await page.locator('#caja-discount').fill('10000')
  await page.locator('#caja-discount').blur()
  await waitForText(page.locator('[data-testid="cart-total"]'), '180.000', 'Total con descuento')
  await waitForText(page.locator('[data-testid="cart-profit"]'), '66.000', 'Ganancia con descuento')

  // Fiado sin cliente: debe mostrarse el error del backend, no un bloqueo mudo.
  await page.locator('[data-testid="method-CREDIT"]').click()
  await page.locator('[data-testid="caja-charge"]').click()
  await page.getByText('Una venta a crédito necesita un cliente.').waitFor()
  await waitForText(page.locator('[data-testid="cart-count"]'), '2 productos', 'El carrito sobrevive al error')

  if (psql(`select count(*) from public.sale where business_id = '${demoBusinessId}';`) !== '0') {
    throw new Error('El intento de fiado sin cliente dejó una venta registrada.')
  }

  // Con cliente, el fiado pasa.
  await page.locator('#caja-customer').click()
  await page.getByRole('option', { name: 'Ana Pérez' }).click()
  await page.locator('[data-testid="caja-charge"]').click()
  await page.getByText('Venta FAC-00001 registrada').waitFor()
  await page.getByText('Cobraste $ 180.000.').waitFor()

  // Cobrar limpia el carrito y baja el stock.
  await page.locator('[data-testid="cart-empty"]').waitFor()
  await waitForText(page.locator('[data-testid="cart-total"]'), '0', 'Total tras cobrar')

  const stored = psql(`
    select s.code, s.total, s.discount, s.payment_method, c.name,
      (select count(*) from public.sale_line l where l.sale_id = s.id)
    from public.sale s left join public.customer c on c.id = s.customer_id
    where s.business_id = '${demoBusinessId}';
  `)
  if (stored !== 'FAC-00001|180000|10000|CREDIT|Ana Pérez|2') {
    throw new Error(`La venta no quedó como se esperaba: ${stored}`)
  }

  const stock = psql(`select stock from public.product where sku in ('PER-001', 'CUI-001') order by sku;`)
  if (stock !== '17\n10') {
    throw new Error(`El stock no bajó como se esperaba (CUI-001 y PER-001): ${stock.replace('\n', ', ')}`)
  }

  // Vender sin existencias: se avisa pero se permite. ACC-003 tiene 2 unidades.
  await page.locator('[data-testid="caja-search"]').fill('espejo')
  await page.locator('[data-testid="result-ACC-003"]').click()
  await page.locator('[data-testid="cart-plus-ACC-003"]').click()
  await page.locator('[data-testid="cart-plus-ACC-003"]').click()
  await page.getByText('Solo hay 2 en stock; la venta seguirá y el inventario quedará en negativo.').waitFor()

  await page.locator('[data-testid="caja-charge"]').click()
  await page.getByText('Venta FAC-00002 registrada').waitFor()

  const negative = psql(`select stock from public.product where sku = 'ACC-003';`)
  if (negative !== '-1') throw new Error(`El stock de ACC-003 quedó en ${negative} y debía quedar en -1.`)

  // Vaciar el carrito sin cobrar.
  await page.locator('[data-testid="caja-search"]').fill('cosmetiquera')
  await page.locator('[data-testid="result-ACC-002"]').click()
  await waitForText(page.locator('[data-testid="cart-count"]'), '1 producto', 'Producto agregado antes de vaciar')
  await page.locator('[data-testid="caja-clear"]').click()
  await page.locator('[data-testid="cart-empty"]').waitFor()

  // Los frecuentes ya reflejan lo vendido.
  await page.locator('[data-testid="caja-frequent"]').waitFor()
  await page.locator('[data-testid="frequent-PER-001"]').waitFor()

  // La Caja no ofrece «+ Nueva venta»: ya se está en ella.
  if (await page.getByRole('button', { name: /Nueva venta/i }).count() > 0) {
    throw new Error('La Caja no debería mostrar un botón de «Nueva venta».')
  }

  // Versión móvil: el total y el cobro viven en una barra fija, porque el
  // carrito puede ser más largo que la pantalla.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })

  for (const sku of ['PER-001', 'PER-002', 'CUI-001', 'CUI-003', 'ACC-001']) {
    await page.locator('[data-testid="caja-search"]').fill(sku)
    await page.locator(`[data-testid="result-${sku}"]`).click()
  }
  await waitForText(page.locator('[data-testid="cart-count"]'), '5 productos', 'Carrito movil')

  const bar = page.locator('[data-testid="caja-mobile-bar"]')
  await bar.waitFor({ state: 'visible' })
  const barBox = await bar.boundingBox()
  if (!barBox || barBox.y + barBox.height > 845 || barBox.y < 700) {
    throw new Error(`La barra de cobro no quedo anclada abajo: ${JSON.stringify(barBox)}`)
  }

  const mobileCharge = page.locator('[data-testid="caja-charge-mobile"]')
  const chargeBox = await mobileCharge.boundingBox()
  if (!chargeBox || chargeBox.height < 44) {
    throw new Error(`El boton de cobro movil mide ${chargeBox?.height ?? 0} px de alto y debe tener al menos 44.`)
  }

  // El boton de escritorio no debe estar visible en movil: uno solo manda.
  if (await page.locator('[data-testid="caja-charge"]').isVisible()) {
    throw new Error('El boton de cobro de escritorio sigue visible en movil.')
  }

  // Ningun control por debajo del area tactil minima.
  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('button, input')]
    .map(el => ({ id: el.getAttribute('data-testid') ?? el.tagName, box: el.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) {
    throw new Error(`Controles por debajo de 44 px en movil: ${smallTargets.join(', ')}`)
  }

  await mobileCharge.click()
  await page.getByText('Venta FAC-00003 registrada').waitFor()
  await page.locator('[data-testid="cart-empty"]').waitFor()

  const mobileSale = psql(`
    select (select count(*) from public.sale_line l where l.sale_id = s.id)
    from public.sale s where s.code = 'FAC-00003';
  `)
  if (mobileSale !== '5') throw new Error(`La venta movil guardo ${mobileSale} lineas y debian ser 5.`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log('PASS: Caja buscó, armó el carrito con margen, rechazó el fiado sin cliente, cobró en escritorio y en móvil con la barra fija.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanup()
}
