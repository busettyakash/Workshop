import 'dotenv/config'
import dns from 'dns'
dns.setServers(['8.8.8.8', '8.8.4.4'])
import pg from 'pg'

const { Pool } = pg
const dbUrl = process.env.DATABASE_URL
console.log('DATABASE_URL:', dbUrl)

const originalLookup = dns.lookup
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return originalLookup(hostname, options, callback)
  }
  console.log(`[dns.lookup] Intercepted hostname=${hostname} options=${JSON.stringify(options)}`)
  dns.resolve4(hostname, (err, addresses) => {
    console.log(`[dns.lookup] resolve4 result: hostname=${hostname} err=${err ? err.message : null} addresses=${JSON.stringify(addresses)}`)
    if (err || !addresses || addresses.length === 0) {
      console.log(`[dns.lookup] falling back to originalLookup`)
      return originalLookup(hostname, options, callback)
    }
    if (options.all) {
      const results = addresses.map(addr => ({ address: addr, family: 4 }))
      console.log(`[dns.lookup] returning all addresses=${JSON.stringify(results)}`)
      callback(null, results)
    } else {
      console.log(`[dns.lookup] returning address=${addresses[0]}`)
      callback(null, addresses[0], 4)
    }
  })
}

async function testWithSSL() {
  console.log('\n--- Testing connection WITH SSL { rejectUnauthorized: false } ---')
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  })
  try {
    const res = await pool.query('SELECT NOW()')
    console.log('✅ Success! Server time:', res.rows[0].now)
  } catch (err) {
    console.error('❌ Failed:', err.message)
  } finally {
    await pool.end()
  }
}

async function testWithoutSSL() {
  console.log('\n--- Testing connection WITHOUT SSL ---')
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: false
  })
  try {
    const res = await pool.query('SELECT NOW()')
    console.log('✅ Success! Server time:', res.rows[0].now)
  } catch (err) {
    console.error('❌ Failed:', err.message)
  } finally {
    await pool.end()
  }
}

async function run() {
  await testWithSSL()
  await testWithoutSSL()
}

run()
