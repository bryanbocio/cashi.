import { spawn } from 'node:child_process'
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

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de autenticación.')

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

async function waitForMessage(recipient, excludedIds = new Set()) {
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

const timestamp = Date.now()
const email = `f1.1-${timestamp}@cashi.local`
const password = `Cashi-${timestamp}!`
const newPassword = `Nuevo-${timestamp}!`
let browser

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const browserErrors = []

  const signupContext = await browser.newContext()
  const signupPage = await signupContext.newPage()
  watchBrowserErrors(signupPage, browserErrors)

  await signupPage.goto(`${baseUrl}/registro`, { waitUntil: 'networkidle' })
  await signupPage.locator('#register-name').fill('Prueba F1.1')
  await signupPage.locator('#register-email').fill(email)
  await signupPage.locator('#register-password').fill(password)
  await signupPage.locator('#register-confirmation').fill(password)
  await signupPage.getByRole('button', { name: 'Crear cuenta' }).click()
  await signupPage.getByRole('heading', { name: 'Revisa tu correo' }).waitFor()

  const confirmationMessage = await waitForMessage(email)
  const confirmationLink = await getActionLink(confirmationMessage.ID)
  await signupPage.goto(confirmationLink, { waitUntil: 'networkidle' })
  await signupPage.waitForURL(url => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')

  await signupPage.locator('#login-email').fill(email)
  await signupPage.locator('#login-password').fill(password)
  await signupPage.getByRole('button', { name: 'Ingresar' }).click()
  await signupPage.waitForURL(url => url.pathname === '/')

  const cookiesBeforeReload = await signupContext.cookies()
  if (!cookiesBeforeReload.some(cookie => cookie.name.includes('auth-token'))) {
    throw new Error('El login no creó la cookie de sesión de Supabase.')
  }
  await signupPage.reload({ waitUntil: 'networkidle' })
  const cookiesAfterReload = await signupContext.cookies()
  if (!cookiesAfterReload.some(cookie => cookie.name.includes('auth-token'))) {
    throw new Error('La sesión no persistió después de recargar.')
  }
  await signupContext.close()

  const recoveryContext = await browser.newContext()
  const recoveryPage = await recoveryContext.newPage()
  watchBrowserErrors(recoveryPage, browserErrors)
  const existingIds = new Set((await listMessages()).map(message => message.ID))

  await recoveryPage.goto(`${baseUrl}/recuperar`, { waitUntil: 'networkidle' })
  await recoveryPage.locator('#recovery-email').fill(email)
  await recoveryPage.getByRole('button', { name: 'Enviar enlace' }).click()
  await recoveryPage.getByText('recibirás las instrucciones').waitFor()

  const recoveryMessage = await waitForMessage(email, existingIds)
  const recoveryLink = await getActionLink(recoveryMessage.ID)
  await recoveryPage.goto(recoveryLink, { waitUntil: 'networkidle' })
  await recoveryPage.waitForURL(url => url.pathname === '/nueva-contrasena')
  await recoveryPage.locator('#new-password').waitFor({ state: 'visible' })
  await recoveryPage.locator('#new-password').fill(newPassword)
  await recoveryPage.locator('#new-password-confirmation').fill(newPassword)
  await recoveryPage.getByRole('button', { name: 'Guardar contraseña' }).click()
  await recoveryPage.waitForURL(url => url.pathname === '/login' && url.searchParams.get('recovered') === '1')

  await recoveryPage.locator('#login-email').fill(email)
  await recoveryPage.locator('#login-password').fill(newPassword)
  await recoveryPage.getByRole('button', { name: 'Ingresar' }).click()
  await recoveryPage.waitForURL(url => url.pathname === '/')
  await recoveryContext.close()

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: registro, confirmación, login persistente y recuperación completados para ${email}.`)
} finally {
  await browser?.close()
  server.kill()
}
