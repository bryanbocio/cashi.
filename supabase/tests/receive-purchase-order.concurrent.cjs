const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const orderId = '92200000-0000-0000-0000-000000000001'
const productA = '50000000-0000-0000-0000-000000000001'
const productB = '50000000-0000-0000-0000-000000000003'

async function receive(pool) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    await client.query('select public.receive_purchase_order($1)', [orderId])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function cleanup(pool, before = null) {
  await pool.query('delete from public.stock_movement where ref_id = $1', [orderId])
  await pool.query('delete from public.purchase_order where id = $1', [orderId])
  if (before) {
    for (const row of before) {
      await pool.query('update public.product set stock = $2, cost = $3 where id = $1', [row.id, row.stock, row.cost])
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString, max: 12 })
  let before

  try {
    before = (await pool.query(
      'select id, stock, cost from public.product where id = any($1::uuid[]) order by id',
      [[productA, productB]],
    )).rows
    await cleanup(pool)

    await pool.query(
      `insert into public.purchase_order (id, business_id, code)
       values ($1, $2, 'OC-CONCURRENT-001')`,
      [orderId, businessId],
    )
    await pool.query(
      `insert into public.purchase_line (purchase_order_id, product_id, qty, unit_cost)
       values ($1, $2, 5, 53000), ($1, $3, 7, 21000)`,
      [orderId, productA, productB],
    )

    await Promise.all(Array.from({ length: 10 }, () => receive(pool)))

    const after = (await pool.query(
      'select id, stock, cost from public.product where id = any($1::uuid[]) order by id',
      [[productA, productB]],
    )).rows
    const original = Object.fromEntries(before.map(row => [row.id, row]))
    const expected = {
      [productA]: { qty: 5, cost: '53000' },
      [productB]: { qty: 7, cost: '21000' },
    }

    for (const row of after) {
      if (row.stock !== original[row.id].stock + expected[row.id].qty || row.cost !== expected[row.id].cost) {
        throw new Error(`El producto ${row.id} quedó con stock ${row.stock} y costo ${row.cost}; la orden se aplicó más de una vez o incompleta.`)
      }
    }

    const audit = (await pool.query(
      `select po.status, po.received_at is not null as stamped,
        count(m.id)::integer as movements,
        coalesce(sum(m.qty_delta), 0)::integer as units
       from public.purchase_order po
       left join public.stock_movement m on m.ref_id = po.id and m.type = 'PURCHASE'
       where po.id = $1
       group by po.status, po.received_at`,
      [orderId],
    )).rows[0]

    if (!audit || audit.status !== 'RECEIVED' || !audit.stamped || audit.movements !== 2 || audit.units !== 12) {
      throw new Error(`La auditoría concurrente no cuadró: ${JSON.stringify(audit)}`)
    }

    console.log('PASS: 10 recepciones simultáneas aplicaron stock, costos y movimientos exactamente una vez.')
  } finally {
    await cleanup(pool, before)
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
