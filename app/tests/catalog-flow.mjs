import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3482
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba del catálogo.')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

psql(`update public.business set catalog_enabled = true where id = '${demoBusinessId}';`)
const catalogToken = psql(`select catalog_token from public.business where id = '${demoBusinessId}';`)

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, HOST: 'localhost', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput += chunk.toString() })
server.stderr.on('data', chunk => { serverOutput += chunk.toString() })

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`El servidor no respondió a tiempo.\n${serverOutput}`)
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })

  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const publicPage = await publicContext.newPage()
  await publicPage.goto(`${baseUrl}/catalogo/${catalogToken}`, { waitUntil: 'networkidle' })

  if (new URL(publicPage.url()).pathname !== `/catalogo/${catalogToken}`) {
    throw new Error(`El visitante anónimo fue redirigido a ${publicPage.url()}.`)
  }
  await publicPage.getByRole('heading', { name: 'Encuentra lo que buscas.' }).waitFor()
  await publicPage.getByText('Cashi Demo', { exact: true }).first().waitFor()
  const products = publicPage.locator('[data-testid="public-catalog-products"] article')
  if (await products.count() !== 9) throw new Error(`El catálogo debía mostrar 9 productos y mostró ${await products.count()}.`)
  await publicPage.getByText('Perfume Aurora 50 ml', { exact: true }).waitFor()
  await publicPage.getByText(/79,000\.00/).waitFor()
  if (await publicPage.getByText('PER-001', { exact: true }).count()) throw new Error('El catálogo expuso el SKU interno.')
  if (await publicPage.getByText(/48,000\.00/).count()) throw new Error('El catálogo expuso el costo del producto.')

  await publicPage.goto(`${baseUrl}/catalogo`, { waitUntil: 'networkidle' })
  await publicPage.waitForURL(url => url.pathname === '/login')
  await publicContext.close()

  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await ownerPage.locator('#login-email').fill('demo@cashi.local')
  await ownerPage.locator('#login-password').fill('CashiDemo2026!')
  await ownerPage.getByRole('button', { name: 'Ingresar' }).click()
  await ownerPage.waitForURL(url => url.pathname === '/')
  await ownerPage.goto(`${baseUrl}/catalogo`, { waitUntil: 'networkidle' })
  await ownerPage.locator('[data-testid="catalog-url"]').waitFor()
  const sharedUrl = await ownerPage.locator('[data-testid="catalog-url"]').inputValue()
  if (!sharedUrl.endsWith(`/catalogo/${catalogToken}`)) throw new Error(`Enlace público inesperado: ${sharedUrl}`)
  await ownerPage.getByRole('link', { name: 'Ver como cliente' }).waitFor()
  await ownerContext.close()

  console.log('PASS: el catálogo es público, muestra tarjetas con precio y mantiene privados costo y SKU.')
} finally {
  psql(`update public.business set catalog_enabled = true where id = '${demoBusinessId}';`)
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
