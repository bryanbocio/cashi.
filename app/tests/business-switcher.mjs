import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3440
const baseUrl = `http://127.0.0.1:${port}`
const activeBusinessKey = 'cashi.active-business-id'
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba del selector de negocio.')

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
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

function watchBrowserErrors(page, browserErrors) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))
}

async function openSwitcher(page) {
  await page.getByRole('button', { name: /Cambiar negocio\. Activo:/ }).click()
  await page.locator('[data-testid="business-switcher-menu"]:visible').last().waitFor()
}

async function waitForStoredBusiness(page, businessId) {
  await page.waitForFunction(({ key, expected }) => localStorage.getItem(key) === expected, {
    key: activeBusinessKey,
    expected: businessId,
  })
}

async function waitForText(locator, expected, description) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontré «${actual}».`)
}

function cleanupBusiness(businessId) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return
  const query = `
    delete from public.business
    where id = '${businessId}'
      and created_by = '10000000-0000-0000-0000-000000000001';
  `
  execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', query,
  ], { stdio: 'ignore' })
}

const timestamp = Date.now()
const secondBusinessName = `Tienda F1.4 ${timestamp}`
let browser
let createdBusinessId

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const browserErrors = []
  const context = await browser.newContext()
  const page = await context.newPage()
  watchBrowserErrors(page, browserErrors)

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByTestId('active-business-name').getByText('Cashi Demo', { exact: true }).waitFor()

  await openSwitcher(page)
  await page.getByRole('link', { name: 'Crear otro negocio' }).click()
  await page.waitForURL(url => url.pathname === '/onboarding')
  await page.locator('#business-name').fill(secondBusinessName)
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByTestId('active-business-name').getByText(secondBusinessName, { exact: true }).waitFor()

  createdBusinessId = await page.evaluate(key => localStorage.getItem(key), activeBusinessKey)
  if (!createdBusinessId || createdBusinessId === demoBusinessId) {
    throw new Error('El segundo negocio no quedó activo después del onboarding.')
  }

  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await page.getByTestId('active-business-name').getByText(secondBusinessName, { exact: true }).waitFor()
  await openSwitcher(page)

  const activeSecondOption = page.getByRole('button', { name: `Cambiar a ${secondBusinessName}` })
  if (await activeSecondOption.getAttribute('aria-current') !== 'true') {
    throw new Error('El selector no marcó el segundo negocio como activo.')
  }

  await page.getByRole('button', { name: 'Cambiar a Cashi Demo' }).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByTestId('business-switcher-menu').waitFor({ state: 'hidden' })
  await waitForStoredBusiness(page, demoBusinessId)
  await page.getByTestId('active-business-name').getByText('Cashi Demo', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cambiar negocio. Activo: Cashi Demo' }).waitFor()

  await openSwitcher(page)
  await page.getByRole('button', { name: `Cambiar a ${secondBusinessName}` }).click()
  await waitForStoredBusiness(page, createdBusinessId)
  await page.getByTestId('active-business-name').getByText(secondBusinessName, { exact: true }).waitFor()
  await page.locator('[data-testid="business-switcher-menu"]:visible').waitFor({ state: 'hidden' })

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '0 productos', 'Inventario del negocio nuevo')
  await page.getByText('Este negocio todavía no tiene productos.').first().waitFor()

  await openSwitcher(page)
  await page.getByRole('button', { name: 'Cambiar a Cashi Demo' }).click()
  await waitForStoredBusiness(page, demoBusinessId)
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('[data-testid="inventory-count"]'), '9 productos', 'Inventario del negocio demo')

  await openSwitcher(page)
  await page.getByRole('button', { name: `Cambiar a ${secondBusinessName}` }).click()
  await waitForStoredBusiness(page, createdBusinessId)
  await page.locator('[data-testid="business-switcher-menu"]:visible').waitFor({ state: 'hidden' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: `Cambiar negocio. Activo: ${secondBusinessName}` }).waitFor()
  await openSwitcher(page)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(url => url.pathname === '/login')

  const storedAfterLogout = await page.evaluate(key => localStorage.getItem(key), activeBusinessKey)
  if (storedAfterLogout !== null) throw new Error('Cerrar sesión no limpió el negocio activo.')
  const cookiesAfterLogout = await context.cookies()
  if (cookiesAfterLogout.some(cookie => cookie.name.includes('auth-token'))) {
    throw new Error('Cerrar sesión no eliminó la cookie de Supabase.')
  }

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: selector alternó Cashi Demo y ${secondBusinessName}, limpió la vista y cerró la sesión.`)
} finally {
  await browser?.close()
  server.kill()
  if (createdBusinessId) cleanupBusiness(createdBusinessId)
}
