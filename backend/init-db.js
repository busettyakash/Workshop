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
    `);
    console.log('All database tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    pool.end();
  }
}

createTables();
