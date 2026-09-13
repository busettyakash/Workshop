# Database Parity & Synchronization Guide

This guide explains the dual-database architecture used in this project, why differences previously occurred between the **Local** and **Preview** databases, and how to verify or synchronize them at any time.

---

## 1. Architecture: Why Are There Two Databases?

| Environment | Provider | Configuration File | Used By |
| :--- | :--- | :--- | :--- |
| **Local Development** | **Supabase** (`aws-0-ap-northeast-1.pooler.supabase.com`) | `backend/.env.local` | Local development (`npm run dev`), local node scripts |
| **Preview & Production** | **InsForge** (`5drnjqqc-4by.us-east.database.insforge.app`) | `backend/.env` & Vercel Environment Variables | Vercel preview deployments, production hosting |

### Why Did They Keep Drifting Apart?
1. In `backend/src/lib/db.js`, `dotenv` loads `.env.local` first if it exists.
2. When you test or run migrations on your local machine, the queries execute against **Supabase**.
3. When the app is deployed to Vercel (Preview / Production), `.env.local` is not present, so Vercel connects to **InsForge**.
4. Consequently, any new tables, columns, or performance indexes created locally never automatically reached InsForge (and vice versa), causing page lags and discrepancies in the preview.

---

## 2. Current Status (100% Parity Achieved)

An automated audit and synchronization was executed across both live databases:

- **Tables**: **20 / 20 Match** (Both databases have the exact same set of 20 tables).
- **Columns**: **100% Match** (All data types, constraints, and defaults match across all shared tables).
- **Indexes**: **76 / 76 Match**
  - **17 indexes** previously missing in InsForge were applied.
  - **11 indexes** previously missing in Supabase were applied.
  - **Both databases are now at 76 indexes each.**

---

## 3. How to Check and Sync Databases

You do not need extra scripts in `package.json`. You can execute the standalone scripts directly from the terminal at any time:

### Step 1: Compare Tables and Columns
To verify that all tables and columns match between Supabase and InsForge:
```bash
cd backend
node scripts/compare_databases.mjs
```

### Step 2: Compare and Sync Indexes
To check for any missing indexes between both databases and **automatically create them** in both directions:
```bash
cd backend
node scripts/sync_db_indexes.mjs
```

This script:
1. Connects to both Supabase and InsForge simultaneously.
2. Compares all public schema indexes.
3. Detects any indexes present in one DB but missing in the other.
4. Generates and executes safe `CREATE INDEX IF NOT EXISTS` queries on whichever database needs them.
5. Verifies and prints the final index count for both databases.

---

## 4. Best Practices for Future Changes

Whenever you add new features, new columns, or new performance indexes:

1. **New Schema / Columns**: If you add columns via SQL or code, ensure the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` runs on both, or run the migration snippet against both databases.
2. **Performance Indexes**: After creating any index locally, run:
   ```bash
   node scripts/sync_db_indexes.mjs
   ```
   This immediately copies the new index over to InsForge (Preview) in seconds, ensuring your preview environment never suffers from missing-index query lag.
