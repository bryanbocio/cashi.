const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const calls = 100

async function requestCode(pool) {
  const client = await pool.connect()

  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    const result = await client.query(
      "select public.next_doc_code($1, 'SALE') as code",
      [businessId],
    )
    await client.query('commit')
    return result.rows[0].code
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  const pool = new Pool({ connectionString, max: 40 })
  let originalNextValue

  try {
    const original = await pool.query(
      "select next_value from public.doc_sequence where business_id = $1 and doc_type = 'SALE'",
      [businessId],
    )
    originalNextValue = original.rows[0]?.next_value

    await pool.query(
      "update public.doc_sequence set next_value = 1 where business_id = $1 and doc_type = 'SALE'",
      [businessId],
    )

    const codes = await Promise.all(
      Array.from({ length: calls }, () => requestCode(pool)),
    )
    const unique = new Set(codes)

    if (unique.size !== calls) {
      throw new Error(`Expected ${calls} unique codes, received ${unique.size}`)
    }

    const sorted = [...unique].sort()
    if (sorted[0] !== 'FAC-00001' || sorted.at(-1) !== 'FAC-00100') {
      throw new Error(`Unexpected range: ${sorted[0]} to ${sorted.at(-1)}`)
    }

    console.log(`PASS: ${calls} concurrent calls produced ${unique.size} unique codes (${sorted[0]}–${sorted.at(-1)}).`)
  } finally {
    if (originalNextValue !== undefined) {
      await pool.query(
        "update public.doc_sequence set next_value = $2 where business_id = $1 and doc_type = 'SALE'",
        [businessId, originalNextValue],
      )
    }
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
