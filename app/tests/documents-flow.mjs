import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3550
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const demoUserId = '10000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de documentos.')

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

/** Ventas confirmadas del mes según `metrics_summary`, que es quien manda. */
function confirmedThisMonth() {
  return Number(psqlValue(`select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select (public.metrics_summary('${demoBusinessId}', 'month', 0) ->> 'sales_count')::bigint;`))
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
  `)
}

/**
 * Una venta de hoy, una cotización vigente y otra vencida: las tres puertas
 * del visor que existen en la interfaz.
 */
function createFixtures() {
  const product = sku => `(select id from public.product where business_id = '${demoBusinessId}' and sku = '${sku}')`
  psql(`
    select set_config('request.jwt.claim.sub', '${demoUserId}', false);
    select public.create_sale('${demoBusinessId}', null, 'CASH', 0, null, jsonb_build_array(
      jsonb_build_object('product_id', ${product('PER-001')}, 'qty', 2)));
    select public.create_quote('${demoBusinessId}', null, jsonb_build_array(
      jsonb_build_object('product_id', ${product('CUI-001')}, 'qty', 1)), (current_date + 15)::date);
    select public.create_quote('${demoBusinessId}', null, jsonb_build_array(
      jsonb_build_object('product_id', ${product('ACC-002')}, 'qty', 1)), (current_date + 1)::date);
  `)
  // La vigencia se fuerza en la tabla: `create_quote` no acepta fechas pasadas.
  psql(`update public.quote q
    set valid_until = (current_timestamp at time zone b.timezone)::date - 1
    from public.business b
    where b.id = q.business_id and q.business_id = '${demoBusinessId}' and q.code = 'COT-0002';`)
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

function magic(bytes, length) {
  return [...bytes.slice(0, length)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

let browser
let page
const browserErrors = []

try {
  cleanup()
  createFixtures()

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

  // --- La venta se abre desde el Resumen ---
  await page.locator('[data-testid="recent-sale-FAC-00001"]').click()
  const viewer = page.locator('[data-testid="document-viewer"]')
  await viewer.waitFor({ state: 'visible' })
  await waitForText(page.locator('[data-testid="document-code"]'), 'FAC-00001', 'Código en el visor')
  await waitForText(page.locator('[data-testid="document-total"]'), '158.000', 'Total en el visor')
  await waitForText(page.locator('[data-testid="document-paper"]'), 'Perfume Aurora 50 ml', 'Línea del documento')
  await waitForText(page.locator('[data-testid="document-paper"]'), 'Cashi Demo', 'Encabezado del negocio')
  await waitForText(page.locator('[data-testid="document-note"]'), 'Gracias por su compra', 'Nota de la venta de contado')
  if (await page.locator('[data-testid="document-stamp"]').count()) {
    throw new Error('Una venta confirmada no debe llevar sello.')
  }
  if (await page.locator('[data-testid="document-to-sale"]').count()) {
    throw new Error('Una venta no se puede convertir; el botón no debería existir.')
  }

  // --- Descargar PDF: lo compone la Edge Function ---
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="document-pdf"]').click(),
  ])
  if (pdfDownload.suggestedFilename() !== 'factura-fac-00001.pdf') {
    throw new Error(`El PDF se llamó «${pdfDownload.suggestedFilename()}».`)
  }
  const pdfBytes = readFileSync(await pdfDownload.path())
  if (pdfBytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error(`El archivo descargado no es un PDF: ${magic(pdfBytes, 5)}`)
  }
  if (pdfBytes.length > 300 * 1024) throw new Error(`El PDF pesa ${pdfBytes.length} bytes.`)
  await page.getByText('PDF descargado').waitFor()

  // --- Descargar imagen: se dibuja en el cliente ---
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="document-image"]').click(),
  ])
  if (pngDownload.suggestedFilename() !== 'factura-fac-00001.png') {
    throw new Error(`La imagen se llamó «${pngDownload.suggestedFilename()}».`)
  }
  const pngBytes = readFileSync(await pngDownload.path())
  if (magic(pngBytes, 4) !== '89504e47') throw new Error(`El archivo descargado no es un PNG: ${magic(pngBytes, 4)}`)
  await page.getByText('Imagen descargada').waitFor()

  // --- Escape cierra el visor ---
  await page.keyboard.press('Escape')
  await viewer.waitFor({ state: 'hidden' })

  // --- Cambiar de sección cierra el visor ---
  await page.locator('[data-testid="recent-sale-FAC-00001"]').click()
  await viewer.waitFor({ state: 'visible' })
  await page.goto(`${baseUrl}/cotizaciones`, { waitUntil: 'networkidle' })
  if (await viewer.count()) throw new Error('El visor sobrevivió al cambio de sección.')

  // --- La cotización vigente se abre y se convierte ---
  const openQuoteId = psql(`select id from public.quote where business_id = '${demoBusinessId}' and code = 'COT-0001';`)
  const expiredQuoteId = psql(`select id from public.quote where business_id = '${demoBusinessId}' and code = 'COT-0002';`)

  await page.locator(`[data-testid="quote-document-${expiredQuoteId}"]`).click()
  await viewer.waitFor({ state: 'visible' })
  await waitForText(page.locator('[data-testid="document-stamp"]'), 'VENCIDA', 'Sello de la cotización vencida')
  await waitForText(page.locator('[data-testid="document-note"]'), 'venció', 'Nota de la cotización vencida')
  if (await page.locator('[data-testid="document-to-sale"]').count()) {
    throw new Error('Una cotización vencida no se puede convertir desde el visor.')
  }
  await page.locator('[data-testid="document-close"]').click()
  await viewer.waitFor({ state: 'hidden' })

  await page.locator(`[data-testid="quote-document-${openQuoteId}"]`).click()
  await viewer.waitFor({ state: 'visible' })
  await waitForText(page.locator('[data-testid="document-code"]'), 'COT-0001', 'Código de la cotización')
  // La etiqueta se dibuja en mayúsculas por CSS y así la lee `innerText`.
  await waitForText(page.locator('[data-testid="document-paper"]'), 'VÁLIDA HASTA', 'Vigencia en el documento')
  await waitForText(page.locator('[data-testid="document-total"]'), '32.000', 'Total de la cotización')
  const creditDisabled = await page.locator('[data-testid="document-to-credit"]').isDisabled()
  if (!creditDisabled) throw new Error('Sin cliente, «Convertir en fiado» debe estar desactivado.')

  await page.locator('[data-testid="document-to-sale"]').click()
  await page.getByText('Cotización cobrada').waitFor()
  await viewer.waitFor({ state: 'hidden' })

  const converted = psql(`select status from public.quote where id = '${openQuoteId}';`)
  if (converted !== 'CONVERTED') throw new Error(`La cotización quedó en ${converted} tras convertirla desde el visor.`)
  const saleFromQuote = psql(`select count(*) from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00002';`)
  if (saleFromQuote !== '1') throw new Error('La conversión no dejó la venta correspondiente.')

  // --- Móvil: el visor cabe y sus botones son tocables ---
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/reportes`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="report-sale-FAC-00001"]').click()
  await viewer.waitFor({ state: 'visible' })
  await waitForText(page.locator('[data-testid="document-code"]'), 'FAC-00001', 'Código en el visor móvil')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) throw new Error(`El visor desborda ${overflow} px a lo ancho en móvil.`)

  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('[data-testid="document-viewer"] button')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.textContent?.trim(),
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles del visor por debajo de 44 px: ${smallTargets.join(', ')}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  // --- Anular la venta desde el propio visor ---
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.locator('[data-testid="document-close"]').click()
  await viewer.waitFor({ state: 'hidden' })
  const beforeVoid = confirmedThisMonth()
  await waitForText(page.locator('[data-testid="report-history-count"]'), `${beforeVoid} ventas`, 'Historial antes de anular')

  await page.locator('[data-testid="report-sale-FAC-00001"]').click()
  await viewer.waitFor({ state: 'visible' })
  await page.locator('[data-testid="document-void"]').click()
  await page.locator('[data-testid="void-sale-confirm"]').click()
  await page.getByText('Venta FAC-00001 anulada').waitFor()
  await viewer.waitFor({ state: 'hidden' })

  const afterVoid = psql(`select
      (select status from public.sale where business_id = '${demoBusinessId}' and code = 'FAC-00001'),
      (select stock from public.product where business_id = '${demoBusinessId}' and sku = 'PER-001');`)
  // La anulación devuelve las dos unidades vendidas al stock del seed.
  if (afterVoid !== 'VOID|12') throw new Error(`La anulación no dejó el estado esperado: ${afterVoid}`)

  // El historial la conserva marcada, pero ya no cuenta como venta.
  await waitForText(page.locator('[data-testid="report-history-count"]'), `${beforeVoid - 1} ventas · 1 anulada`, 'Historial después de anular')
  await waitForText(page.locator('[data-testid="report-sale-FAC-00001"]'), 'ANULADA', 'Marca de anulada en el historial')

  await page.locator('[data-testid="report-sale-FAC-00001"]').click()
  await viewer.waitFor({ state: 'visible' })
  await waitForText(page.locator('[data-testid="document-stamp"]'), 'ANULADA', 'Sello de la venta anulada')
  if (await page.locator('[data-testid="document-void"]').count()) {
    throw new Error('Una venta ya anulada no debe ofrecer anularse otra vez.')
  }

  console.log('PASS: el visor abrió venta y cotización, descargó PDF e imagen, convirtió desde el documento, anuló una venta y se cerró al cambiar de sección.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanup()
}
