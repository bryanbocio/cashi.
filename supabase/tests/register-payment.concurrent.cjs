const { Pool } = require('pg')

const connectionString =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const businessId = '20000000-0000-0000-0000-000000000001'
const userId = '10000000-0000-0000-0000-000000000001'
const customerId = '99000000-0000-0000-0000-000000000001'
const saleId = '99100000-0000-0000-0000-000000000001'

async function registerPayment(pool, amount) {
  const client = await pool.connect()

  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)")
    const result = await client.query(
      "select public.register_payment($1, $2, $3, 'CASH') as payment",
      [businessId, customerId, amount],
    )
    await client.query('commit')
    return result.rows[0].payment
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function cleanup(pool) {
  await pool.query('delete from public.payment where customer_id = $1', [customerId])
  await pool.query('delete from public.sale where id = $1', [saleId])
  await pool.query('delete from public.customer where id = $1', [customerId])
}

async function main() {
  const pool = new Pool({ connectionString, max: 4 })

  try {
    await cleanup(pool)
    await pool.query(
      `insert into public.customer (id, business_id, name)
       values ($1, $2, 'Cliente concurrencia de abonos')`,
      [customerId, businessId],
    )
    await pool.query(
      `insert into public.sale (
         id, business_id, code, customer_id, payment_method, status,
         total, due_date, created_by
       ) values ($1, $2, 'CRED-CONCURRENT-001', $3, 'CREDIT', 'CONFIRMED', 1000, current_date + 7, $4)`,
      [saleId, businessId, customerId, userId],
    )

    const attempts = await Promise.allSettled([
      registerPayment(pool, 700),
      registerPayment(pool, 700),
    ])
    const accepted = attempts.filter(result => result.status === 'fulfilled')
    const rejected = attempts.filter(result => result.status === 'rejected')

    if (accepted.length !== 1 || rejected.length !== 1) {
      throw new Error(`Se esperaban 1 abono aceptado y 1 rechazado; llegaron ${accepted.length} y ${rejected.length}.`)
    }
    if (!rejected[0].reason.message.includes('El abono no puede superar la deuda pendiente.')) {
      throw rejected[0].reason
    }

    const afterRace = await pool.query(
      `select count(*)::integer as payments, coalesce(sum(amount), 0)::bigint as paid
       from public.payment where customer_id = $1`,
      [customerId],
    )
    if (afterRace.rows[0].payments !== 1 || afterRace.rows[0].paid !== '700') {
      throw new Error(`La carrera guardó ${afterRace.rows[0].payments} abonos por ${afterRace.rows[0].paid}; debía guardar uno por 700.`)
    }

    const finalPayment = await registerPayment(pool, 300)
    if (Number(finalPayment.debt) !== 0) {
      throw new Error(`El abono final dejó una deuda de ${finalPayment.debt}; debía dejarla en cero.`)
    }

    const debtors = await pool.query(
      'select count(*)::integer as total from public.v_credits where customer_id = $1',
      [customerId],
    )
    if (debtors.rows[0].total !== 0) {
      throw new Error('El cliente siguió apareciendo en v_credits después de pagar todo.')
    }

    let noDebtRejected = false
    try {
      await registerPayment(pool, 1)
    } catch (error) {
      noDebtRejected = error.message.includes('El cliente no tiene deuda pendiente.')
    }
    if (!noDebtRejected) {
      throw new Error('La RPC aceptó un abono después de dejar la deuda en cero.')
    }

    console.log('PASS: dos abonos simultáneos no sobrepagaron la deuda; solo uno entró y el pago final dejó el saldo exactamente en cero.')
  } finally {
    await cleanup(pool)
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
