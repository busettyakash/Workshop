import 'dotenv/config'
import { query } from './src/lib/db.js'

async function verify() {
  const testWorkspace = 'e0969a3f-7c3a-4f3f-890c-e9656a8720b7'
  console.log('Testing newly created database tables...')

  try {
    // 1. Test opportunities
    console.log('1. Testing insert into opportunities...')
    const oppRes = await query(
      `INSERT INTO opportunities (name, stage, value, close_date, user_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      ['Test B2B Deal', 'Discovery', 150000.00, '2026-12-31', testWorkspace]
    )
    console.log('✅ Inserted opportunity:', oppRes.rows[0])

    console.log('Querying opportunities...')
    const qOpp = await query('SELECT * FROM opportunities WHERE user_id = $1', [testWorkspace])
    console.log(`✅ Queried opportunities (Found ${qOpp.rows.length} rows)`)

    console.log('Cleaning up opportunity...')
    await query('DELETE FROM opportunities WHERE id = $1', [oppRes.rows[0].id])
    console.log('✅ Cleanup complete')

    // 2. Test warehouses
    console.log('\n2. Testing insert into warehouses...')
    const whRes = await query(
      `INSERT INTO warehouses (name, location, user_id) 
       VALUES ($1, $2, $3) RETURNING *`,
      ['Main Bangalore Hub', 'Bangalore, India', testWorkspace]
    )
    console.log('✅ Inserted warehouse:', whRes.rows[0])

    console.log('Querying warehouses...')
    const qWh = await query('SELECT * FROM warehouses WHERE user_id = $1', [testWorkspace])
    console.log(`✅ Queried warehouses (Found ${qWh.rows.length} rows)`)

    console.log('Cleaning up warehouse...')
    await query('DELETE FROM warehouses WHERE id = $1', [whRes.rows[0].id])
    console.log('✅ Cleanup complete')

    console.log('\n🎉 ALL DATABASE TABLES SUCCESSFULLY VERIFIED!')
  } catch (err) {
    console.error('❌ Database verification failed:', err.message)
  }
}

verify()
