import { query } from './src/lib/db.js'

async function check() {
  const sql = `
    SELECT 
      p.id, 
      p.name, 
      p.unit, 
      p.bag_weight,
      SUM(bi.quantity) as raw_units,
      SUM(CASE WHEN p.bag_weight > 1 AND bi.price >= p.price * 0.5 THEN bi.quantity ELSE 0 END) as sold_bags,
      SUM(CASE WHEN p.bag_weight > 1 AND bi.price < p.price * 0.5 THEN bi.quantity ELSE 0 END) as sold_loose_kg,
      SUM(CASE 
        WHEN p.bag_weight > 1 AND bi.price >= p.price * 0.5 THEN bi.quantity * p.bag_weight 
        WHEN p.bag_weight > 1 AND bi.price < p.price * 0.5 THEN bi.quantity 
        ELSE bi.quantity 
      END) as total_weight_kg
    FROM bill_items bi 
    JOIN products p ON bi.product_id = p.id 
    WHERE p.category = 'Grains' 
    GROUP BY p.id, p.name, p.unit, p.bag_weight, p.price
  `
  const res = await query(sql)
  console.table(res.rows)
  process.exit(0)
}

check().catch(console.error)
