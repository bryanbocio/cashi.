import { execFileSync } from 'node:child_process'

const apiUrl = process.env.SUPABASE_API_URL ?? 'http://127.0.0.1:54321'
const endpoint = `${apiUrl}/functions/v1/import-products`
const demoBusinessId = '20000000-0000-0000-0000-000000000001'
const foreignBusinessId = '20000000-0000-0000-0000-000000000010'

let failures = 0
function check(condition, description, detail = '') {
  if (condition) {
    console.log(`  ok   ${description}`)
  } else {
    failures += 1
    console.log(`  FALLA ${description}${detail ? `\n        ${detail}` : ''}`)
  }
}

function psql(query) {
  return execFileSync('docker', [
    'exec', 'supabase_db_cashi', 'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', '-c', query,
  ], { encoding: 'utf8' }).trim()
}

async function login(email, password) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  if (!body.access_token) throw new Error(`No se pudo iniciar sesión como ${email}: ${JSON.stringify(body)}`)
  return body.access_token
}

async function importCsv(token, businessId, csv) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ business_id: businessId, csv }),
  })
  return { status: response.status, body: await response.json() }
}

function cleanup() {
  psql(`
    delete from public.product where business_id = '${demoBusinessId}' and sku like 'IMP-%';
    delete from public.supplier where business_id = '${demoBusinessId}' and name = 'Aromas del Norte';
    delete from public.category where business_id = '${demoBusinessId}' and name = 'Hogar';
    update public.product set price = 79000, cost = 48000, min_stock = 4
      where business_id = '${demoBusinessId}' and sku = 'PER-001';
  `)
}

// Encabezados en español con acentos y punto y coma, como exporta Excel aquí.
// La fila 2 lleva comillas dobles escapadas y una coma dentro del nombre.
const csv = [
  'SKU;Nombre;Categoría;Proveedor;Costo;Precio;Stock;Stock mínimo',
  'IMP-001;"Difusor ""Aroma"", grande";Hogar;Aromas del Norte;10.000;18.000;7;3',
  'IMP-002;Vela aromática;Hogar;Aromas del Norte;5000;9000;12;4',
  'PER-001;Perfume Aurora 50 ml;Perfumería;Distribuciones Central;50.000;85.000;999;6',
  'IMP-003;;Hogar;;1000;2000;1;1',
  'IMP-004;Precio con decimales;Hogar;;1000;12,5;1;1',
  'IMP-001;Repetido en el archivo;Hogar;;1000;2000;1;1',
].join('\n')

try {
  cleanup()
  const token = await login('demo@cashi.local', 'CashiDemo2026!')

  console.log('Importación inicial')
  const first = await importCsv(token, demoBusinessId, csv)
  check(first.status === 200, 'responde 200', JSON.stringify(first.body))
  check(first.body.created === 2, 'crea los dos productos nuevos', `created=${first.body.created}`)
  check(first.body.updated === 1, 'actualiza el producto existente', `updated=${first.body.updated}`)
  check(first.body.stock_ignored === 1, 'informa el stock ignorado del existente', `stock_ignored=${first.body.stock_ignored}`)
  check(first.body.errors?.length === 3, 'reporta tres filas con error', JSON.stringify(first.body.errors))

  const errorRows = (first.body.errors ?? []).map(error => error.row)
  check(errorRows.join(',') === '5,6,7', 'los errores traen el número de fila real', errorRows.join(','))
  check(
    (first.body.errors ?? []).some(error => error.message.includes('nombre es obligatorio')),
    'detecta el nombre vacío',
  )
  check(
    (first.body.errors ?? []).some(error => error.message.includes('decimales')),
    'rechaza el precio con decimales',
  )
  check(
    (first.body.errors ?? []).some(error => error.message.includes('se repite')),
    'detecta el SKU repetido dentro del archivo',
  )

  console.log('Estado en la base')
  const created = psql(`
    select p.name, p.cost, p.price, p.stock, p.min_stock, c.name, s.name
    from public.product p
    left join public.category c on c.id = p.category_id
    left join public.supplier s on s.id = p.supplier_id
    where p.business_id = '${demoBusinessId}' and p.sku = 'IMP-001';
  `)
  check(
    created === 'Difusor "Aroma", grande|10000|18000|7|3|Hogar|Aromas del Norte',
    'el producto nuevo guarda comillas, coma y separadores de miles',
    created,
  )

  const updated = psql(`
    select price, cost, min_stock, stock from public.product
    where business_id = '${demoBusinessId}' and sku = 'PER-001';
  `)
  check(updated === '85000|50000|6|12', 'actualiza precio, costo y mínimo pero no el stock', updated)

  const facets = psql(`
    select
      (select count(*) from public.category where business_id = '${demoBusinessId}' and name = 'Hogar'),
      (select count(*) from public.supplier where business_id = '${demoBusinessId}' and name = 'Aromas del Norte'),
      (select count(*) from public.stock_movement where business_id = '${demoBusinessId}');
  `)
  check(facets === '1|1|0', 'crea la categoría y el proveedor sin escribir movimientos', facets)

  console.log('Segunda importación idéntica')
  const second = await importCsv(token, demoBusinessId, csv)
  check(second.body.created === 0, 'no vuelve a crear', `created=${second.body.created}`)
  check(second.body.updated === 3, 'actualiza los tres por SKU', `updated=${second.body.updated}`)

  const duplicates = psql(`
    select count(*) from public.category where business_id = '${demoBusinessId}' and name = 'Hogar';
  `)
  check(duplicates === '1', 'no duplica la categoría en la segunda pasada', duplicates)

  console.log('Validaciones de entrada')
  const noAuth = await importCsv(null, demoBusinessId, csv)
  check(noAuth.status === 401, 'sin sesión responde 401', String(noAuth.status))

  const otherToken = await login('other@cashi.local', 'CashiOther2026!')
  const foreign = await importCsv(otherToken, demoBusinessId, csv)
  check(foreign.status === 403, 'un usuario ajeno recibe 403', JSON.stringify(foreign.body))

  const ownForeign = await importCsv(otherToken, foreignBusinessId, 'sku,name\nAJENO-1,Producto ajeno\n')
  check(ownForeign.status === 200 && ownForeign.body.created === 1, 'cada quien importa en su negocio', JSON.stringify(ownForeign.body))
  psql(`delete from public.product where business_id = '${foreignBusinessId}' and sku = 'AJENO-1';`)

  const badHeaders = await importCsv(token, demoBusinessId, 'codigo_raro,otra\n1,2\n')
  check(badHeaders.status === 422, 'un archivo sin columnas obligatorias responde 422', JSON.stringify(badHeaders.body))

  const empty = await importCsv(token, demoBusinessId, '   ')
  check(empty.status === 400, 'un archivo vacío responde 400', String(empty.status))

  const noRows = await importCsv(token, demoBusinessId, 'sku,name\n')
  check(noRows.status === 422, 'un archivo con solo encabezados responde 422', String(noRows.status))

  if (failures) throw new Error(`${failures} comprobaciones fallaron.`)
  console.log('PASS: import-products creó, actualizó, reportó errores por fila y respetó el aislamiento.')
} finally {
  cleanup()
}
