import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3500
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const demoUserId = '10000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Reportes.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

/** Última línea útil: las consultas con `set_config` devuelven dos filas. */
function psqlValue(query) {
  return psql(query).split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1) ?? ''
}

function cleanup() {
  psql(`
    delete from public.stock_movement where ref_table = 'sale' and ref_id in (
      select id from public.sale
      where business_id = '${demoBusinessId}' and code in ('FAC-00001', 'FAC-00002')
    );
    delete from public.sale
      where business_id = '${demoBusinessId}' and code in ('FAC-00001', 'FAC-00002');
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

/**
 * Dos ventas de hoy en tres categorías distintas:
 *   FAC-00001 · 2 × PER-001 (Perfumería) + 1 × CUI-001 (Cuidado personal)
 *   FAC-00002 · 1 × ACC-002 (Accesorios) con 4.000 de descuento
 * Ganancias 62.000, 14.000 y 10.000: el mejor y el peor quedan fijados.
 */
function createFixtureSales() {
  const line = sku => `jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = '${sku}'), 'qty', `
  psql(`
    select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select public.create_sale('${demoBusinessId}', null, 'CASH', 0, null, jsonb_build_array(
      ${line('PER-001')}2), ${line('CUI-001')}1)
    ));
    select public.create_sale('${demoBusinessId}', null, 'TRANSFER', 4000, null, jsonb_build_array(
      ${line('ACC-002')}1)
    ));
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

/** Compara solo los dígitos: el formato de moneda usa espacio duro y símbolo. */
async function waitForMoney(locator, amount, description) {
  const expected = String(Math.abs(amount))
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text !== null && text.replace(/\D/g, '') === expected) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba ${amount} y encontró «${actual}».`)
}

async function waitForText(locator, expected, description) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontró «${actual}».`)
}

let browser
let page
const browserErrors = []

try {
  cleanup()
  createFixtureSales()

  // Las cifras del mes se leen de `metrics_summary`, que ya tiene sus pruebas
  // SQL; aquí solo se comprueba que la vista use el periodo correcto.
  const summary = psqlValue(`select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select concat_ws('|',
      (m ->> 'revenue')::bigint,
      (m ->> 'gross_profit')::bigint,
      (m ->> 'expenses')::bigint,
      (m ->> 'net_profit')::bigint
    ) from (select public.metrics_summary('${demoBusinessId}', 'month', 0) as m) s;`)
  const [monthRevenue, monthGross, monthExpenses, monthNet] = summary.split('|').map(Number)
  const monthCost = monthRevenue - monthGross
  const monthSales = Number(psqlValue(`select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select (public.metrics_summary('${demoBusinessId}', 'month', 0) ->> 'sales_count')::bigint;`))

  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
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

  await page.goto(`${baseUrl}/reportes`, { waitUntil: 'networkidle' })

  // Reportes abre en el mes en curso, no en Hoy.
  if (await page.locator('[data-testid="period-month"]').getAttribute('aria-pressed') !== 'true') {
    throw new Error('Reportes no abrió en el periodo mensual.')
  }

  // Las cuatro cifras con su porcentaje sobre ingresos.
  await waitForMoney(page.locator('[data-testid="report-revenue"]'), monthRevenue, 'Ingresos del mes')
  await waitForMoney(page.locator('[data-testid="report-cost"]'), monthCost, 'Costo de venta del mes')
  await waitForMoney(page.locator('[data-testid="report-expenses"]'), monthExpenses, 'Gastos del mes')
  await waitForMoney(page.locator('[data-testid="report-net-profit"]'), monthNet, 'Ganancia neta del mes')
  await waitForText(page.locator('[data-testid="report-figures"]'), 'de los ingresos', 'Porcentaje sobre ingresos')

  // Ganancia por categoría: las tres del fixture, la más rentable primero.
  await waitForText(page.locator('[data-testid="report-category-Perfumería"]'), '62.000 · 39,2 %', 'Ganancia y margen de Perfumería')
  await waitForText(page.locator('[data-testid="report-category-Cuidado personal"]'), '14.000 · 43,8 %', 'Ganancia y margen de Cuidado personal')
  await waitForText(page.locator('[data-testid="report-category-Accesorios"]'), '10.000 · 40 %', 'Ganancia y margen de Accesorios')
  const categoryOrder = await page.locator('[data-testid="report-categories"] li')
    .evaluateAll(items => items.map(item => item.dataset.testid))
  if (categoryOrder[0] !== 'report-category-Perfumería') {
    throw new Error(`Las categorías se ordenaron como ${categoryOrder.join(', ')}.`)
  }

  // Mejor y peor del periodo, por ganancia.
  await waitForText(page.locator('[data-testid="report-best"]'), 'Perfume Aurora 50 ml', 'Producto más rentable')
  await waitForText(page.locator('[data-testid="report-best"]'), '62.000', 'Ganancia del más rentable')
  await waitForText(page.locator('[data-testid="report-worst"]'), 'Cosmetiquera', 'Producto menos rentable')
  await waitForText(page.locator('[data-testid="report-worst"]'), '10.000', 'Ganancia del menos rentable')

  // Historial del periodo, con las ventas del fixture.
  await waitForText(page.locator('[data-testid="report-history-count"]'), `${monthSales} ventas`, 'Conteo del historial')
  await waitForText(page.locator('[data-testid="report-sale-FAC-00001"]'), '190.000', 'Total de la primera venta')
  await waitForText(page.locator('[data-testid="report-sale-FAC-00001"]'), '76.000', 'Ganancia de la primera venta')
  await waitForText(page.locator('[data-testid="report-sale-FAC-00002"]'), '25.000', 'Total de la venta con descuento')
  await waitForText(page.locator('[data-testid="report-sale-FAC-00002"]'), 'Transferencia', 'Método de la segunda venta')

  // El historial también abre el visor de documentos.
  await page.locator('[data-testid="report-sale-FAC-00001"]').click()
  await waitForText(page.locator('[data-testid="document-code"]'), 'FAC-00001', 'Documento del historial')
  await page.locator('[data-testid="document-close"]').click()
  await page.locator('[data-testid="document-viewer"]').waitFor({ state: 'hidden' })

  // Exportación CSV: se comprueba el archivo, no solo el clic.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="report-export"]').click(),
  ])
  if (!/^ventas-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename())) {
    throw new Error(`El CSV se llamó «${download.suggestedFilename()}».`)
  }
  const csv = readFileSync(await download.path(), 'utf8')
  const csvLines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (csvLines[0] !== 'Codigo;Fecha;Cliente;Pago;Articulos;Descuento;Total;Ganancia') {
    throw new Error(`El encabezado del CSV es «${csvLines[0]}».`)
  }
  if (csvLines.length !== monthSales + 1) {
    throw new Error(`El CSV trajo ${csvLines.length - 1} ventas en vez de ${monthSales}.`)
  }
  const discounted = csvLines.find(line => line.startsWith('FAC-00002;'))
  if (!discounted?.endsWith(';Mostrador;Transferencia;1;4000;25000;10000')) {
    throw new Error(`La venta con descuento se exportó como «${discounted}».`)
  }

  // El periodo Hoy deja solo las dos ventas del fixture.
  await page.locator('[data-testid="period-today"]').click()
  await waitForText(page.locator('[data-testid="report-history-count"]'), '2 ventas', 'Historial del día')
  await waitForMoney(page.locator('[data-testid="report-revenue"]'), 215000, 'Ingresos de hoy')

  // Móvil: el historial deja de ser tabla y todo control sigue siendo tocable.
  await page.setViewportSize({ width: 390, height: 844 })
  await waitForText(page.locator('[data-testid="report-sale-FAC-00002"]'), 'transferencia', 'Línea de contexto móvil')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) throw new Error(`Reportes desborda ${overflow} px a lo ancho en móvil.`)

  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('main a, main button, main input, main [role="combobox"]')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.id || `${el.tagName}.${el.className}`,
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles por debajo de 44 px en móvil: ${smallTargets.join(', ')}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: Reportes cuadró las cuatro cifras, la ganancia por categoría, el mejor y el peor producto, el historial del periodo y la exportación CSV en escritorio y móvil.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanup()
}
