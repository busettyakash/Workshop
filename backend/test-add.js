import { query } from './src/lib/db.js';

async function test() {
  try {
    const res = await query(
      "INSERT INTO import_stock (name, sku, price, stock, status, user_id) VALUES ('Test Item', 'SKU-001', 50.00, 150, 'active', 'dbf83c13-a442-4f10-aeec-7f28dc2c1a82') RETURNING *"
    );
    console.log('Imported:', res.rows[0]);
    const item = res.rows[0];
    
    const pRes = await query(
      "INSERT INTO products (name, sku, price, stock, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *", 
      [item.name, item.sku, item.price, item.stock, item.user_id]
    );
    console.log('Added to products:', pRes.rows[0]);
  } catch (err) {
    console.error(err);
  }
}
test();
