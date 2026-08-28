import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const port = 3430
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const accesoriosCategoryId = '30000000-0000-0000-0000-000000000003'
const centralSupplierId = '40000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de Inventario.')

// El producto de prueba nace con stock bajo (2 < 5) y margen estrecho (16,7 %)
// para ejercitar ambos filtros sin tocar los datos del seed.
const timestamp = Date.now()
const sku = `INV-${timestamp}`
const productName = `Producto Prueba ${timestamp}`

function psql(query, options = {}) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8', ...options }).trim()
}

function createFixture() {
  psql(`
    insert into public.product (business_id, name, sku, category_id, supplier_id, cost, price, stock, min_stock)
    values ('${demoBusinessId}', '${productName}', '${sku}', '${accesoriosCategoryId}', '${centralSupplierId}', 10000, 12000, 2, 5);
  `)
}

function cleanupFixture() {
  psql(`
    delete from public.stock_movement
    where product_id in (select id from public.product where sku = '${sku}');
    delete from public.product where sku = '${sku}';
  `)
}

function verifyPersisted() {
  const result = psql(`
    select
      (select count(*) from public.product
        where sku = '${sku}' and cost = 10000 and price = 20000 and min_stock = 5 and stock = 12),
      (select count(*) from public.stock_movement m join public.product p on p.id = m.product_id
        where p.sku = '${sku}' and m.type = 'ADJUST' and m.qty_delta = 10 and m.reason = 'Conteo físico');
  `)
  if (result !== '1|1') {
    throw new Error(`El inventario no quedó persistido correctamente. Resultado: ${result}`)
  }
}

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

async function waitForText(locator, expected, description) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text && text.includes(expected)) return text
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontré «${actual}».`)
}

let browser
let page
const browserErrors = []

try {
  createFixture()
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', error => browserErrors.push(error.message))

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  const count = page.locator('[data-testid="inventory-count"]')
  const inventoryTotal = page.locator('[data-testid="inventory-total-value"]')
  // El total se lee de la base, no se fija a mano: el negocio demo puede tener
  // ventas del usuario y la prueba debe seguir valiendo igual.
  const expectedTotal = Number(psql(`select coalesce(sum(cost * stock), 0)
    from public.product where business_id = '${demoBusinessId}' and active;`))
  const money = amount => new Intl.NumberFormat('es-CO').format(amount)

  // El seed trae 9 productos y el fixture suma uno más.
  await waitForText(count, '10 productos', 'Conteo inicial del inventario')
  await waitForText(inventoryTotal, money(expectedTotal), 'Valor total inicial del inventario')
  await page.locator(`[data-testid="row-${sku}"]`).waitFor()

  // Buscador: reduce la lista a un solo producto.
  await page.locator('#inventory-search').fill(sku)
  await waitForText(count, '1 producto', 'Conteo tras buscar por SKU')
  await waitForText(inventoryTotal, money(expectedTotal), 'El total no cambia con el buscador')
  await page.locator('#inventory-search').fill('')
  await waitForText(count, '10 productos', 'Conteo tras limpiar la búsqueda')

  // Filtro de stock bajo: CUI-002, ACC-003 y el fixture.
  await page.getByRole('button', { name: 'Stock bajo', exact: true }).click()
  await waitForText(count, '3 productos', 'Conteo con el filtro de stock bajo')
  await page.locator(`[data-testid="row-${sku}"]`).waitFor()

  // Filtro de margen bajo: ACC-004 del seed y el fixture.
  await page.getByRole('button', { name: 'Margen bajo', exact: true }).click()
  await waitForText(count, '2 productos', 'Conteo con el filtro de margen bajo')
  await page.locator(`[data-testid="row-${sku}"]`).waitFor()

  await page.getByRole('button', { name: 'Quitar filtros' }).click()
  await waitForText(count, '10 productos', 'Conteo tras quitar los filtros')

  // Panel lateral: margen y valor en vivo antes de guardar.
  await page.locator(`[data-testid="row-${sku}"]`).click()
  await page.locator('[data-testid="product-panel"]').waitFor()
  await waitForText(page.locator('[data-testid="panel-margin"]'), '16,7 %', 'Margen inicial del panel')

  await page.locator('#panel-price').fill('20000')
  await page.locator('#panel-price').blur()
  await waitForText(page.locator('[data-testid="panel-margin"]'), '50 %', 'Margen recalculado en vivo')

  // El nombre también se edita desde el panel.
  await page.locator('#panel-name').fill('Producto renombrado')

  await page.locator('[data-testid="panel-save"]').click()
  await page.getByText('El producto fue actualizado.').waitFor()

  const renamed = psql(`select name, price from public.product where sku = '${sku}';`)
  if (renamed !== 'Producto renombrado|20000') {
    throw new Error(`El panel no guardó nombre y precio juntos: ${renamed}`)
  }
  await waitForText(page.locator(`[data-testid="row-${sku}"]`), 'Producto renombrado', 'Nombre actualizado en la tabla')

  // Ajuste de existencias: el stock solo cambia por adjust_stock.
  await page.locator('#panel-delta').fill('10')
  await page.locator('#panel-delta').blur()
  await page.locator('[data-testid="panel-adjust"]').click()
  await page.getByText('Las existencias fueron ajustadas.').waitFor()
  await waitForText(page.locator('[data-testid="panel-stock"]'), '12', 'Stock tras el ajuste')
  // El ajuste suma 10 unidades del producto de prueba, que cuesta 10.000.
  await waitForText(inventoryTotal, money(expectedTotal + 100000), 'Valor total tras ajustar existencias')

  await page.keyboard.press('Escape')
  await page.locator('[data-testid="product-panel"]').waitFor({ state: 'hidden' })

  // La fila dejó de estar en stock bajo y con margen estrecho.
  await page.getByRole('button', { name: 'Stock bajo', exact: true }).click()
  await waitForText(count, '2 productos', 'Conteo de stock bajo tras el ajuste')
  await page.getByRole('button', { name: 'Margen bajo', exact: true }).click()
  await waitForText(count, '1 producto', 'Conteo de margen bajo tras guardar el precio')
  await page.getByRole('button', { name: 'Quitar filtros' }).click()

  verifyPersisted()

  // Versión móvil: tarjetas en lugar de tabla, con su botón de ancho completo.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#inventory-search').fill(sku)
  await waitForText(count, '1 producto', 'Conteo móvil tras buscar el producto')
  const card = page.locator(`[data-testid="card-${sku}"]`)
  await card.waitFor()
  const cardBox = await card.boundingBox()
  if (!cardBox || cardBox.height < 44) {
    throw new Error(`El botón de la tarjeta mide ${cardBox?.height ?? 0} px de alto y debe tener al menos 44.`)
  }
  await card.click()
  await page.locator('[data-testid="product-panel"]').waitFor()
  await waitForText(page.locator('[data-testid="panel-stock"]'), '12', 'Stock en la versión móvil')

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: Inventario mostró su valor completo, listó, filtró y editó ${sku}; el ajuste actualizó stock y total.`)
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  cleanupFixture()
}
