const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const productId = '58900000-0000-0000-0000-000000000001'
const quoteId = '78900000-0000-0000-0000-000000000001'
const calls = 20

async function convertQuote(pool) {
  const client = await pool.connect()

  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    const result = await client.query(
      'select public.convert_quote($1, $2, null) as sale',
      [quoteId, 'CASH'],
    )
    await client.query('commit')
    return result.rows[0].sale
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

function saleCode(value) {
  return `FAC-${String(value).padStart(5, '0')}`
}

async function cleanup(pool) {
  const sales = await pool.query('select id from public.sale where quote_id = $1', [quoteId])
  const saleIds = sales.rows.map(row => row.id)
  if (saleIds.length) {
    await pool.query('delete from public.stock_movement where ref_id = any($1::uuid[])', [saleIds])
    await pool.query('delete from public.sale where id = any($1::uuid[])', [saleIds])
  }
  await pool.query('delete from public.quote where id = $1', [quoteId])
  await pool.query('delete from public.product where id = $1', [productId])
}

async function main() {
  const pool = new Pool({ connectionString, max: calls })
  let originalNextValue

  try {
    await cleanup(pool)

    const original = await pool.query(
      `select next_value
       from public.doc_sequence
       where business_id = $1 and doc_type = 'SALE'`,
      [businessId],
    )
    originalNextValue = original.rows[0]?.next_value
    if (originalNextValue === undefined) throw new Error('Missing SALE document sequence.')

    await pool.query(
      `insert into public.product (
        id, business_id, name, sku, cost, price, stock, min_stock
      ) values ($1, $2, 'Producto conversión concurrente', 'CONV-CONCURRENT-1', 600, 1000, 10, 1)`,
      [productId, businessId],
    )
    await pool.query(
      `insert into public.quote (
        id, business_id, code, valid_until, status, total
      ) values ($1, $2, 'COT-CONCURRENT', current_date + 7, 'OPEN', 3000)`,
      [quoteId, businessId],
    )
    await pool.query(
      `insert into public.quote_line (
        quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
      ) values ($1, $2, 'Producto conversión concurrente', 3, 1000, 600)`,
      [quoteId, productId],
    )

    const settled = await Promise.allSettled(
      Array.from({ length: calls }, () => convertQuote(pool)),
    )
    const rejected = settled.filter(result => result.status === 'rejected')
    if (rejected.length) throw rejected[0].reason

    const results = settled.map(result => result.value)
    const saleIds = new Set(results.map(result => result.id))
    const codes = new Set(results.map(result => result.code))
    if (saleIds.size !== 1 || codes.size !== 1) {
      throw new Error(`Expected one sale/code, received ${saleIds.size}/${codes.size}.`)
    }

    const expectedCode = saleCode(originalNextValue)
    if ([...codes][0] !== expectedCode) {
      throw new Error(`Expected ${expectedCode}, received ${[...codes][0]}.`)
    }

    const state = await pool.query(
      `select
        (select status::text from public.quote where id = $1) as quote_status,
        (select stock from public.product where id = $2) as stock,
        (select count(*)::integer from public.sale where quote_id = $1) as sales,
        (select count(*)::integer from public.sale_line sl join public.sale s on s.id = sl.sale_id where s.quote_id = $1) as lines,
        (select count(*)::integer from public.stock_movement sm join public.sale s on s.id = sm.ref_id where s.quote_id = $1 and sm.type = 'SALE') as movements,
        (select coalesce(sum(sm.qty_delta), 0)::integer from public.stock_movement sm join public.sale s on s.id = sm.ref_id where s.quote_id = $1 and sm.type = 'SALE') as moved_units,
        (select next_value from public.doc_sequence where business_id = $3 and doc_type = 'SALE') as next_value`,
      [quoteId, productId, businessId],
    )
    const row = state.rows[0]
    if (
      row.quote_status !== 'CONVERTED' ||
      row.stock !== 7 ||
      row.sales !== 1 ||
      row.lines !== 1 ||
      row.movements !== 1 ||
      row.moved_units !== -3 ||
      row.next_value !== originalNextValue + 1
    ) {
      throw new Error(`Unexpected conversion state: ${JSON.stringify(row)}.`)
    }

    console.log(
      `PASS: ${calls} conversiones simultáneas devolvieron ${expectedCode} y descontaron stock exactamente una vez.`,
    )
  } finally {
    await cleanup(pool)
    if (originalNextValue !== undefined) {
      await pool.query(
        `update public.doc_sequence
         set next_value = $2
         where business_id = $1 and doc_type = 'SALE'`,
        [businessId, originalNextValue],
      )
    }
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
