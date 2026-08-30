import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3412
const baseUrl = `http://127.0.0.1:${port}`
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para probar la PWA.')

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/manifest.webmanifest`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('El preview no respondió a tiempo.')
}

let browser
try {
  await waitForServer()

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`)
  const manifest = await manifestResponse.json()
  if (manifest.name !== 'Cashi · Inventario y ganancias') throw new Error('El manifest no contiene el nombre esperado.')
  if (manifest.display !== 'standalone' || manifest.start_url !== '/') throw new Error('El manifest no es instalable como aplicación standalone.')
  if (!manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any')) throw new Error('Falta el icono PWA de 192 px.')
  if (!manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any')) throw new Error('Falta el icono PWA de 512 px.')
  if (!manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable')) throw new Error('Falta el icono maskable.')

  for (const path of ['/sw.js', '/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png']) {
    const response = await fetch(`${baseUrl}${path}`)
    if (!response.ok) throw new Error(`${path} respondió ${response.status}.`)
  }

  const worker = await (await fetch(`${baseUrl}/sw.js`)).text()
  if (!worker.includes('createHandlerBoundToURL("/")')) throw new Error('El service worker no apunta al shell SPA precargado.')
  if (!worker.includes('url:"/"')) throw new Error('El shell SPA no quedó incluido explícitamente en el precache.')
  if (/supabase|document-pdf|functions\/v1/i.test(worker)) throw new Error('El service worker no debe cachear rutas autenticadas o documentos.')

  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  if (manifestHref !== '/manifest.webmanifest') throw new Error('La aplicación no enlaza el web manifest.')

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Este navegador no admite service workers.')
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: 'networkidle' })
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  if (!controlled) throw new Error('El service worker no tomó control después de instalarse.')

  await context.setOffline(true)
  await page.locator('[data-testid="pwa-offline-guard"]').waitFor({ state: 'visible' })
  await context.setOffline(false)
  await page.locator('[data-testid="pwa-offline-guard"]').waitFor({ state: 'hidden' })

  await context.setOffline(true)
  const offlineResponse = await page.goto(`${baseUrl}/caja`, { waitUntil: 'domcontentloaded' })
  if (!offlineResponse?.fromServiceWorker()) throw new Error('La navegación sin red no fue atendida por el shell precargado.')
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 10_000 })

  console.log('PASS: manifest instalable, iconos, service worker, shell offline y bloqueo sin caché de Supabase.')
} finally {
  await browser?.close()
  server.kill()
}
