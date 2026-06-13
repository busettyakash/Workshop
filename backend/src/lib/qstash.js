import { Client } from '@upstash/qstash'

console.log('[QSTASH] Initializing QStash Client...')
const qstash = new Client({
  token: process.env.QSTASH_TOKEN,
})

export default qstash
