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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id TEXT;

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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS user_id TEXT;

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

      CREATE TABLE IF NOT EXISTS account_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        date TIMESTAMPTZ DEFAULT NOW(),
        description TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        sku VARCHAR(100),
        price DECIMAL(10, 2),
        stock INT DEFAULT 0,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bundles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        products JSONB,
        price DECIMAL(10, 2),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_books (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        discount_percentage DECIMAL(5, 2) DEFAULT 0,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pricing_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        rule_type VARCHAR(50),
        criteria JSONB,
        discount DECIMAL(10, 2),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS taxes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        percentage DECIMAL(5, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opportunities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        stage VARCHAR(50) DEFAULT 'Discovery',
        value DECIMAL(12, 2) DEFAULT 0,
        close_date DATE,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        quote_number VARCHAR(100) UNIQUE,
        deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
        total DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Draft',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sales_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE,
        quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        total DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        delivery_number VARCHAR(100) UNIQUE,
        order_id INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Shipped',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sales_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(100) UNIQUE,
        order_id INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
        reason TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approval_queue (
        id SERIAL PRIMARY KEY,
        request_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Pending',
        requester_id TEXT,
        approver_id TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50),
        date TIMESTAMPTZ DEFAULT NOW(),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credit_notes (
        id SERIAL PRIMARY KEY,
        note_number VARCHAR(100) UNIQUE,
        amount DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debit_notes (
        id SERIAL PRIMARY KEY,
        note_number VARCHAR(100) UNIQUE,
        amount DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        refund_number VARCHAR(100) UNIQUE,
        amount DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100),
        amount DECIMAL(12, 2) NOT NULL,
        date DATE,
        description TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customer_ledger (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        type VARCHAR(10),
        amount DECIMAL(12, 2) NOT NULL,
        balance DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credit_sales (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        due_date DATE,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS outstanding_dues (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        collector_name VARCHAR(255),
        amount DECIMAL(12, 2) NOT NULL,
        date DATE,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_reminders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        channel VARCHAR(50),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE,
        supplier_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        total DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goods_received (
        id SERIAL PRIMARY KEY,
        grn_number VARCHAR(100) UNIQUE,
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Received',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        from_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
        to_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        adjustment_type VARCHAR(50),
        quantity INT,
        reason TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cycle_counts (
        id SERIAL PRIMARY KEY,
        date DATE DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'Completed',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS low_stock_alerts (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        threshold INT DEFAULT 10,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS supplier_quotations (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        products JSONB,
        total DECIMAL(12, 2) NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        requester_id TEXT,
        products JSONB,
        status VARCHAR(50) DEFAULT 'Pending',
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_approvals (
        id SERIAL PRIMARY KEY,
        pr_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'Approved',
        approver_id TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vendor_comparisons (
        id SERIAL PRIMARY KEY,
        data JSONB,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(100) UNIQUE,
        supplier_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        reason TEXT,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id SERIAL PRIMARY KEY,
        report_type VARCHAR(100),
        frequency VARCHAR(50),
        recipient VARCHAR(255),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS business_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        criteria JSONB,
        action JSONB,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tax_configurations (
        id SERIAL PRIMARY KEY,
        settings JSONB,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS numbering_series (
        id SERIAL PRIMARY KEY,
        document_type VARCHAR(100) UNIQUE,
        prefix VARCHAR(10),
        next_number INT DEFAULT 1,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        service_name VARCHAR(100) UNIQUE,
        config JSONB,
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        user_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        config JSONB,
        user_id TEXT NOT NULL
      );
    `);
    console.log('All database tables created successfully!');

    // ── Enforce RLS on all tables with user isolation ──
    const allTables = [
      'bill_items', 'companies', 'deals', 'shop_profiles', 'bill_templates', 'deal_logs', 'workspace_members',
      'products', 'import_stock', 'customers', 'people', 'bills', 'notifications', 
      'workflows', 'workflow_runs', 'chat_sessions', 'account_groups', 'activities', 
      'categories', 'brands', 'variants', 'bundles', 'price_books', 'pricing_rules', 
      'taxes', 'opportunities', 'quotes', 'sales_orders', 'deliveries', 'sales_returns', 
      'approval_queue', 'payments', 'credit_notes', 'debit_notes', 'refunds', 'expenses', 
      'customer_ledger', 'credit_sales', 'outstanding_dues', 'collections', 'payment_reminders', 
      'warehouses', 'purchase_orders', 'goods_received', 'stock_transfers', 'stock_adjustments', 
      'cycle_counts', 'low_stock_alerts', 'supplier_quotations', 'purchase_requests', 
      'purchase_approvals', 'vendor_comparisons', 'purchase_returns', 'scheduled_reports', 
      'business_rules', 'branches', 'tax_configurations', 'numbering_series', 'integrations', 
      'audit_logs', 'system_settings', 'notes', 'emails'
    ];

    console.log('Enforcing Row Level Security (RLS) and policies on all tables...');
    for (const table of allTables) {
      try {
        await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        await pool.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
        await pool.query(`DROP POLICY IF EXISTS user_isolation_policy ON ${table}`);
        
        // Dynamically inspect column availability to write the correct policy constraint
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
          // Fallback if table doesn't isolate directly, verify active authenticated user
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
      "CREATE INDEX IF NOT EXISTS idx_credit_sales_customer_id ON credit_sales(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_deal_logs_deal_id ON deal_logs(deal_id)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id)",
      "CREATE INDEX IF NOT EXISTS idx_goods_received_po_id ON goods_received(po_id)",
      "CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_product_id ON low_stock_alerts(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_outstanding_dues_customer_id ON outstanding_dues(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_payment_reminders_customer_id ON payment_reminders(customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id)",
      "CREATE INDEX IF NOT EXISTS idx_purchase_approvals_pr_id ON purchase_approvals(pr_id)",
      "CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id)",
      "CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON purchase_returns(supplier_id)",
      "CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id)",
      "CREATE INDEX IF NOT EXISTS idx_sales_orders_quote_id ON sales_orders(quote_id)",
      "CREATE INDEX IF NOT EXISTS idx_sales_returns_order_id ON sales_returns(order_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON stock_adjustments(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_warehouse_id ON stock_transfers(from_warehouse_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_transfers_product_id ON stock_transfers(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_warehouse_id ON stock_transfers(to_warehouse_id)",
      "CREATE INDEX IF NOT EXISTS idx_supplier_quotations_supplier_id ON supplier_quotations(supplier_id)",
      "CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id)",
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
