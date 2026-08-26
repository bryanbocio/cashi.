import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3470
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const anaId = '60000000-0000-0000-0000-000000000001'
const carlosId = '60000000-0000-0000-0000-000000000002'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Fiados.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function cleanupFixture() {
  psql(`delete from public.payment
    where business_id = '${demoBusinessId}'
      and customer_id = '${carlosId}'
      and amount = 280000
      and method = 'CARD';`)
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

  await page.goto(`${baseUrl}/fiados`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="credit-count"]'), '3 clientes con deuda', 'Conteo inicial de deudores')
  await waitForText(page.locator('[data-testid="credit-total-debt"]'), '790.000', 'Cartera inicial')
  await waitForText(page.locator('[data-testid="credit-debtor-count"]'), '3', 'Clientes iniciales')
  await waitForText(page.locator('[data-testid="credit-paid-month"]'), '100.000', 'Abonos iniciales del mes')
  await waitForText(page.locator(`[data-testid="credit-debt-${anaId}"]`), '350.000', 'Deuda vencida de Ana')
  await waitForText(page.locator('body'), 'DÍAS VENCIDOS', 'Estado vencido visible')

  await page.locator(`[data-testid="credit-pay-${carlosId}"]`).click()
  await page.getByText('Abono de Carlos Gómez', { exact: true }).waitFor()
  await page.locator('[data-testid="credit-pay-all"]').click()
  const amountDigits = await page.locator('#credit-payment-amount').inputValue().then(value => value.replace(/\D/g, ''))
  if (amountDigits !== '280000') throw new Error(`«Abonar todo» precargó ${amountDigits || 'un valor vacío'} en vez de 280000.`)

  await page.locator('#credit-payment-method').click()
  await page.getByRole('option', { name: 'Tarjeta', exact: true }).click()
  await page.locator('[data-testid="credit-payment-submit"]').click()
  await page.getByText('Carlos Gómez quedó al día.').waitFor()

  await waitForText(page.locator('[data-testid="credit-count"]'), '2 clientes con deuda', 'Conteo después de pagar todo')
  await waitForText(page.locator('[data-testid="credit-total-debt"]'), '510.000', 'Cartera después de pagar todo')
  await waitForText(page.locator('[data-testid="credit-debtor-count"]'), '2', 'Deudores después de pagar todo')
  await waitForText(page.locator('[data-testid="credit-paid-month"]'), '380.000', 'Abonos del mes después de pagar todo')
  if (await page.locator(`[data-testid="credit-pay-${carlosId}"]`).count()) {
    throw new Error('Carlos continúa en la lista después de saldar la deuda.')
  }

  const stored = psql(`select p.amount, p.method,
      (select count(*) from public.v_credits v where v.customer_id = '${carlosId}')
    from public.payment p
    where p.business_id = '${demoBusinessId}'
      and p.customer_id = '${carlosId}'
      and p.amount = 280000
      and p.method = 'CARD';`)
  if (stored !== '280000|CARD|0') throw new Error(`El abono total no quedó persistido como se esperaba: ${stored}`)

  await page.setViewportSize({ width: 390, height: 844 })
  const anaCard = page.locator(`[data-testid="credit-card-${anaId}"]`)
  await anaCard.waitFor({ state: 'visible' })
  await waitForText(anaCard, 'Ana Pérez', 'Tarjeta móvil de Ana')
  await waitForText(anaCard, '350.000', 'Deuda móvil de Ana')
  await waitForText(anaCard, 'VENCIDOS', 'Vencimiento móvil de Ana')

  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('button, input, [role="combobox"]')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.id || `${el.tagName}.${el.className}`,
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles por debajo de 44 px en móvil: ${smallTargets.join(', ')}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: Fiados resumió la cartera, mostró vencimientos y «Abonar todo» saldó al cliente en escritorio y móvil.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanupFixture()
}
