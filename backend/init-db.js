process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

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
    // Drop deprecated tables if they still exist
    await pool.query(`
      DROP TABLE IF EXISTS deal_logs CASCADE;
      DROP TABLE IF EXISTS deals CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
    `).catch(() => {});

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
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS password TEXT;
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS workspace_handle VARCHAR(100);
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS referral_source VARCHAR(100);
      ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS usage_type VARCHAR(100);

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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_kg NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS next_restock_time TEXT DEFAULT 'TBD';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS price_covers DECIMAL(10, 2);

      CREATE TABLE IF NOT EXISTS product_price_history (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        user_id TEXT NOT NULL,
        old_price NUMERIC(10, 2),
        new_price NUMERIC(10, 2) NOT NULL,
        effective_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS product_stock_history (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        user_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        qty_change NUMERIC(10, 2) NOT NULL,
        stock_before NUMERIC(10, 2),
        stock_after NUMERIC(10, 2),
        loose_kg_after NUMERIC(10, 2),
        source TEXT,
        source_ref TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE product_stock_history ADD COLUMN IF NOT EXISTS loose_kg_after NUMERIC(10, 2);

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
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS loose_kg NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_name TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_city TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_state TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS price_covers DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS note TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS add_stock_qty NUMERIC;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS supplier_total_cost DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);

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

      ALTER TABLE people ADD COLUMN IF NOT EXISTS company TEXT;
      ALTER TABLE people ADD COLUMN IF NOT EXISTS company_name TEXT;


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
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50);
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

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
        user_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_live BOOLEAN DEFAULT true,
        nodes JSONB NOT NULL,
        is_starred BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

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
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        quote_number VARCHAR(50) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        customer_email VARCHAR(255),
        total_amount NUMERIC(10, 2) DEFAULT 0,
        tax_amount NUMERIC(10, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Draft',
        issue_date DATE DEFAULT CURRENT_DATE,
        valid_until DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
        notes TEXT,
        line_items JSONB DEFAULT '[]'::jsonb,
        user_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255) DEFAULT 'Workshop Store';
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255);
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
      CREATE TABLE IF NOT EXISTS bill_items (
        id SERIAL PRIMARY KEY,
        bill_id INT,
        product_id INT,
        product_name TEXT,
        quantity NUMERIC(10,2),
        price NUMERIC(10,2),
        line_total NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notes (
        id               SERIAL PRIMARY KEY,
        title            TEXT NOT NULL,
        body             TEXT DEFAULT '',
        attachment_name  TEXT,
        attachment_data  TEXT,
        user_id          TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS emails (
        id               SERIAL PRIMARY KEY,
        from_name        TEXT NOT NULL,
        from_email       TEXT NOT NULL,
        to_email         TEXT,
        subject          TEXT NOT NULL,
        body             TEXT DEFAULT '',
        preview          TEXT DEFAULT '',
        is_read          BOOLEAN DEFAULT false,
        starred          BOOLEAN DEFAULT false,
        direction        TEXT DEFAULT 'inbox',
        attachment_name  TEXT,
        attachment_data  TEXT,
        user_id          TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bill_templates (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        name        VARCHAR(255) NOT NULL,
        html        TEXT NOT NULL,
        is_default  BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_owner_id TEXT NOT NULL,
        member_email TEXT NOT NULL,
        role TEXT DEFAULT 'Member',
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (workspace_owner_id, member_email)
      );

      CREATE TABLE IF NOT EXISTS import_stock_payments (
        id SERIAL PRIMARY KEY,
        import_stock_id INT NOT NULL,
        user_id TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        payment_method VARCHAR(50),
        payment_date DATE,
        note TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS payment_date DATE;
      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS note TEXT;
      ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS notes TEXT;

      CREATE TABLE IF NOT EXISTS uoms (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'Count',
        is_bulk BOOLEAN DEFAULT false,
        presets TEXT DEFAULT '1',
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('All database tables created successfully!');

    // ── Enforce RLS on all tables with user isolation ──
    const allTables = [
      'bill_items', 'shop_profiles', 'bill_templates', 'workspace_members',
      'products', 'product_price_history', 'product_stock_history', 'import_stock', 'customers', 'people', 'bills', 'notifications',
      'workflows', 'workflow_runs', 'chat_sessions', 'notes', 'emails', 'uoms', 'quotes'
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
        let usingExpr;
        if (cols.includes('user_id')) {
          usingExpr = `(select auth.uid())::text = user_id::text OR user_id::text = current_setting('app.current_user_id', true) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else if (cols.includes('workspace_owner_id')) {
          usingExpr = `(select auth.uid())::text = workspace_owner_id::text OR workspace_owner_id::text = current_setting('app.current_user_id', true) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else if (cols.includes('bill_id')) {
          usingExpr = `EXISTS (SELECT 1 FROM bills WHERE bills.id = ${table}.bill_id AND (bills.user_id::text = (select auth.uid())::text OR bills.user_id::text = current_setting('app.current_user_id', true))) OR current_setting('app.bypass_rls', true) = 'on'`;
        } else {
          usingExpr = `(select auth.uid()) IS NOT NULL OR current_setting('app.current_user_id', true) IS NOT NULL OR current_setting('app.bypass_rls', true) = 'on'`;
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

    // Config performance timeout
    try {
      await pool.query("ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s'");
      await pool.query("ALTER SYSTEM SET idle_session_timeout = '10min'");
      await pool.query("SELECT pg_reload_conf()");
      console.log('✅ Set idle_in_transaction_session_timeout = 30s');
    } catch (tErr) {
      console.log('ℹ️ Session timeout notice:', tErr.message);
    }

    // Secure public.rls_auto_enable() if present so anon/authenticated cannot execute it via REST API
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
          ) THEN
            EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
              EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
              EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
            END IF;
          END IF;
        END $$;
      `);
      console.log('✅ Verified rls_auto_enable security permissions');
    } catch (secErr) {
      console.log('ℹ️ Security hardening notice:', secErr.message);
    }

    // ── Create missing foreign-key and search indexes for performance optimization ──
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id)",
      "CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id)",
      "CREATE INDEX IF NOT EXISTS idx_shop_profiles_email ON shop_profiles(LOWER(email))",
      "CREATE INDEX IF NOT EXISTS idx_shop_profiles_user_id ON shop_profiles(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_workspace_members_member_email ON workspace_members(LOWER(member_email))",
      "CREATE INDEX IF NOT EXISTS idx_workspace_members_owner_id ON workspace_members(workspace_owner_id)",
      "CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status)",
      "CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)",
      "CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_import_stock_user_id ON import_stock(user_id)"
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

    // ── Backfill initial & imported stock history for any existing products missing added event ──
    try {
      const backfillRes = await pool.query(`
        INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, loose_kg_after, source, notes, created_at)
        SELECT 
          p.id AS product_id,
          p.user_id,
          'added' AS change_type,
          orig.original_stock AS qty_change,
          0 AS stock_before,
          orig.original_stock AS stock_after,
          0 AS loose_kg_after,
          CASE WHEN i.id IS NOT NULL THEN 'Stock Import' ELSE 'Initial Base Stock' END AS source,
          CASE 
            WHEN i.id IS NOT NULL THEN CONCAT('Imported ', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM orig.original_stock::numeric::text)), ' ', CASE WHEN COALESCE(p.bag_weight, 1) > 1 THEN 'Bags' ELSE COALESCE(p.unit, 'pcs') END, ' via Stock Import', CASE WHEN i.buyer_name IS NOT NULL AND i.buyer_name <> '' THEN CONCAT(' (Supplier: ', i.buyer_name, ')') ELSE '' END)
            ELSE CONCAT('Initial base stock of ', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM orig.original_stock::numeric::text)), ' ', CASE WHEN COALESCE(p.bag_weight, 1) > 1 THEN 'Bags' ELSE COALESCE(p.unit, 'pcs') END)
          END AS notes,
          COALESCE(i.created_at, p.created_at, NOW()) AS created_at
        FROM products p
        CROSS JOIN LATERAL (
          SELECT COALESCE(
            (SELECT MAX(psh.stock_before::numeric) FROM product_stock_history psh WHERE psh.product_id = p.id),
            (SELECT i_sub.stock::numeric FROM import_stock i_sub WHERE (i_sub.user_id = p.user_id OR i_sub.user_id = 'default-user') AND (i_sub.sku = p.sku OR LOWER(TRIM(i_sub.name)) = LOWER(TRIM(p.name))) ORDER BY i_sub.id DESC LIMIT 1),
            p.stock::numeric,
            0
          ) AS original_stock
        ) orig
        LEFT JOIN LATERAL (
          SELECT id, buyer_name, created_at
          FROM import_stock
          WHERE (user_id = p.user_id OR user_id = 'default-user')
            AND (sku = p.sku OR LOWER(TRIM(name)) = LOWER(TRIM(p.name)))
          ORDER BY id DESC LIMIT 1
        ) i ON true
        WHERE orig.original_stock > 0
          AND NOT EXISTS (
            SELECT 1 FROM product_stock_history psh 
            WHERE psh.product_id = p.id AND psh.change_type = 'added'
          )
        RETURNING id;
      `);
      if (backfillRes.rows.length > 0) {
        console.log(`✅ Backfilled initial/imported stock history for ${backfillRes.rows.length} existing products.`);
      }
    } catch (bfErr) {
      console.warn('ℹ️ Stock history backfill notice:', bfErr.message);
    }

  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    pool.end();
  }
}

createTables();
