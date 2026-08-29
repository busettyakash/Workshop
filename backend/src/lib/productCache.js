import redis from './redis.js'
import pool from './db.js'

// In-Memory Fast Cache with TTL to minimize Redis and DB calls completely
const localCache = new Map()
const CACHE_TTL_MS = 120000 // 2 minutes in-memory TTL

function buildProductMap(rows) {
  const map = {}
  for (const p of rows) {
    const hsn = p.hsn_code || p.sku || `1006${String(p.id || 1000).padStart(4, '0')}`
    const bw = Number.parseFloat(p.bag_weight || 1)
    const pData = { hsn, name: p.name, unit: p.unit, bag_weight: bw }
    if (p.id) map[String(p.id)] = pData
    if (p.name) {
      const clean = p.name.toLowerCase().trim()
      const norm = clean.replace(/[-_]/g, ' ')
      map[clean] = pData
      map[norm] = pData
    }
  }
  return map
}

async function getCachedRedisMap() {
  try {
    const redisCached = await redis.get('catalog:products_hsn_map')
    if (redisCached) {
      return typeof redisCached === 'string' ? JSON.parse(redisCached) : redisCached
    }
  } catch { }
  return null
}

export async function getProductHsnMap() {
  const now = Date.now()
  if (localCache.has('products') && (now - localCache.get('products').timestamp < CACHE_TTL_MS)) {
    return localCache.get('products').data
  }

  // Check Redis Cache
  const redisMap = await getCachedRedisMap()
  if (redisMap) {
    localCache.set('products', { data: redisMap, timestamp: now })
    return redisMap
  }

  // Single batch fetch from Postgres DB only if cache miss
  try {
    const { rows } = await pool.query('SELECT id, name, hsn_code, sku, unit, bag_weight FROM products')
    const map = buildProductMap(rows)

    // Save to Redis and Local Memory
    redis.set('catalog:products_hsn_map', JSON.stringify(map), { ex: 300 }).catch(() => { })
    localCache.set('products', { data: map, timestamp: now })
    return map
  } catch (err) {
    console.error('[Catalog HSN Map Error]', err.message)
    return {}
  }
}

export function clearProductHsnCache() {
  localCache.delete('products')
  redis.del('catalog:products_hsn_map').catch(() => { })
}

function findCatalogProduct(catalogMap, pId, cleanName, normName) {
  if (pId && catalogMap[String(pId)]) return catalogMap[String(pId)]
  if (cleanName && catalogMap[cleanName]) return catalogMap[cleanName]
  if (normName && catalogMap[normName]) return catalogMap[normName]
  if (!cleanName) return null

  const foundKey = Object.keys(catalogMap).find(k => {
    const kNorm = k.replace(/[-_]/g, ' ')
    return kNorm === normName || kNorm.includes(normName) || normName.includes(kNorm)
  })
  return foundKey ? catalogMap[foundKey] : null
}

function resolveHsnCode(rawHsn, catProd, catalogMap, cleanName, pId, idx) {
  let hsnCode = rawHsn
  if (hsnCode === '—' || hsnCode === '-') hsnCode = ''
  if (!hsnCode && catProd?.hsn) hsnCode = catProd.hsn

  if (!hsnCode && cleanName) {
    if (catalogMap[cleanName]?.hsn) {
      hsnCode = catalogMap[cleanName].hsn
    } else {
      const foundKey = Object.keys(catalogMap).find(k => k.includes(cleanName) || cleanName.includes(k))
      if (foundKey && catalogMap[foundKey]?.hsn) {
        hsnCode = catalogMap[foundKey].hsn
      }
    }
  }

  if (!hsnCode || hsnCode === '—') {
    const numericId = Number.parseInt(pId, 10) || (idx + 101)
    hsnCode = `1006${String(numericId).padStart(4, '0')}`
  }
  return hsnCode
}

function resolveBagWeight(item, catProd, name) {
  let bagWeight = Number.parseFloat(
    item.bag_weight ?? item.bagWeight ?? item.pack_weight ?? catProd?.bag_weight ?? 0
  )

  if (Number.isNaN(bagWeight) || bagWeight <= 0) {
    const weightMatch = name.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
    bagWeight = (weightMatch && weightMatch[1]) ? Number.parseFloat(weightMatch[1]) : 1
  }
  return bagWeight
}

export function enrichItemsWithCache(items, catalogMap = {}) {
  if (!Array.isArray(items)) return []

  return items.map((item, idx) => {
    const rawName = item.product_name || item.name || item.productName || item.title || ''
    const pId = item.product_id || item.productId || item.id
    const cleanName = rawName ? rawName.toLowerCase().trim() : ''
    const normName = cleanName.replace(/[-_]/g, ' ')

    const catProd = findCatalogProduct(catalogMap, pId, cleanName, normName)
    const name = rawName || catProd?.name || 'Product Item'
    const hsnCode = resolveHsnCode(item.hsn_code || item.hsn || item.sku || '', catProd, catalogMap, cleanName, pId, idx)
    const bagWeight = resolveBagWeight(item, catProd, name)
    const rawUnit = item.unit || catProd?.unit || ''

    const unitStr = (bagWeight > 1)
      ? `Bag (${bagWeight}kg)`
      : (item.unitLabel || item.subtext || rawUnit || '')

    return {
      ...item,
      name,
      product_name: name,
      productName: name,
      hsn_code: hsnCode,
      hsn: hsnCode,
      unit: rawUnit,
      bag_weight: bagWeight,
      bagWeight,
      pack_weight: bagWeight,
      packWeight: bagWeight,
      unitLabel: unitStr,
      subtext: unitStr
    }
  })
}
