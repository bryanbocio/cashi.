import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3460
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const concept = 'Reparación de vitrina F4.1'
const editedConcept = 'Reparación corregida F4.1'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Gastos.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function cleanupFixture() {
  psql(`delete from public.expense where business_id = '${demoBusinessId}' and concept in ('${concept}', '${editedConcept}');`)
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

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="expense-count"]'), '5 gastos', 'Conteo inicial del seed')
  await waitForText(page.locator('[data-testid="expense-month-total"]'), '1,878,000.00', 'Total mensual inicial')
  await waitForText(page.locator('[data-testid="expense-category-Servicios"]'), '486,000.00', 'Agregado de Servicios')

  // El filtro de categoría combina las dos filas de Servicios.
  await page.locator('#expense-filter-category').click()
  await page.getByRole('option', { name: 'Servicios', exact: true }).click()
  await waitForText(page.locator('[data-testid="expense-count"]'), '2 gastos', 'Filtro por categoría')
  await page.locator('[data-testid="expense-clear-filters"]').click()
  await waitForText(page.locator('[data-testid="expense-count"]'), '5 gastos', 'Restablecimiento de filtros')

  // «Otro» habilita el concepto libre solicitado por el usuario.
  await page.locator('[data-testid="open-expense"]').click()
  await page.locator('#expense-category').click()
  await page.getByRole('option', { name: 'Otro', exact: true }).click()
  await page.locator('[data-testid="expense-concept-wrap"]').waitFor()
  await page.locator('#expense-concept').fill(concept)
  await page.locator('#expense-amount').fill('45000')
  await page.getByRole('checkbox', { name: /Gasto recurrente/i }).check()
  await page.locator('[data-testid="expense-create-submit"]').click()
  await page.getByText('El gasto ya cuenta para la ganancia neta.').waitFor()

  await waitForText(page.locator('[data-testid="expense-count"]'), '6 gastos', 'Conteo después del alta')
  await waitForText(page.locator('[data-testid="expense-month-total"]'), '1,923,000.00', 'Total después del alta')
  await waitForText(page.locator('[data-testid="expense-category-Otro"]'), '45,000.00', 'Distribución después del alta')

  const stored = psql(`
    select e.id, e.category, e.amount, e.recurring,
      spent_at = (current_timestamp at time zone b.timezone)::date
    from public.expense e
    join public.business b on b.id = e.business_id
    where e.business_id = '${demoBusinessId}' and e.concept = '${concept}';
  `)
  const [expenseId, category, amount, recurring, isToday] = stored.split('|')
  if (!expenseId || category !== 'Otro' || amount !== '45000' || recurring !== 't' || isToday !== 't') {
    throw new Error(`El gasto no quedó como se esperaba: ${stored}`)
  }

  // La edición precarga el gasto y actualiza tanto la fila como el resumen.
  await page.locator(`[data-testid="expense-edit-${expenseId}"]`).click()
  await page.getByText('Editar gasto', { exact: true }).waitFor()
  await page.locator('#expense-concept').fill(editedConcept)
  await page.locator('#expense-amount').fill('52000')
  await page.locator('[data-testid="expense-create-submit"]').click()
  await page.getByText('Los cambios ya aparecen en el resumen.').waitFor()
  await waitForText(page.locator('[data-testid="expense-month-total"]'), '1,930,000.00', 'Total después de editar')
  await page.getByText(editedConcept, { exact: true }).first().waitFor()

  const updated = psql(`
    select concept, amount, recurring
    from public.expense
    where id = '${expenseId}' and business_id = '${demoBusinessId}';
  `)
  if (updated !== `${editedConcept}|52000|t`) {
    throw new Error(`La edición no quedó persistida: ${updated}`)
  }

  await page.locator('#expense-filter-category').click()
  await page.getByRole('option', { name: 'Otro', exact: true }).click()
  await waitForText(page.locator('[data-testid="expense-count"]'), '1 gasto', 'Filtro de la categoría Otro')
  await page.locator(`[data-testid="expense-row-${expenseId}"]`).waitFor()

  // El rango se interpreta como fechas de calendario inclusivas para el usuario.
  const today = psql(`
    select to_char((current_timestamp at time zone timezone)::date, 'DD/MM/YYYY')
    from public.business where id = '${demoBusinessId}';
  `)
  await page.locator('[data-testid="expense-clear-filters"]').click()
  await page.locator('#expense-from').fill(today)
  await page.locator('#expense-from').press('Tab')
  await page.locator('#expense-to').fill(today)
  await page.locator('#expense-to').press('Tab')
  await waitForText(page.locator('[data-testid="expense-count"]'), '2 gastos', 'Filtro por un solo día')

  // En móvil la tabla desaparece y cada gasto ocupa una tarjeta legible.
  await page.locator('#expense-filter-category').click()
  await page.getByRole('option', { name: 'Otro', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const card = page.locator(`[data-testid="expense-card-${expenseId}"]`)
  await card.waitFor({ state: 'visible' })
  await waitForText(card, editedConcept, 'Tarjeta móvil del gasto')
  await waitForText(card, 'RECURRENTE', 'Marca recurrente móvil')

  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('button, input, [role="combobox"]')]
    .map(el => ({
      id: el.getAttribute('data-testid') || el.id || `${el.tagName}.${el.className}`,
      box: el.getBoundingClientRect(),
    }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
    .map(({ id, box }) => `${id} (${Math.round(box.height)} px)`))
  if (smallTargets.length) throw new Error(`Controles por debajo de 44 px en móvil: ${smallTargets.join(', ')}`)

  // El borrado exige confirmación y retira el monto del resumen mensual.
  await page.locator(`[data-testid="expense-delete-mobile-${expenseId}"]`).click()
  await page.getByText('Eliminar gasto', { exact: true }).first().waitFor()
  await page.locator('[data-testid="expense-delete-confirm"]').click()
  await page.getByText('El resumen mensual fue actualizado.').waitFor()
  await waitForText(page.locator('[data-testid="expense-count"]'), '0 gastos', 'Conteo después de eliminar')
  await waitForText(page.locator('[data-testid="expense-month-total"]'), '1,878,000.00', 'Total después de eliminar')
  if (psql(`select count(*) from public.expense where id = '${expenseId}';`) !== '0') {
    throw new Error('El gasto eliminado todavía existe en PostgreSQL.')
  }

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  console.log('PASS: Gastos resumió, filtró, creó, editó y eliminó; en móvil cambió a tarjetas con controles accesibles.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3500)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanupFixture()
}
