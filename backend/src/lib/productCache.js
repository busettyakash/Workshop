import redis from './redis.js'
import pool from './db.js'

// In-Memory Fast Cache with TTL to minimize Redis and DB calls completely
const localCache = new Map()
const CACHE_TTL_MS = 120000 // 2 minutes in-memory TTL

export async function getProductHsnMap() {
  const now = Date.now()
  if (localCache.has('products') && (now - localCache.get('products').timestamp < CACHE_TTL_MS)) {
    return localCache.get('products').data
  }

  // Check Redis Cache
  try {
    const redisCached = await redis.get('catalog:products_hsn_map')
    if (redisCached) {
      const data = typeof redisCached === 'string' ? JSON.parse(redisCached) : redisCached
      localCache.set('products', { data, timestamp: now })
      return data
    }
  } catch (_e) { }

  // Single batch fetch from Postgres DB only if cache miss
  try {
    const { rows } = await pool.query('SELECT id, name, hsn_code, sku, unit, bag_weight FROM products')
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

export function enrichItemsWithCache(items, catalogMap = {}) {
  if (!Array.isArray(items)) return []
  return items.map((item, idx) => {
    let name = item.product_name || item.name || item.productName || item.title || ''
    let hsnCode = item.hsn_code || item.hsn || item.sku || ''
    if (hsnCode === '—' || hsnCode === '-') hsnCode = ''

    const pId = item.product_id || item.productId || item.id
    const cleanName = name ? name.toLowerCase().trim() : ''
    const normName = cleanName.replace(/[-_]/g, ' ')

    let catProd = null
    if (pId && catalogMap[String(pId)]) {
      catProd = catalogMap[String(pId)]
    } else if (cleanName && catalogMap[cleanName]) {
      catProd = catalogMap[cleanName]
    } else if (normName && catalogMap[normName]) {
      catProd = catalogMap[normName]
    } else if (cleanName) {
      const foundKey = Object.keys(catalogMap).find(k => {
        const kNorm = k.replace(/[-_]/g, ' ')
        return kNorm === normName || kNorm.includes(normName) || normName.includes(kNorm)
      })
      if (foundKey) catProd = catalogMap[foundKey]
    }

    if (catProd) {
      if (!name) name = catProd.name
      if (!hsnCode && catProd.hsn) hsnCode = catProd.hsn
    }

    if (!hsnCode && name) {
      if (catalogMap[cleanName] && catalogMap[cleanName].hsn) {
        hsnCode = catalogMap[cleanName].hsn
        if (!name) name = catalogMap[cleanName].name
      } else {
        const foundKey = Object.keys(catalogMap).find(k => k.includes(cleanName) || cleanName.includes(k))
        if (foundKey && catalogMap[foundKey].hsn) {
          hsnCode = catalogMap[foundKey].hsn
        }
      }
    }

    if (!hsnCode || hsnCode === '—') {
      const numericId = Number.parseInt(pId, 10) || (idx + 101)
      hsnCode = `1006${String(numericId).padStart(4, '0')}`
    }

    let bagWeight = Number.parseFloat(
      item.bag_weight ?? item.bagWeight ?? item.pack_weight ?? catProd?.bag_weight ?? 0
    )

    if (Number.isNaN(bagWeight) || bagWeight <= 0) {
      const weightMatch = name.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
      if (weightMatch && weightMatch[1]) {
        bagWeight = Number.parseFloat(weightMatch[1])
      } else {
        bagWeight = 1
      }
    }

    const rawUnit = item.unit || catProd?.unit || ''
    const unitStr = (bagWeight > 1)
      ? `Bag (${bagWeight}kg)`
      : (item.unitLabel || item.subtext || rawUnit || '')

    return {
      ...item,
      name: name || item.name || 'Product Item',
      product_name: name || item.name || 'Product Item',
      productName: name || item.name || 'Product Item',
      hsn_code: hsnCode,
      hsn: hsnCode,
      unit: rawUnit,
      bag_weight: bagWeight,
      bagWeight: bagWeight,
      pack_weight: bagWeight,
      unitLabel: unitStr,
      subtext: unitStr
    }
  })
}
