import express from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.use(requireAuth)

/**
 * GET /api/profit-margin
 * Calculates product procurement cost, active retail prices, unit margins, and inventory profit potentials.
 */
router.get(['/', '/profit-margins'], async (req, res) => {
  const userId = req.workspaceId

  try {
    const { rows } = await query(
      `SELECT 
        COALESCE(p.id, i.id) as id,
        COALESCE(p.name, i.name) as name,
        COALESCE(p.sku, i.sku, '—') as sku,
        COALESCE(p.category, i.category, 'Others') as category,
        COALESCE(p.unit, i.unit, 'kgs') as unit,
        COALESCE(p.stock, i.stock, 0) as stock,
        COALESCE(p.loose_kg, i.loose_kg, 0) as loose_kg,
        COALESCE(i.stock, p.stock, 0) as initial_full_stock,
        COALESCE(NULLIF(p.bag_weight, 1), NULLIF(i.bag_weight, 1), p.bag_weight, i.bag_weight, 1) as bag_weight,
        COALESCE(NULLIF(p.price_covers, 1), NULLIF(i.price_covers, 1), p.price_covers, i.price_covers, 1) as price_covers,
        COALESCE(i.buying_price, 0) as buyer_price,
        COALESCE(NULLIF(p.updated_price, 0), NULLIF(p.price, 0), NULLIF(i.updated_price, 0), NULLIF(i.price, 0), 0) as seller_price,
        COALESCE(p.updated_price, i.updated_price, 0) as updated_price,
        COALESCE(p.price, i.price, 0) as base_price,
        COALESCE(i.buyer_name, '—') as buyer_name
       FROM products p
       FULL OUTER JOIN import_stock i 
         ON (LOWER(TRIM(p.name)) = LOWER(TRIM(i.name)) 
             AND (p.user_id::text = i.user_id::text OR p.user_id = 'default-user' OR i.user_id = 'default-user'))
       WHERE (p.user_id::text = $1::text OR p.user_id = 'default-user' OR $1 = 'default-user' 
              OR i.user_id::text = $1::text OR i.user_id = 'default-user')
         AND (p.name IS NOT NULL OR i.name IS NOT NULL)
       ORDER BY COALESCE(p.name, i.name) ASC`,
      [userId]
    )

    const processed = rows.map(r => {
      const buyerPrice = Number.parseFloat(r.buyer_price) || 0
      const sellerPrice = Number.parseFloat(r.seller_price) || 0
      const stock = Number.parseFloat(r.stock) || 0
      const looseKg = Number.parseFloat(r.loose_kg) || 0
      const bw = Number.parseFloat(r.bag_weight) || 1
      const pc = Number.parseFloat(r.price_covers) || 1

      let buyRatePerUnit = 0
      if (buyerPrice > 0) {
        if (pc > 0) buyRatePerUnit = buyerPrice / pc
        else if (bw > 0) buyRatePerUnit = buyerPrice / bw
        else buyRatePerUnit = buyerPrice
      }

      let sellRatePerUnit = 0
      if (sellerPrice > 0) {
        if (bw > 0) sellRatePerUnit = sellerPrice / bw
        else if (pc > 0) sellRatePerUnit = sellerPrice / pc
        else sellRatePerUnit = sellerPrice
      }

      let marginPerUnit = 0
      let marginPct = 0

      if (buyRatePerUnit > 0 && sellRatePerUnit > 0) {
        marginPerUnit = sellRatePerUnit - buyRatePerUnit
        marginPct = sellRatePerUnit > 0 ? (marginPerUnit / sellRatePerUnit) * 100 : 0
      } else if (buyerPrice > 0 && sellerPrice > 0) {
        marginPerUnit = sellerPrice - buyerPrice
        marginPct = sellerPrice > 0 ? (marginPerUnit / sellerPrice) * 100 : 0
      }

      // Present stock remaining (reduces as sales happen in Billing)
      const fullBagUnits = stock * (bw > 1 ? bw : 1)
      const presentUnits = fullBagUnits + looseKg
      const presentProfit = Math.round(marginPerUnit * presentUnits)

      // Full stock imported lot (initial total batch)
      const fullLotStock = Number.parseFloat(r.initial_full_stock) || stock
      const fullUnits = fullLotStock * (bw > 1 ? bw : 1)
      const fullStockProfit = Math.round(marginPerUnit * fullUnits)

      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        category: r.category,
        unit: r.unit,
        stock,
        loose_kg: looseKg,
        bag_weight: bw,
        price_covers: pc,
        buyer_price: buyerPrice,
        seller_price: sellerPrice,
        buy_rate_per_unit: Number(buyRatePerUnit.toFixed(2)),
        sell_rate_per_unit: Number(sellRatePerUnit.toFixed(2)),
        margin_per_unit: Number(marginPerUnit.toFixed(2)),
        margin_pct: Number(marginPct.toFixed(1)),
        present_units: presentUnits,
        present_profit: presentProfit,
        full_lot_stock: fullLotStock,
        full_units: fullUnits,
        full_stock_profit: fullStockProfit,
        total_units_in_stock: presentUnits,
        total_potential_profit: presentProfit,
        buyer_name: r.buyer_name,
        is_loss: marginPerUnit < 0
      }
    })

    res.json(processed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
