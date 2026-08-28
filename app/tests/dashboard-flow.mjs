import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3490
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const demoUserId = '10000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba del Resumen.')

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

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// La venta de prueba se borra al final y el stock del seed se restaura entero.
function cleanup() {
  psql(`
    delete from public.stock_movement where ref_table = 'sale' and ref_id in (
      select id from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00001'
    );
    delete from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00001';
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
 * Venta de hoy con dos productos: 2 × PER-001 y 1 × CUI-001.
 * Ingreso 190.000 y ganancia 76.000, ambos independientes de la fecha.
 */
function createFixtureSale() {
  psql(`
    select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select public.create_sale(
      '${demoBusinessId}', null, 'CASH', 0, null,
      jsonb_build_array(
        jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = 'PER-001'), 'qty', 2),
        jsonb_build_object('product_id', (select id from public.product where business_id = '${demoBusinessId}' and sku = 'CUI-001'), 'qty', 1)
      )
    );
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
  const expected = String(amount)
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text !== null && text.replace(/\D/g, '') === expected) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba ${amount} y encontró «${actual}».`)
}

/** La etiqueta de periodo se muestra capitalizada por CSS. */
async function waitForLabel(locator, expected, description) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text && text.toLowerCase().includes(expected.toLowerCase())) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontró «${actual}».`)
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
  createFixtureSale()

  // La fecha local del negocio decide qué barra de la gráfica es la de hoy.
  const businessToday = psql(`select (current_timestamp at time zone b.timezone)::date
    from public.business b where b.id = '${demoBusinessId}';`)
  const expensesToday = Number(psql(`select coalesce(sum(e.amount), 0) from public.expense e
    where e.business_id = '${demoBusinessId}'
      and e.spent_at = (current_timestamp at time zone (select timezone from public.business where id = '${demoBusinessId}'))::date;`))
  const netProfit = 76000 - expensesToday
  const netProfitLabel = new Intl.NumberFormat('es-CO').format(Math.abs(netProfit))

  // Las etiquetas de mes se calculan aquí para que la prueba no dependa de la
  // fecha real; los importes se leen del propio `metrics_summary`, que ya tiene
  // sus 36 pruebas SQL.
  function monthLabel(offset) {
    const [year, month] = businessToday.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1 - offset, 1))
    return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  }

  function summaryRevenue(period, offset) {
    return Number(psqlValue(`select set_config('request.jwt.claim.sub', '${demoUserId}', false);
      select (public.metrics_summary('${demoBusinessId}', '${period}', ${offset}) ->> 'revenue')::bigint;`))
  }

  const monthRevenue = offset => summaryRevenue('month', offset)
  const weekRevenue = summaryRevenue('7d', 0)

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

  await waitForText(page.locator('[data-testid="active-business-name"]'), 'Cashi Demo', 'Negocio activo del Resumen')

  // KPIs del periodo Hoy.
  await waitForText(page.locator('[data-testid="kpi-revenue"]'), '190.000', 'Ventas de hoy')
  await waitForText(page.locator('[data-testid="kpi-gross-profit"]'), '76.000', 'Ganancia bruta de hoy')
  await waitForText(page.locator('[data-testid="dashboard-kpis"]'), '40 % de margen', 'Margen bruto de hoy')
  await waitForText(page.locator('[data-testid="kpi-expenses"]'), new Intl.NumberFormat('es-CO').format(expensesToday), 'Gastos de hoy')
  await waitForText(page.locator('[data-testid="kpi-net-profit"]'), netProfitLabel, 'Ganancia neta de hoy')
  await waitForText(page.locator('[data-testid="kpi-receivable"]'), '790.000', 'Cartera por cobrar')
  await waitForText(page.locator('[data-testid="kpi-receivable-link"]'), '3 clientes con deuda', 'Deudores en el KPI de cartera')

  // La cartera es una foto global: navega a Fiados y vuelve.
  await page.locator('[data-testid="kpi-receivable-link"]').click()
  await page.waitForURL(url => url.pathname === '/fiados')
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="kpi-revenue"]'), '190.000', 'Ventas tras volver de Fiados')

  // Gráfica: 14 días y la venta de hoy en la barra correspondiente.
  const chartDays = await page.locator('[data-testid="dashboard-chart"] > div').count()
  if (chartDays !== 14) throw new Error(`La gráfica dibujó ${chartDays} días en vez de 14.`)
  const todayBar = page.locator(`[data-testid="chart-day-${businessToday}"]`)
  // Intl separa el símbolo con un espacio duro; se normaliza para comparar.
  const todayLabel = (await todayBar.getAttribute('title') ?? '').replace(/\s/g, ' ')
  if (!todayLabel.includes('190.000') || !todayLabel.includes('gana $ 76.000')) {
    throw new Error(`La barra de hoy describe «${todayLabel}» en vez de la venta de 190.000 con 76.000 de ganancia.`)
  }

  // Rentabilidad por producto: mismo periodo que los KPI.
  await waitForText(page.locator('[data-testid="top-products"]'), 'Perfume Aurora 50 ml', 'Producto más rentable')
  await waitForText(page.locator('[data-testid="top-products"]'), '62.000 · 39,2 %', 'Ganancia y margen del perfume')
  await waitForText(page.locator('[data-testid="top-products"]'), '14.000 · 43,8 %', 'Ganancia y margen de la crema')
  const productOrder = await page.locator('[data-testid="top-products"] li').allInnerTexts()
  if (productOrder.length !== 2) throw new Error(`La rentabilidad listó ${productOrder.length} productos en vez de 2.`)
  if (!productOrder[0].includes('Perfume Aurora')) throw new Error('La rentabilidad no ordenó por ganancia.')

  // Últimas ventas y el aviso del visor de documentos.
  await waitForText(page.locator('[data-testid="recent-sales"]'), 'FAC-00001', 'Código de la última venta')
  await waitForText(page.locator('[data-testid="recent-sale-FAC-00001"]'), '3 artículos', 'Artículos de la última venta')
  await waitForText(page.locator('[data-testid="recent-sale-FAC-00001"]'), '190.000', 'Total de la última venta')
  // Tocar una venta abre el visor de documentos; su detalle lo prueba
  // `documents-flow`.
  await page.locator('[data-testid="recent-sale-FAC-00001"]').click()
  await waitForText(page.locator('[data-testid="document-code"]'), 'FAC-00001', 'Documento de la venta reciente')
  await page.locator('[data-testid="document-close"]').click()
  await page.locator('[data-testid="document-viewer"]').waitFor({ state: 'hidden' })

  // Alertas: los tres grupos que produce el seed, en orden operativo.
  await waitForText(page.locator('[data-testid="alert-count"]'), '3', 'Conteo de alertas')
  await waitForText(page.locator('[data-testid="alert-LOW_STOCK"]'), '2 productos bajo el mínimo', 'Alerta de stock bajo')
  await waitForText(page.locator('[data-testid="alert-LOW_STOCK"]'), 'Espejo compacto (2 de 4)', 'Detalle de stock bajo')
  await waitForText(page.locator('[data-testid="alert-OVERDUE_CREDIT"]'), '1 cliente con fiado vencido', 'Alerta de fiado vencido')
  await waitForText(page.locator('[data-testid="alert-OVERDUE_CREDIT"]'), '350.000 en total', 'Monto vencido')
  await waitForText(page.locator('[data-testid="alert-THIN_MARGIN"]'), '1 producto con margen estrecho', 'Alerta de margen estrecho')
  if (await page.locator('[data-testid="alert-PENDING_PURCHASE"]').count()) {
    throw new Error('El seed no tiene órdenes pendientes, pero apareció la alerta de compras.')
  }
  const alertOrder = await page.locator('[data-testid="dashboard-alerts"] li').evaluateAll(items => items.map(item => item.dataset.testid))
  if (alertOrder.join(',') !== 'alert-LOW_STOCK,alert-OVERDUE_CREDIT,alert-THIN_MARGIN') {
    throw new Error(`Las alertas se ordenaron como ${alertOrder.join(', ')}.`)
  }

  // Cada alerta navega a su sección con el filtro ya aplicado.
  await page.locator('[data-testid="alert-action-LOW_STOCK"]').click()
  await page.waitForURL(url => url.pathname === '/inventario' && url.search === '?filter=low')
  await waitForText(page.locator('[data-testid="inventory-count"]'), '2 productos', 'Inventario filtrado por stock bajo')
  await waitForText(page.locator('body'), 'Espejo compacto', 'Producto con stock bajo listado')

  await page.goto(`${baseUrl}/inventario?filter=thin`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '1 producto', 'Inventario filtrado por margen estrecho')
  await waitForText(page.locator('body'), 'Bolsa de regalo', 'Producto con margen estrecho listado')

  // --- F7.2 · Selector de periodo ---
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), 190000, 'Ventas de hoy al volver al Resumen')

  if (await page.locator('[data-testid="period-today"]').getAttribute('aria-pressed') !== 'true') {
    throw new Error('El periodo Hoy no quedó marcado como activo al abrir el Resumen.')
  }
  if (await page.locator('[data-testid="month-nav"]').count()) {
    throw new Error('Las flechas de mes se muestran fuera del periodo mensual.')
  }

  await page.locator('[data-testid="period-month"]').click()
  await page.locator('[data-testid="month-nav"]').waitFor()
  await waitForLabel(page.locator('[data-testid="period-label"]'), monthLabel(0), 'Etiqueta del mes actual')
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), monthRevenue(0), 'Ventas del mes actual')
  await waitForLabel(page.locator('[data-testid="top-products-period"]'), monthLabel(0), 'Periodo en el título de rentabilidad')
  if (!await page.locator('[data-testid="month-next"]').isDisabled()) {
    throw new Error('La flecha hacia adelante quedó activa en el mes actual.')
  }

  await page.locator('[data-testid="month-prev"]').click()
  await waitForLabel(page.locator('[data-testid="period-label"]'), monthLabel(1), 'Etiqueta del mes anterior')
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), monthRevenue(1), 'Ventas del mes anterior')
  if (await page.locator('[data-testid="month-next"]').isDisabled()) {
    throw new Error('La flecha hacia adelante siguió desactivada fuera del mes actual.')
  }

  // Las alertas y la cartera no dependen del periodo navegado.
  await waitForText(page.locator('[data-testid="alert-count"]'), '3', 'Alertas tras cambiar de mes')
  await waitForMoney(page.locator('[data-testid="kpi-receivable"]'), 790000, 'Cartera tras cambiar de mes')

  await page.locator('[data-testid="month-select"]').click()
  const monthCount = await page.getByRole('option').count()
  if (monthCount !== 18) throw new Error(`El selector ofreció ${monthCount} meses en vez de 18.`)
  await page.getByRole('option', { name: new RegExp(`^${monthLabel(3)}$`, 'i') }).click()
  await waitForLabel(page.locator('[data-testid="period-label"]'), monthLabel(3), 'Etiqueta del mes elegido')
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), monthRevenue(3), 'Ventas del mes elegido')

  await page.locator('[data-testid="period-7d"]').click()
  if (await page.locator('[data-testid="month-nav"]').count()) {
    throw new Error('Las flechas de mes siguieron visibles en el periodo de 7 días.')
  }
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), weekRevenue, 'Ventas de los últimos 7 días')

  await page.locator('[data-testid="period-today"]').click()
  await waitForMoney(page.locator('[data-testid="kpi-revenue"]'), 190000, 'Ventas al volver a Hoy')

  // Móvil: los paneles se apilan y ningún control queda por debajo de 44 px.
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.setViewportSize({ width: 390, height: 844 })
  await waitForText(page.locator('[data-testid="kpi-revenue"]'), '190.000', 'Ventas visibles en móvil')
  const kpiColumns = await page.locator('[data-testid="dashboard-kpis"]')
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  if (kpiColumns !== 2) throw new Error(`Los KPI se dibujaron en ${kpiColumns} columnas en móvil en vez de 2.`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) throw new Error(`El Resumen desborda ${overflow} px a lo ancho en móvil.`)

  // El selector ocupa el ancho completo, usa etiquetas cortas y oculta la nota.
  const segmentedWidth = await page.locator('[data-testid="period-today"]')
    .evaluate(el => el.parentElement.getBoundingClientRect().width)
  const contentWidth = await page.locator('[data-testid="dashboard-period"]')
    .evaluate(el => el.getBoundingClientRect().width)
  if (segmentedWidth < contentWidth - 1) {
    throw new Error(`El segmentado midió ${Math.round(segmentedWidth)} px de ${Math.round(contentWidth)} disponibles en móvil.`)
  }
  await waitForText(page.locator('[data-testid="period-7d"]'), '7 d', 'Etiqueta corta del segmentado en móvil')
  if (await page.locator('[data-testid="period-note"]').isVisible()) {
    throw new Error('La nota de comparación debe ocultarse en móvil.')
  }

  // Las flechas y el selector de mes también deben cumplir los 44 px.
  await page.locator('[data-testid="period-month"]').click()
  await page.locator('[data-testid="month-nav"]').waitFor()

  // Solo el contenido de la vista: la marca del encabezado la fija el layout.
  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('main a, main button, main input, main [role="combobox"]')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.id || `${el.tagName}.${el.className}`,
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles por debajo de 44 px en móvil: ${smallTargets.join(', ')}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: el Resumen mostró KPIs, gráfica de 14 días, rentabilidad, últimas ventas, alertas navegables y el selector de periodo en escritorio y móvil.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanup()
}
