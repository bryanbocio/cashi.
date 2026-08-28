import { execFileSync, spawn } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const port = 3440
const baseUrl = `http://localhost:${port}`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const executablePath = browserCandidates.find(existsSync)

if (!executablePath) throw new Error('No se encontró Chrome o Edge para la prueba de alta e importación.')

const timestamp = Date.now()
const manualSku = `NEW-${timestamp}`
const importedSku = `CSV-${timestamp}`
const categoryName = `Categoría ${timestamp}`
const supplierName = `Proveedor ${timestamp}`
const csvPath = join(tmpdir(), `cashi-import-${timestamp}.csv`)

// Fila 2 válida, fila 3 con precio decimal: el resumen debe mostrar ambos casos.
writeFileSync(csvPath, [
  'sku;nombre;categoria;proveedor;costo;precio;stock;stock minimo',
  `${importedSku};Producto importado;${categoryName};${supplierName};10.000;25.000;9;2`,
  `${importedSku}-MAL;Producto con decimales;${categoryName};;1000;12,5;1;1`,
].join('\n'), 'utf8')

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

function cleanup() {
  psql(`
    delete from public.stock_movement where product_id in (
      select id from public.product where sku in ('${manualSku}', '${importedSku}', 'PER-003')
    );
    delete from public.product where sku in ('${manualSku}', '${importedSku}', 'PER-003');
    delete from public.category where business_id = '${demoBusinessId}' and name = '${categoryName}';
    delete from public.supplier where business_id = '${demoBusinessId}' and name = '${supplierName}';
  `)
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const text = await locator.innerText().catch(() => null)
    if (text && text.includes(expected)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const actual = await locator.innerText().catch(() => 'sin contenido')
  throw new Error(`${description}: esperaba «${expected}» y encontré «${actual}».`)
}

let browser
let page
const browserErrors = []

try {
  cleanup()
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  // La prueba del SKU repetido provoca a propósito un 409 del índice único, y
  // el navegador registra en consola toda petición fallida. Ese caso está
  // cubierto por la comprobación del mensaje en el formulario.
  const expectedConflict = /409 \(Conflict\)/
  page.on('console', message => {
    if (message.type() === 'error' && !expectedConflict.test(message.text())) browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-email').fill('demo@cashi.local')
  await page.locator('#login-password').fill('CashiDemo2026!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(url => url.pathname === '/')

  await page.goto(`${baseUrl}/inventario`, { waitUntil: 'networkidle' })
  const count = page.locator('[data-testid="inventory-count"]')
  await waitForText(count, '9 productos', 'Conteo inicial')

  // Alta manual, con una categoría y un proveedor que no existían.
  await page.locator('[data-testid="open-create"]').click()
  await page.locator('#product-sku').fill(manualSku)
  await page.locator('#product-name').fill('Producto creado a mano')
  await page.locator('#product-category input').fill(categoryName)
  await page.locator('#product-supplier input').fill(supplierName)
  await page.locator('#product-cost').fill('7000')
  await page.locator('#product-price').fill('14000')
  await page.locator('#product-stock').fill('5')
  await page.locator('#product-min-stock').fill('2')
  await page.locator('[data-testid="product-create-submit"]').click()

  await waitForText(count, '10 productos', 'Conteo tras el alta')
  const createdRow = psql(`
    select p.cost, p.price, p.stock, p.min_stock, c.name, s.name
    from public.product p
    left join public.category c on c.id = p.category_id
    left join public.supplier s on s.id = p.supplier_id
    where p.sku = '${manualSku}';
  `)
  if (createdRow !== `7000|14000|5|2|${categoryName}|${supplierName}`) {
    throw new Error(`El alta no guardó lo esperado: ${createdRow}`)
  }

  // Sin SKU se genera a partir del nombre, y la categoría elegida de la lista
  // se guarda por su nombre, no por su id.
  await page.locator('[data-testid="open-create"]').click()
  await page.locator('#product-name').fill('Perfume generado')
  // En un select editable el desplegable se abre con su flecha, no con el campo.
  await page.locator('#product-category .p-select-dropdown').click()
  await page.getByRole('option', { name: 'Perfumería', exact: true }).click()
  await page.locator('#product-cost').fill('3000')
  await page.locator('#product-price').fill('9000')
  await page.locator('#product-stock').fill('4')
  await page.locator('#product-min-stock').fill('1')
  await page.locator('[data-testid="product-create-submit"]').click()
  await waitForText(count, '11 productos', 'Conteo tras el alta sin SKU')

  const generated = psql(`
    select p.sku, c.name
    from public.product p left join public.category c on c.id = p.category_id
    where p.business_id = '${demoBusinessId}' and p.name = 'Perfume generado';
  `)
  // El seed ya tiene PER-001 y PER-002, así que el siguiente libre es PER-003.
  if (generated !== 'PER-003|Perfumería') {
    throw new Error(`El SKU automático o la categoría no son los esperados: ${generated}`)
  }
  // La tabla debe mostrar el nombre de la categoría, nunca su id.
  await page.locator('#inventory-search').fill('PER-003')
  await waitForText(count, '1 producto', 'Inventario filtrado por el SKU generado')
  await waitForText(page.locator('table'), 'Perfumería', 'Categoría en la tabla')
  await page.locator('#inventory-search').fill('')
  await waitForText(count, '11 productos', 'Inventario sin filtro')

  // El SKU repetido se avisa en el formulario, no con un error crudo.
  await page.locator('[data-testid="open-create"]').click()
  await page.locator('#product-sku').fill(manualSku)
  await page.locator('#product-name').fill('Duplicado')
  await page.locator('[data-testid="product-create-submit"]').click()
  await page.getByText('Ya existe un producto con este SKU.').waitFor()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // Importación: una fila válida y una con decimales.
  await page.locator('[data-testid="open-import"]').click()
  await page.locator('[data-testid="import-file"]').setInputFiles(csvPath)
  await page.locator('[data-testid="import-submit"]').click()
  await page.locator('[data-testid="import-result"]').waitFor()

  await waitForText(page.locator('[data-testid="import-created"]'), '1', 'Productos creados por el CSV')
  await waitForText(page.locator('[data-testid="import-errors-count"]'), '1', 'Filas con error del CSV')
  await page.getByText('El precio debe ser un número entero sin decimales.').waitFor()
  await page.getByText('3', { exact: true }).first().waitFor()

  await page.getByRole('button', { name: 'Cerrar' }).click()
  await waitForText(count, '12 productos', 'Conteo tras importar')

  const importedRow = psql(`
    select p.cost, p.price, p.stock, c.name, s.name
    from public.product p
    left join public.category c on c.id = p.category_id
    left join public.supplier s on s.id = p.supplier_id
    where p.sku = '${importedSku}';
  `)
  if (importedRow !== `10000|25000|9|${categoryName}|${supplierName}`) {
    throw new Error(`La importación no guardó lo esperado: ${importedRow}`)
  }

  // La categoría escrita en el alta se reutiliza, no se duplica.
  const facets = psql(`
    select
      (select count(*) from public.category where business_id = '${demoBusinessId}' and name = '${categoryName}'),
      (select count(*) from public.supplier where business_id = '${demoBusinessId}' and name = '${supplierName}');
  `)
  if (facets !== '1|1') throw new Error(`La categoría o el proveedor se duplicaron: ${facets}`)

  if (browserErrors.length) throw new Error(`Errores del navegador:\n${browserErrors.join('\n')}`)

  console.log(`PASS: alta manual de ${manualSku}, aviso de SKU repetido e importación de ${importedSku} con su resumen de errores.`)
} catch (error) {
  const pageText = await page?.locator('body').innerText().catch(() => '')
  console.error(`URL final: ${page?.url() ?? 'sin página'}\nErrores del navegador: ${browserErrors.join(' | ') || 'ninguno'}\nContenido: ${pageText?.slice(0, 3000)}`)
  throw error
} finally {
  await browser?.close()
  server.kill()
  rmSync(csvPath, { force: true })
  cleanup()
}
