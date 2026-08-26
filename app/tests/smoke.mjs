import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3410
const baseUrl = `http://127.0.0.1:${port}`
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba visual.')

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('El servidor de preview no respondió a tiempo.')
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const browserErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  const privateRoutes = ['/', '/caja', '/cotizaciones', '/inventario', '/fiados', '/gastos', '/compras', '/reportes', '/ajustes']
  for (const route of privateRoutes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
    if (!response?.ok()) throw new Error(`La ruta ${route} respondió ${response?.status()}.`)
    await page.locator('h1').waitFor({ state: 'visible' })
  }

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  const drawer = page.locator('#mobile-navigation')
  await drawer.waitFor({ state: 'visible' })
  await page.mouse.click(382, 420)
  await drawer.waitFor({ state: 'hidden' })

  const publicRoutes = ['/login', '/registro', '/recuperar', '/nueva-contrasena', '/onboarding']
  for (const route of publicRoutes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
    if (!response?.ok()) throw new Error(`La ruta ${route} respondió ${response?.status()}.`)
    try {
      await page.locator('h1').waitFor({ state: 'visible' })
    } catch (error) {
      throw new Error(`La ruta ${route} no mostró su encabezado. Errores: ${browserErrors.join(' | ')}`, { cause: error })
    }
  }

  const hydrationErrors = browserErrors.filter(message => /hydration|mismatch/i.test(message))
  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)
  if (hydrationErrors.length) throw new Error(`Errores de hidratación:\n${hydrationErrors.join('\n')}`)

  console.log('PASS: 14 rutas cargan, el cajón móvil abre/cierra y no hay errores de consola o hidratación.')
} finally {
  await browser?.close()
  server.kill()
}
