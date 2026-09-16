import { neon } from '@neondatabase/serverless';

/**
 * Neon Serverless PostgreSQL Database Client
 */
export function getNeonSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }
  return neon(databaseUrl);
}

/**
 * Automatically initializes all required PostgreSQL tables in Neon
 */
export async function initDatabaseSchema() {
  const sql = getNeonSql();
  if (!sql) {
    return {
      connected: false,
      message: 'DATABASE_URL not configured. Running in memory mode.',
    };
  }

  try {
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        telegram_id VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        phone VARCHAR(64),
        role VARCHAR(32) DEFAULT 'user',
        status VARCHAR(32) DEFAULT 'active',
        referral_code VARCHAR(64) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Wallets Table
    await sql`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        available_balance NUMERIC(12, 2) DEFAULT 250.00,
        bonus_balance NUMERIC(12, 2) DEFAULT 50.00,
        winning_balance NUMERIC(12, 2) DEFAULT 150.00,
        total_deposited NUMERIC(12, 2) DEFAULT 0.00,
        total_withdrawn NUMERIC(12, 2) DEFAULT 0.00,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 3. Transactions Ledger
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255),
        type VARCHAR(64) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL,
        reference VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Withdrawal Requests Table
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255),
        amount NUMERIC(12, 2) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        account_number VARCHAR(128) NOT NULL,
        account_holder VARCHAR(255) NOT NULL,
        status VARCHAR(64) DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 5. Linked Payment Accounts Table
    await sql`
      CREATE TABLE IF NOT EXISTS linked_accounts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(64) NOT NULL,
        account_number VARCHAR(128) NOT NULL,
        account_holder_name VARCHAR(255) NOT NULL,
        status VARCHAR(64) DEFAULT 'VERIFIED',
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 6. Games Table
    await sql`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        game_type VARCHAR(64) NOT NULL,
        entry_price NUMERIC(10, 2) NOT NULL,
        prize_pool NUMERIC(12, 2) NOT NULL,
        status VARCHAR(64) NOT NULL,
        drawn_numbers INTEGER[] DEFAULT '{}',
        current_ball INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    return {
      connected: true,
      message: 'Neon PostgreSQL tables initialized successfully (users, wallets, transactions, withdrawals, linked_accounts, games).',
    };
  } catch (error: any) {
    console.error('Neon schema initialization error:', error);
    return {
      connected: false,
      error: error.message,
    };
  }
}
