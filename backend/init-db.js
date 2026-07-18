process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import 'dotenv/config';

import pg from 'pg';

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function createTables() {
  console.log('Connecting to InsForge Database to initialize tables...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_profiles (
        user_id UUID PRIMARY KEY,
        shop_name VARCHAR(255),
        phone VARCHAR(50),
        gstin VARCHAR(20),
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        category VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        stock INT DEFAULT 0,
        unit VARCHAR(50) DEFAULT 'pcs',
        status VARCHAR(50) DEFAULT 'active',
        description TEXT,
        bag_weight NUMERIC DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS bag_weight NUMERIC DEFAULT 1;

      CREATE TABLE IF NOT EXISTS import_stock (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        category VARCHAR(100),
        price DECIMAL(10, 2),
        stock INT DEFAULT 0,
        unit VARCHAR(50) DEFAULT 'pcs',
        status VARCHAR(50) DEFAULT 'pending',
        description TEXT,
        bag_weight NUMERIC DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS bag_weight NUMERIC DEFAULT 1;

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        gst_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id TEXT;

      CREATE TABLE IF NOT EXISTS people (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT,
        phone        TEXT,
        persona      TEXT DEFAULT 'Lead',
        status       TEXT DEFAULT 'active',
        notes        TEXT,
        user_id      TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES people(id) ON DELETE SET NULL,
        items JSONB,
        amount DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'unpaid',
        due_date DATE,
        notes TEXT,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS user_id TEXT;

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        type VARCHAR(50) DEFAULT 'info',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_live BOOLEAN DEFAULT true,
        nodes JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id SERIAL PRIMARY KEY,
        workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'Executing',
        duration VARCHAR(50),
        test_company VARCHAR(255),
        test_value DECIMAL(12, 2),
        current_step INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        conversation_id VARCHAR(100) UNIQUE,
        title VARCHAR(255),
        messages JSONB DEFAULT '[]'::jsonb,
        last_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation_id ON chat_sessions(conversation_id);
    `);
    console.log('All database tables created successfully!');

    // ── Enforce RLS on all tables with user isolation ──
    const allTables = [
      'bill_items', 'companies', 'deals', 'shop_profiles', 'bill_templates', 'deal_logs', 'workspace_members',
      'products', 'import_stock', 'customers', 'people', 'bills', 'notifications',
      'workflows', 'workflow_runs', 'chat_sessions', 'notes', 'emails'
    ];

    console.log('Enforcing Row Level Security (RLS) and policies on all tables...');
    for (const table of allTables) {
      try {
        await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        await pool.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
        await pool.query(`DROP POLICY IF EXISTS user_isolation_policy ON ${table}`);

        const colsRes = await pool.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name IN ('user_id', 'workspace_owner_id', 'bill_id')
        `, [table]);

        const cols = colsRes.rows.map(r => r.column_name);
        let usingExpr = 'true';

        if (cols.includes('user_id')) {
          usingExpr = `user_id::text = current_setting('app.current_user_id', true) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else if (cols.includes('workspace_owner_id')) {
          usingExpr = `workspace_owner_id::text = current_setting('app.current_user_id', true) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else if (cols.includes('bill_id')) {
          usingExpr = `EXISTS (SELECT 1 FROM bills WHERE bills.id = ${table}.bill_id AND bills.user_id::text = current_setting('app.current_user_id', true)) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else {
          usingExpr = `current_setting('app.current_user_id', true) IS NOT NULL OR current_setting('app.bypass_rls', true) = 'on'`;
        }

        await pool.query(`
          CREATE POLICY user_isolation_policy ON ${table}
            FOR ALL
            USING (${usingExpr})
        `);
        console.log(`✅ RLS enabled & policy set on: ${table}`);
      } catch (err) {
        console.warn(`⚠️ Could not apply RLS policy on ${table}:`, err.message);
      }
    }

    // ── Create missing foreign-key indexes for performance optimization ──
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id)",
      "CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_deal_logs_deal_id ON deal_logs(deal_id)",
      "CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id)"
    ];

    console.log('Creating missing foreign-key indexes...');
    for (const q of indexQueries) {
      try {
        await pool.query(q);
        console.log(`✅ Index verified/created: ${q}`);
      } catch (err) {
        console.warn(`⚠️ Could not create index (${q}):`, err.message);
      }
    }

  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    pool.end();
  }
}

createTables();
