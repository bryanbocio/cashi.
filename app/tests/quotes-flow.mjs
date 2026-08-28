import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3490
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const expiredQuoteId = '79900000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Cotizaciones.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function cleanup() {
  psql(`
    delete from public.stock_movement where ref_table = 'sale' and ref_id in (
      select id from public.sale where quote_id in (
        select id from public.quote where business_id = '${demoBusinessId}'
          and (code in ('COT-0001', 'COT-0002', 'COT-EXPIRED-UI') or id = '${expiredQuoteId}')
      )
    );
    delete from public.sale where quote_id in (
      select id from public.quote where business_id = '${demoBusinessId}'
        and (code in ('COT-0001', 'COT-0002', 'COT-EXPIRED-UI') or id = '${expiredQuoteId}')
    );
    delete from public.quote where business_id = '${demoBusinessId}'
      and (code in ('COT-0001', 'COT-0002', 'COT-EXPIRED-UI') or id = '${expiredQuoteId}');
    update public.doc_sequence set next_value = 1
      where business_id = '${demoBusinessId}' and doc_type in ('QUOTE', 'SALE');
    update public.product set stock = 12 where business_id = '${demoBusinessId}' and sku = 'PER-001';
    update public.product set stock = 18 where business_id = '${demoBusinessId}' and sku = 'CUI-001';
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

async function addProduct(page, query, sku) {
  await page.locator('[data-testid="caja-search"]').fill(query)
  await page.locator(`[data-testid="result-${sku}"]`).click()
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
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await addProduct(page, 'aurora', 'PER-001')
  await page.locator('#caja-discount').fill('1000')
  await page.locator('#caja-discount').blur()
  await page.locator('[data-testid="caja-save-quote"]').click()
  await page.getByText('No se puede cotizar con descuento').waitFor()
  if (await page.getByRole('dialog', { name: 'Guardar cotización' }).count()) {
    throw new Error('El modal se abrió aunque el carrito tenía descuento.')
  }

  await page.locator('#caja-discount').fill('0')
  await page.locator('#caja-discount').blur()
  await page.locator('#caja-customer').click()
  await page.getByRole('option', { name: /Ana P/ }).click()

  const stockBefore = psql("select stock from public.product where sku = 'PER-001';")
  await page.locator('[data-testid="caja-save-quote"]').click()
  const validUntilInput = page.locator('#quote-valid-until')
  await validUntilInput.waitFor()
  const defaultValidity = await validUntilInput.inputValue()
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(defaultValidity)) {
    throw new Error(`La vigencia predeterminada no tiene formato legible: ${defaultValidity}`)
  }
  await page.locator('[data-testid="quote-save-submit"]').click()
  await page.waitForURL(url => url.pathname === '/cotizaciones')
  await page.getByText('Cotización COT-0001 guardada').waitFor()

  const first = psql(`
    select q.id, q.code, q.status, q.total, c.name,
      q.valid_until = ((current_timestamp at time zone b.timezone)::date + 15),
      (select count(*) from public.quote_line l where l.quote_id = q.id),
      (select count(*) from public.sale s where s.quote_id = q.id),
      (select count(*) from public.stock_movement m where m.ref_id = q.id)
    from public.quote q join public.business b on b.id = q.business_id
    left join public.customer c on c.id = q.customer_id
    where q.business_id = '${demoBusinessId}' and q.code = 'COT-0001';
  `)
  const [firstQuoteId, ...firstValues] = first.split('|')
  if (!firstQuoteId || firstValues.join('|') !== 'COT-0001|OPEN|79000|Ana Pérez|t|1|0|0') {
    throw new Error(`La primera cotización no quedó como se esperaba: ${first}`)
  }
  if (psql("select stock from public.product where sku = 'PER-001';") !== stockBefore) {
    throw new Error('Guardar la cotización alteró el stock.')
  }

  await waitForText(page.locator('[data-testid="quote-open-total"]'), '79.000', 'Total vigente')
  await waitForText(page.locator('body'), 'Perfume Aurora', 'Detalle de la cotización')
  await page.locator(`[data-testid="quote-credit-${firstQuoteId}"]`).click()
  await page.getByText('Cotización pasada a fiado').waitFor()
  await page.locator(`[data-testid="quote-credit-${firstQuoteId}"]`).waitFor({ state: 'detached' })

  const convertedCredit = psql(`
    select q.status, s.payment_method, s.total,
      (select stock from public.product where sku = 'PER-001'),
      (select count(*) from public.stock_movement m where m.ref_id = s.id and m.type = 'SALE')
    from public.quote q join public.sale s on s.quote_id = q.id where q.id = '${firstQuoteId}';
  `)
  if (convertedCredit !== 'CONVERTED|CREDIT|79000|11|1') {
    throw new Error(`La conversión a fiado no quedó como se esperaba: ${convertedCredit}`)
  }

  await page.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await addProduct(page, 'CUI-001', 'CUI-001')
  await page.locator('[data-testid="caja-save-quote"]').click()
  await page.locator('[data-testid="quote-save-submit"]').click()
  await page.waitForURL(url => url.pathname === '/cotizaciones')
  const secondQuoteId = psql(`select id from public.quote where business_id = '${demoBusinessId}' and code = 'COT-0002';`)
  if (!secondQuoteId) throw new Error('No se creó la cotización sin cliente.')
  if (!(await page.locator(`[data-testid="quote-credit-${secondQuoteId}"]`).isDisabled())) {
    throw new Error('A fiado está habilitado para una cotización sin cliente.')
  }

  psql(`
    insert into public.quote (id, business_id, code, valid_until, status, total)
    values ('${expiredQuoteId}', '${demoBusinessId}', 'COT-EXPIRED-UI',
      (current_timestamp at time zone 'America/Bogota')::date - 1, 'OPEN', 79000);
    insert into public.quote_line (quote_id, product_id, name_snapshot, qty, unit_price, unit_cost)
    values ('${expiredQuoteId}', '50000000-0000-0000-0000-000000000001',
      'Perfume Aurora 50 ml', 1, 79000, 48000);
  `)
  await page.reload({ waitUntil: 'networkidle' })
  await waitForText(page.locator('body'), 'VENCIDA', 'Estado vencido visible')
  if (!(await page.locator(`[data-testid="quote-charge-${expiredQuoteId}"]`).isDisabled())) {
    throw new Error('Cobrar está habilitado para una cotización vencida.')
  }
  // Ver/PDF abre el visor de documentos (F8.1); su contenido lo prueba
  // `documents-flow`, aquí solo se comprueba que la acción lleva allí.
  await page.locator(`[data-testid="quote-document-${secondQuoteId}"]`).click()
  await page.locator('[data-testid="document-viewer"]').waitFor({ state: 'visible' })
  await page.locator('[data-testid="document-close"]').click()
  await page.locator('[data-testid="document-viewer"]').waitFor({ state: 'hidden' })

  await page.setViewportSize({ width: 390, height: 844 })
  const secondCard = page.locator(`[data-testid="quote-card-${secondQuoteId}"]`)
  await secondCard.waitFor({ state: 'visible' })
  const mobileCredit = page.locator(`[data-testid="quote-credit-mobile-${secondQuoteId}"]`)
  if (!(await mobileCredit.isDisabled())) throw new Error('A fiado móvil está habilitado sin cliente.')
  for (const testId of [`quote-charge-mobile-${secondQuoteId}`, `quote-credit-mobile-${secondQuoteId}`, `quote-document-mobile-${secondQuoteId}`, `quote-delete-mobile-${secondQuoteId}`]) {
    const box = await page.locator(`[data-testid="${testId}"]`).boundingBox()
    if (!box || box.height < 44) throw new Error(`${testId} mide ${box?.height ?? 0} px; debe medir al menos 44.`)
  }

  await page.locator(`[data-testid="quote-charge-mobile-${secondQuoteId}"]`).click()
  await page.getByText('Cotización cobrada').waitFor()
  await secondCard.waitFor({ state: 'detached' })
  const convertedCash = psql(`select q.status, s.payment_method, s.total from public.quote q join public.sale s on s.quote_id = q.id where q.id = '${secondQuoteId}';`)
  if (convertedCash !== 'CONVERTED|CASH|32000') throw new Error(`La conversión de contado no quedó como se esperaba: ${convertedCash}`)

  await page.locator(`[data-testid="quote-delete-mobile-${expiredQuoteId}"]`).click()
  await page.locator('[data-testid="quote-delete-confirm"]').click()
  await page.getByText('Cotización eliminada').waitFor()
  if (psql(`select count(*) from public.quote where id = '${expiredQuoteId}';`) !== '0') {
    throw new Error('La cotización vencida no fue eliminada.')
  }

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: Caja guardó cotizaciones sin descuento ni efecto en stock; el listado convirtió a fiado/contado, bloqueó vencidas y respondió en móvil.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanup()
}
