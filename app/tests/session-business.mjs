import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3420
const baseUrl = `http://127.0.0.1:${port}`
const activeBusinessKey = 'cashi.active-business-id'
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const foreignBusinessId = '20000000-0000-0000-0000-000000000010'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de sesión y negocio.')

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

function watchBrowserErrors(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const browserErrors = []

  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  watchBrowserErrors(anonymousPage, browserErrors)
  await anonymousPage.goto(`${baseUrl}/caja`, { waitUntil: 'networkidle' })
  await anonymousPage.waitForURL(url => url.pathname === '/login' && url.searchParams.get('redirect') === '/caja')
  await anonymousContext.close()

  const onboardingContext = await browser.newContext()
  const onboardingPage = await onboardingContext.newPage()
  watchBrowserErrors(onboardingPage, browserErrors)
  await login(onboardingPage, 'onboarding@cashi.local', 'CashiOnboarding2026!')
  await onboardingPage.waitForURL(url => url.pathname === '/onboarding')
  await onboardingPage.getByRole('heading', { name: 'Crea tu negocio' }).waitFor()
  await onboardingContext.close()

  const demoContext = await browser.newContext()
  const demoPage = await demoContext.newPage()
  watchBrowserErrors(demoPage, browserErrors)
  await login(demoPage, 'demo@cashi.local', 'CashiDemo2026!')
  await demoPage.waitForURL(url => url.pathname === '/')
  await demoPage.getByText('Cashi Demo', { exact: true }).first().waitFor()

  const storedBusiness = await demoPage.evaluate(key => localStorage.getItem(key), activeBusinessKey)
  if (storedBusiness !== demoBusinessId) {
    throw new Error(`El negocio activo esperado era ${demoBusinessId}, se obtuvo ${storedBusiness}.`)
  }

  await demoPage.reload({ waitUntil: 'networkidle' })
  await demoPage.waitForURL(url => url.pathname === '/')

  await demoPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await demoPage.waitForURL(url => url.pathname === '/')

  await demoPage.evaluate(({ key, id }) => localStorage.setItem(key, id), {
    key: activeBusinessKey,
    id: foreignBusinessId,
  })
  // El negocio ajeno nunca se activa: RLS no lo devuelve y el store cae en la
  // primera membresía del usuario en vez de mandarlo a crear un negocio.
  await demoPage.reload({ waitUntil: 'networkidle' })
  await demoPage.waitForURL(url => url.pathname === '/')
  await demoPage.getByTestId('active-business-name').getByText('Cashi Demo', { exact: true }).waitFor()

  const recoveredBusiness = await demoPage.evaluate(key => localStorage.getItem(key), activeBusinessKey)
  if (recoveredBusiness !== demoBusinessId) {
    throw new Error(`El UUID manipulado no fue reemplazado por el negocio propio. Quedó: ${recoveredBusiness}`)
  }

  // Y no se filtró ni un dato del negocio ajeno.
  await demoPage.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const text = await demoPage.locator('[data-testid="inventory-count"]').innerText().catch(() => null)
    if (text?.includes('9 productos')) break
    if (attempt === 59) throw new Error(`El inventario no mostró los 9 productos del negocio propio: ${text}`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  await demoContext.close()

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log('PASS: sesión protegida, onboarding sin membresías y recuperación del negocio propio ante un UUID ajeno.')
} finally {
  await browser?.close()
  server.kill()
}
