import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3560
const baseUrl = `http://localhost:${port}`
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de sesión expirada.')

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

async function waitForUrl(page, matches, description, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (matches(new URL(page.url()))) return
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`${description}: la URL se quedó en ${page.url()}.`)
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')
}

/** Deja la sesión del navegador con el token vencido y un refresco inservible. */
async function breakSession(context) {
  const cookies = await context.cookies()
  const auth = cookies.find(cookie => cookie.name.endsWith('-auth-token'))
  if (!auth) throw new Error('No se encontró la cookie de sesión de Supabase.')

  const session = JSON.parse(Buffer.from(auth.value.replace('base64-', ''), 'base64').toString('utf8'))
  session.expires_at = Math.floor(Date.now() / 1000) - 3600
  session.expires_in = 0
  session.refresh_token = 'refresh-token-invalido'
  await context.addCookies([{
    ...auth,
    value: `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64')}`,
  }])
}

let browser
let page
const browserErrors = []

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })

  // --- Primera visita: login limpio, sin aviso de nada ---
  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const freshPage = await freshContext.newPage()
  await freshPage.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForUrl(freshPage, url => url.pathname === '/login', 'Visitante sin sesión')
  if (new URL(freshPage.url()).searchParams.get('expired')) {
    throw new Error('Quien nunca inició sesión no debe ver el aviso de sesión vencida.')
  }
  if (await freshPage.locator('[data-testid="login-notice"]').count()) {
    throw new Error('El login de una primera visita no debe mostrar aviso.')
  }
  await freshContext.close()

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  // --- Recarga con la sesión muerta: aviso y destino conservado ---
  await login(page)
  await breakSession(context)
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForUrl(page, url => url.searchParams.get('expired') === '1', 'Recarga con sesión vencida')
  if (new URL(page.url()).searchParams.get('redirect') !== '/inventario') {
    throw new Error(`El destino no se conservó: ${page.url()}`)
  }
  await page.locator('[data-testid="login-notice"]').waitFor()
  const notice = await page.locator('[data-testid="login-notice"]').innerText()
  if (!notice.includes('venció')) throw new Error(`El aviso dice «${notice}».`)

  // Volver a entrar devuelve a donde iba.
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/inventario')

  // --- El aviso se da una sola vez ---
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.context().clearCookies()
  await page.goto(`${baseUrl}/gastos`, { waitUntil: 'networkidle' })
  await waitForUrl(page, url => url.pathname === '/login', 'Segundo intento sin sesión')
  if (new URL(page.url()).searchParams.get('expired')) {
    throw new Error('La marca de sesión previa debe consumirse tras avisar una vez.')
  }

  // --- Cerrar sesión a propósito no es una expiración ---
  await login(page)
  await page.getByRole('button', { name: /Cambiar negocio/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(url => url.pathname === '/login')
  await new Promise(resolve => setTimeout(resolve, 1500))
  if (new URL(page.url()).searchParams.get('expired')) {
    throw new Error('Cerrar sesión a propósito no debe avisar de sesión vencida.')
  }
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await waitForUrl(page, url => url.pathname === '/login', 'Tras cerrar sesión')
  if (new URL(page.url()).searchParams.get('expired')) {
    throw new Error('Tras cerrar sesión a propósito la marca debe estar borrada.')
  }

  // --- La sesión se cae con la pestaña abierta ---
  // Supabase reintenta el refresco cada 30 s: el aviso llega sin recargar.
  await login(page)
  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  await breakSession(context)
  await waitForUrl(page, url => url.searchParams.get('expired') === '1', 'Sesión caída con la pestaña abierta', 90000)
  await page.locator('[data-testid="login-notice"]').waitFor()
  if (new URL(page.url()).searchParams.get('redirect') !== '/inventario') {
    throw new Error(`El destino no se conservó al caerse la sesión: ${page.url()}`)
  }

  console.log('PASS: la sesión vencida avisa al recargar y con la pestaña abierta, conserva el destino, se avisa una sola vez y no se confunde con cerrar sesión.')
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 2000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
}
