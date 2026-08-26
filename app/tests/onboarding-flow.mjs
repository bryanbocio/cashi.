import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3000
const baseUrl = `http://localhost:${port}`
const mailpitUrl = 'http://127.0.0.1:54324'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de onboarding.')

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

async function listMessages() {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`)
  if (!response.ok) throw new Error(`Mailpit respondió ${response.status}.`)
  return (await response.json()).messages ?? []
}

async function waitForMessage(recipient, excludedIds) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const messages = await listMessages()
    const message = messages.find(item => (
      !excludedIds.has(item.ID)
      && item.To?.some(address => address.Address === recipient)
    ))
    if (message) return message
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`No llegó un correo para ${recipient}.`)
}

async function getActionLink(messageId) {
  const response = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`)
  if (!response.ok) throw new Error(`No se pudo leer el correo ${messageId}.`)
  const message = await response.json()
  const content = `${message.HTML ?? ''}\n${message.Text ?? ''}`.replaceAll('&amp;', '&')
  const links = content.match(/https?:\/\/[^\s"'<>]+/g) ?? []
  const actionLink = links.find(link => link.includes('/auth/v1/verify'))
  if (!actionLink) throw new Error(`El correo ${messageId} no contiene un enlace de autenticación.`)
  return actionLink
}

function watchBrowserErrors(page, browserErrors) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))
}

function verifyCreatedBusiness(businessId) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) throw new Error(`ID de negocio inválido: ${businessId}`)

  const query = `
    select
      (select count(*) from public.business where id = '${businessId}' and currency = 'DOP' and timezone = 'America/Santo_Domingo'),
      (select count(*) from public.membership where business_id = '${businessId}' and role = 'OWNER'),
      (select count(*) from public.category where business_id = '${businessId}' and name in ('Perfumería', 'Tienda de ropa')),
      (select count(*) from public.doc_sequence where business_id = '${businessId}' and doc_type in ('SALE', 'QUOTE', 'PURCHASE') and next_value = 1);
  `
  const result = execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()

  if (result !== '1|1|2|3') {
    throw new Error(`El negocio no quedó inicializado correctamente. Resultado: ${result}`)
  }
}

const timestamp = Date.now()
const email = `f1.3-${timestamp}@cashi.local`
const password = `Cashi-${timestamp}!`
const businessName = `Perfumería F1.3 ${timestamp}`
let browser

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const browserErrors = []
  const context = await browser.newContext()
  const page = await context.newPage()
  watchBrowserErrors(page, browserErrors)
  const existingIds = new Set((await listMessages()).map(message => message.ID))

  await page.goto(`${baseUrl}/registro`, { waitUntil: 'networkidle' })
  await page.locator('#register-name').fill('Prueba F1.3')
  await page.locator('#register-email').fill(email)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirmation').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByRole('heading', { name: 'Revisa tu correo' }).waitFor()

  const confirmationMessage = await waitForMessage(email, existingIds)
  const confirmationLink = await getActionLink(confirmationMessage.ID)
  await page.goto(confirmationLink, { waitUntil: 'networkidle' })
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')

  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/onboarding')

  await page.locator('#business-name').fill(businessName)
  await page.locator('#business-currency').click()
  await page.getByRole('option', { name: 'Peso dominicano (DOP)' }).click()
  await page.locator('#business-timezone').click()
  await page.getByRole('option', { name: 'Santo Domingo (America/Santo_Domingo)' }).click()
  await page.getByRole('button', { name: 'Crear negocio' }).click()

  await page.waitForURL(url => url.pathname === '/')
  await page.getByTestId('active-business-name').getByText(businessName, { exact: true }).waitFor()

  const businessId = await page.evaluate(() => localStorage.getItem('cashi.active-business-id'))
  if (!businessId) throw new Error('El negocio creado no quedó activo en el navegador.')
  verifyCreatedBusiness(businessId)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: onboarding creó y activó ${businessName} con OWNER, categorías y secuencias iniciales.`)
} finally {
  await browser?.close()
  server.kill()
}
