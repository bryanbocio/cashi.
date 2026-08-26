import { execFileSync, spawn } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Ajustes.')

const timestamp = Date.now()
const email = `f1.5-${timestamp}@cashi.local`
const password = `Cashi-${timestamp}!`
const newPassword = `Ajustes-${timestamp}!`
const initialBusinessName = `Negocio F1.5 ${timestamp}`
const updatedBusinessName = `Tienda Ajustes ${timestamp}`
const logoPath = join(tmpdir(), `cashi-f1.5-logo-${timestamp}.png`)
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII='
writeFileSync(logoPath, Buffer.from(pngBase64, 'base64'))

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

function verifySettings() {
  const query = `
    select
      (select count(*) from public.business b join auth.users u on u.id = b.created_by
        where u.email = '${email}' and b.name = '${updatedBusinessName}' and b.nit = 'F1-5001'
          and b.phone = '8095550150' and b.address = 'Calle Ajustes 15'
          and b.currency = 'DOP' and b.timezone = 'America/Santo_Domingo'
          and b.logo_path = b.id::text || '/logo.png'),
      (select count(*) from public.profile p join auth.users u on u.id = p.id
        where u.email = '${email}' and p.full_name = 'Usuario Ajustes F1.5' and p.phone = '8295550150'),
      (select count(*) from storage.objects o join public.business b on split_part(o.name, '/', 1) = b.id::text
        join auth.users u on u.id = b.created_by where u.email = '${email}' and o.bucket_id = 'logos');
  `
  const result = execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
  if (result !== '1|1|1') throw new Error(`Los ajustes no quedaron persistidos correctamente. Resultado: ${result}`)
}

function cleanupTestData() {
  const query = `
    set storage.allow_delete_query = 'true';
    delete from storage.objects
    where bucket_id = 'logos'
      and split_part(name, '/', 1) in (
        select b.id::text from public.business b join auth.users u on u.id = b.created_by where u.email = '${email}'
      );
    delete from public.business
    where created_by in (select id from auth.users where email = '${email}');
    delete from auth.users where email = '${email}';
  `
  execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', query,
  ], { stdio: 'ignore' })
}

let browser
let page
const browserErrors = []

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext()
  page = await context.newPage()
  watchBrowserErrors(page, browserErrors)
  const existingIds = new Set((await listMessages()).map(message => message.ID))

  await page.goto(`${baseUrl}/registro`, { waitUntil: 'networkidle' })
  await page.locator('#register-name').fill('Usuario Inicial F1.5')
  await page.locator('#register-email').fill(email)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirmation').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByRole('heading', { name: 'Revisa tu correo' }).waitFor()

  const confirmationMessage = await waitForMessage(email, existingIds)
  await page.goto(await getActionLink(confirmationMessage.ID), { waitUntil: 'networkidle' })
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/onboarding')

  await page.locator('#business-name').fill(initialBusinessName)
  await page.getByRole('button', { name: 'Crear negocio' }).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.goto(`${baseUrl}/ajustes`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()

  await page.locator('#settings-business-name').fill(updatedBusinessName)
  await page.locator('#settings-business-nit').fill('F1-5001')
  await page.locator('#settings-business-phone').fill('8095550150')
  await page.locator('#settings-business-address').fill('Calle Ajustes 15')
  await page.locator('#settings-business-currency').click()
  await page.getByRole('option', { name: 'Peso dominicano (DOP)' }).click()
  await page.locator('#settings-business-timezone').click()
  await page.getByRole('option', { name: 'Santo Domingo (America/Santo_Domingo)' }).click()
  await page.getByRole('button', { name: 'Guardar negocio' }).click()
  await page.getByText('Los datos del negocio fueron actualizados.').waitFor()
  await page.getByRole('button', { name: `Cambiar negocio. Activo: ${updatedBusinessName}` }).waitFor()

  await page.locator('input[type="file"]').setInputFiles(logoPath)
  await page.getByRole('button', { name: 'Subir logo' }).click()
  await page.getByText('El logo del negocio fue actualizado.').waitFor()
  await page.getByRole('img', { name: 'Logo del negocio' }).waitFor()

  await page.locator('#settings-account-name').fill('Usuario Ajustes F1.5')
  await page.locator('#settings-account-phone').fill('8295550150')
  await page.getByRole('button', { name: 'Guardar cuenta' }).click()
  await page.getByText('Los datos de tu cuenta fueron actualizados.').waitFor()

  await page.locator('#settings-password').fill(newPassword)
  await page.locator('#settings-password-confirmation').fill(newPassword)
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click()
  await page.getByText('Tu contraseña fue actualizada.').waitFor()

  verifySettings()

  await page.getByRole('button', { name: /Cambiar negocio\. Activo:/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(url => url.pathname === '/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(newPassword)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('button', { name: `Cambiar negocio. Activo: ${updatedBusinessName}` }).waitFor()

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: Ajustes actualizó negocio, logo privado, perfil y contraseña para ${email}.`)
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  rmSync(logoPath, { force: true })
  cleanupTestData()
}
