const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const calls = 40

// Dos productos por venta, en orden invertido según la venta, para forzar el
// escenario clásico de interbloqueo: si `create_sale` no fijara un orden de
// bloqueo, la mitad de las transacciones moriría con deadlock.
const productA = '50000000-0000-0000-0000-000000000001'
const productB = '50000000-0000-0000-0000-000000000003'

async function sell(pool, index) {
  const client = await pool.connect()
  const lines = index % 2 === 0
    ? [{ product_id: productA, qty: 1 }, { product_id: productB, qty: 2 }]
    : [{ product_id: productB, qty: 2 }, { product_id: productA, qty: 1 }]

  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    const result = await client.query(
      "select public.create_sale($1, null, 'CASH', 0, null, $2::jsonb) as sale",
      [businessId, JSON.stringify(lines)],
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

async function main() {
  const pool = new Pool({ connectionString, max: 40 })
  const createdSaleIds = []
  let originalNextValue
  let stockBefore

  try {
    const sequence = await pool.query(
      "select next_value from public.doc_sequence where business_id = $1 and doc_type = 'SALE'",
      [businessId],
    )
    originalNextValue = sequence.rows[0]?.next_value

    const stock = await pool.query(
      'select id, stock from public.product where id = any($1::uuid[]) order by id',
      [[productA, productB]],
    )
    stockBefore = Object.fromEntries(stock.rows.map(row => [row.id, row.stock]))

    const sales = await Promise.all(Array.from({ length: calls }, (_, index) => sell(pool, index)))
    createdSaleIds.push(...sales.map(sale => sale.id))

    const codes = new Set(sales.map(sale => sale.code))
    if (codes.size !== calls) {
      throw new Error(`Expected ${calls} unique codes, received ${codes.size}`)
    }

    const stockAfter = await pool.query(
      'select id, stock from public.product where id = any($1::uuid[]) order by id',
      [[productA, productB]],
    )

    for (const row of stockAfter.rows) {
      const sold = row.id === productA ? calls : calls * 2
      const expected = stockBefore[row.id] - sold
      if (row.stock !== expected) {
        throw new Error(`El stock de ${row.id} quedó en ${row.stock} y debía quedar en ${expected}.`)
      }
    }

    const movements = await pool.query(
      `select coalesce(sum(qty_delta), 0)::integer as total
       from public.stock_movement where ref_id = any($1::uuid[])`,
      [createdSaleIds],
    )
    const expectedDelta = -(calls * 3)
    if (movements.rows[0].total !== expectedDelta) {
      throw new Error(`Los movimientos suman ${movements.rows[0].total} y debían sumar ${expectedDelta}.`)
    }

    const lines = await pool.query(
      'select count(*)::integer as total from public.sale_line where sale_id = any($1::uuid[])',
      [createdSaleIds],
    )
    if (lines.rows[0].total !== calls * 2) {
      throw new Error(`Se guardaron ${lines.rows[0].total} líneas y debían ser ${calls * 2}.`)
    }

    console.log(`PASS: ${calls} ventas concurrentes sobre dos productos dejaron el stock exacto, ${codes.size} códigos únicos y ${expectedDelta} unidades en movimientos.`)
  } finally {
    if (createdSaleIds.length) {
      await pool.query('delete from public.stock_movement where ref_id = any($1::uuid[])', [createdSaleIds])
      await pool.query('delete from public.sale where id = any($1::uuid[])', [createdSaleIds])
    }
    if (stockBefore) {
      for (const [id, value] of Object.entries(stockBefore)) {
        await pool.query('update public.product set stock = $2 where id = $1', [id, value])
      }
    }
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
