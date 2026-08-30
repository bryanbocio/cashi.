import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3440
const baseUrl = `http://localhost:${port}`
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de notificaciones.')

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

let browser

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill(`toast-${Date.now()}@example.com`)
  await page.locator('#login-password').fill('credencial-invalida')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  const toast = page.getByTestId('app-toast')
  await toast.waitFor({ state: 'visible', timeout: 10_000 })

  if (await toast.getAttribute('data-severity') !== 'error') {
    throw new Error('El error de autenticación no usó la variante visual de error.')
  }

  const toastText = await toast.innerText()
  if (!toastText.includes('No pudimos iniciar sesión')) {
    throw new Error(`El toast no mostró un resumen claro. Contenido: ${toastText}`)
  }

  const toastBox = await toast.boundingBox()
  if (!toastBox) throw new Error('No se pudo medir el toast móvil.')
  if (toastBox.x < 11 || toastBox.x + toastBox.width > 379) {
    throw new Error(`El toast desbordó el viewport móvil: ${JSON.stringify(toastBox)}`)
  }

  const closeButton = page.getByTestId('toast-close')
  const closeBox = await closeButton.boundingBox()
  if (!closeBox || closeBox.width < 44 || closeBox.height < 44) {
    throw new Error(`El botón de cierre no alcanza 44 × 44 px: ${JSON.stringify(closeBox)}`)
  }

  const copyFits = await toast.locator('.cashi-toast__copy').evaluate(element => (
    element.scrollWidth <= element.clientWidth
  ))
  if (!copyFits) throw new Error('El contenido del toast se desborda horizontalmente.')

  await closeButton.click()
  await toast.waitFor({ state: 'detached', timeout: 2_000 })

  console.log('Toast flow passed: layout móvil, jerarquía, área táctil y cierre verificados.')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
