import { query } from './src/lib/db.js';
async function run() {
  try {
    const uId = 'e0969a3f-7c3a-4f3f-890c-e9656a8720b7';
    const res = await query(`
      SELECT i.id, i.name, i.sku, i.stock as i_stock, i.status as i_status, p.stock as p_stock,
        CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock
      FROM import_stock i
      LEFT JOIN LATERAL (
        SELECT stock FROM products 
        WHERE user_id = i.user_id AND (sku = i.sku OR (i.sku IS NULL AND name = i.name))
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE i.user_id = $1
    `, [uId]);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  }
}
run();
