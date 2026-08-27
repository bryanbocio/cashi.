const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const productId = '50000000-0000-0000-0000-000000000003'
const calls = 40

async function createQuote(pool) {
  const client = await pool.connect()

  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    const result = await client.query(
      `select public.create_quote(
        $1, null, $2::jsonb, current_date + 7
      ) as quote`,
      [businessId, JSON.stringify([{ product_id: productId, qty: 1 }])],
    )
    await client.query('commit')
    return result.rows[0].quote
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

function quoteCode(value) {
  return `COT-${String(value).padStart(4, '0')}`
}

async function main() {
  const pool = new Pool({ connectionString, max: 40 })
  let originalNextValue
  let createdIds = []

  try {
    const original = await pool.query(
      `select next_value
       from public.doc_sequence
       where business_id = $1 and doc_type = 'QUOTE'`,
      [businessId],
    )
    originalNextValue = original.rows[0]?.next_value
    if (originalNextValue === undefined) throw new Error('Missing QUOTE document sequence.')

    const before = await pool.query(
      `select
        (select stock from public.product where id = $2) as stock,
        (select count(*)::integer from public.stock_movement where business_id = $1) as movements,
        (select count(*)::integer from public.sale where business_id = $1) as sales`,
      [businessId, productId],
    )

    const settled = await Promise.allSettled(
      Array.from({ length: calls }, () => createQuote(pool)),
    )
    const rejected = settled.filter(result => result.status === 'rejected')
    const quotes = settled
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
    createdIds = quotes.map(quote => quote.id)

    if (rejected.length) throw rejected[0].reason

    const codes = quotes.map(quote => quote.code)
    const uniqueCodes = new Set(codes)
    if (uniqueCodes.size !== calls) {
      throw new Error(`Expected ${calls} unique quote codes, received ${uniqueCodes.size}.`)
    }

    const sorted = [...uniqueCodes].sort()
    const expectedFirst = quoteCode(originalNextValue)
    const expectedLast = quoteCode(originalNextValue + calls - 1)
    if (sorted[0] !== expectedFirst || sorted.at(-1) !== expectedLast) {
      throw new Error(`Unexpected quote range: ${sorted[0]} to ${sorted.at(-1)}.`)
    }

    const persisted = await pool.query(
      `select count(*)::integer as quotes,
              (select count(*)::integer from public.quote_line where quote_id = any($1::uuid[])) as lines
       from public.quote where id = any($1::uuid[])`,
      [createdIds],
    )
    if (persisted.rows[0].quotes !== calls || persisted.rows[0].lines !== calls) {
      throw new Error(`Expected ${calls} quotes and lines, received ${persisted.rows[0].quotes} and ${persisted.rows[0].lines}.`)
    }

    const after = await pool.query(
      `select
        (select stock from public.product where id = $2) as stock,
        (select count(*)::integer from public.stock_movement where business_id = $1) as movements,
        (select count(*)::integer from public.sale where business_id = $1) as sales`,
      [businessId, productId],
    )
    const beforeState = before.rows[0]
    const afterState = after.rows[0]
    if (
      afterState.stock !== beforeState.stock ||
      afterState.movements !== beforeState.movements ||
      afterState.sales !== beforeState.sales
    ) {
      throw new Error('Concurrent quote creation changed stock, movements, or sales.')
    }

    console.log(
      `PASS: ${calls} concurrent quotes produced ${calls} unique codes (${expectedFirst}–${expectedLast}) without accounting effects.`,
    )
  } finally {
    if (createdIds.length) {
      await pool.query('delete from public.quote where id = any($1::uuid[])', [createdIds])
    }
    if (originalNextValue !== undefined) {
      await pool.query(
        `update public.doc_sequence
         set next_value = $2
         where business_id = $1 and doc_type = 'QUOTE'`,
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
