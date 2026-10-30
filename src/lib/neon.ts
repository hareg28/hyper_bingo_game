import { neon } from '@neondatabase/serverless';
import { INITIAL_GAMES } from '@/lib/store';

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

let gameDrawTimestampMigration: Promise<void> | null = null;
let gameRoundStartedMigration: Promise<void> | null = null;
let weekendRoundKeyMigration: Promise<void> | null = null;
let blockedPlayersMigration: Promise<void> | null = null;
let builtinGamesMigration: Promise<void> | null = null;
let gameCardPaidMigration: Promise<void> | null = null;

/** Track whether a retained Special card has been paid for after unregistering. */
export async function ensureGameCardPaidColumn(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (!gameCardPaidMigration) {
    gameCardPaidMigration = sql`ALTER TABLE game_cards ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE`
      .then(() => undefined)
      .catch((error) => {
        gameCardPaidMigration = null;
        throw error;
      });
  }
  await gameCardPaidMigration;
}

/** Ensure this runtime column exists for databases created before timed draws. */
export async function ensureGameDrawTimestampColumn(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (!gameDrawTimestampMigration) {
    gameDrawTimestampMigration = sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS last_ball_drawn_at TIMESTAMPTZ`
      .then(() => undefined)
      .catch((error) => {
        gameDrawTimestampMigration = null;
        throw error;
      });
  }
  await gameDrawTimestampMigration;
  if (!gameRoundStartedMigration) {
    gameRoundStartedMigration = sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS round_started_at TIMESTAMPTZ`
      .then(() => undefined)
      .catch((error) => {
        gameRoundStartedMigration = null;
        throw error;
      });
  }
  await gameRoundStartedMigration;
}

/** Marker prevents a scheduled Weekend slot from being reset more than once. */
export async function ensureWeekendRoundKeyColumn(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (!weekendRoundKeyMigration) {
    weekendRoundKeyMigration = sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS weekend_round_key VARCHAR(32)`
      .then(() => undefined)
      .catch((error) => {
        weekendRoundKeyMigration = null;
        throw error;
      });
  }
  await weekendRoundKeyMigration;
}

/** Persist false-claim penalties per player for the lifetime of a game round. */
export async function ensureBlockedPlayersColumn(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (!blockedPlayersMigration) {
    blockedPlayersMigration = sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS blocked_players TEXT[] DEFAULT '{}'`
      .then(() => undefined)
      .catch((error) => {
        blockedPlayersMigration = null;
        throw error;
      });
  }
  await blockedPlayersMigration;
}

/** Seed any missing built-in game rows once per server runtime. */
export async function ensureBuiltinGameRows(
  sql: NonNullable<ReturnType<typeof getNeonSql>>
): Promise<void> {
  if (!builtinGamesMigration) {
    builtinGamesMigration = Promise.all(INITIAL_GAMES.map((game) => {
      const initialStatus = game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY'
        ? 'SCHEDULED'
        : 'OPEN';
      return sql`
        INSERT INTO games (
          id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
          drawn_numbers, current_ball, current_players, winners, blocked_cards,
          active_special_rule_index, draw_interval, created_at, updated_at
        ) VALUES (
          ${game.id}, ${game.name}, ${game.gameType}, ${game.category}, ${game.winningRule},
          ${game.entryPrice}, ${game.prizePool}, ${initialStatus}, '{}', NULL, 0, '[]'::jsonb, '{}',
          ${game.activeSpecialRuleIndex ?? 0}, ${game.drawInterval ?? 3}, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
    })).then(() => undefined).catch((error) => {
      builtinGamesMigration = null;
      throw error;
    });
  }
  await builtinGamesMigration;
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
        referred_by VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // 1b. Safe migration: add referred_by to existing users table
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(64)`;
    } catch {}

    // 2. Wallets Table
    await sql`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        available_balance NUMERIC(12, 2) DEFAULT 0.00,
        bonus_balance NUMERIC(12, 2) DEFAULT 20.00,
        winning_balance NUMERIC(12, 2) DEFAULT 0.00,
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
        balance_after NUMERIC(12, 2) DEFAULT 0.00,
        provider VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL,
        reference VARCHAR(255),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // 3b. Add missing columns to existing transactions table (safe ALTER IF NOT EXISTS)
    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12, 2) DEFAULT 0.00`;
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT`;
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255)`;
    } catch {}

    // Reserve each normalized bank reference to one deposit, even under concurrent submissions.
    await sql`
      CREATE TABLE IF NOT EXISTS bonno_deposit_reference_claims (
        reference_key VARCHAR(255) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
        claimed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Withdrawal Requests Table
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id VARCHAR(64) PRIMARY KEY,
        transaction_id VARCHAR(64),
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
    // 4b. Add missing transaction_id column to existing table (safe ALTER IF NOT EXISTS)
    try {
      await sql`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64)`;
      await sql`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS payout_reference VARCHAR(255)`;
      await sql`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS processed_by VARCHAR(255)`;
    } catch {}

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

    // 6. Games Table (expanded for full multiplayer support)
    await sql`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        game_type VARCHAR(64) NOT NULL,
        category VARCHAR(64),
        winning_rule VARCHAR(64),
        entry_price NUMERIC(10, 2) NOT NULL,
        prize_pool NUMERIC(12, 2) NOT NULL,
        status VARCHAR(64) NOT NULL,
        drawn_numbers INTEGER[] DEFAULT '{}',
        current_ball INTEGER,
        current_players INTEGER DEFAULT 0,
        winners JSONB DEFAULT '[]',
        blocked_cards TEXT[] DEFAULT '{}',
        active_special_rule_index INTEGER DEFAULT 0,
        next_round_starts_at BIGINT,
        weekend_round_key VARCHAR(32),
        draw_interval INTEGER DEFAULT 3,
        last_ball_drawn_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // 6b. Safe ALTER for existing games table — add missing multiplayer columns
    try {
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS category VARCHAR(64)`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS winning_rule VARCHAR(64)`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS current_players INTEGER DEFAULT 0`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS blocked_cards TEXT[] DEFAULT '{}'`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS blocked_players TEXT[] DEFAULT '{}'`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS active_special_rule_index INTEGER DEFAULT 0`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS next_round_starts_at BIGINT`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS weekend_round_key VARCHAR(32)`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS draw_interval INTEGER DEFAULT 3`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS last_ball_drawn_at TIMESTAMPTZ`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
    } catch {}
    // Keep this essential draw-timing column outside the best-effort block so
    // failures are visible and older deployments are upgraded reliably.
    await ensureGameDrawTimestampColumn(sql);

    // 6c. Seed INITIAL_GAMES if not already present
    try {
      for (const g of INITIAL_GAMES) {
        await sql`
          INSERT INTO games (
            id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
            drawn_numbers, current_ball, current_players, winners, blocked_cards,
            active_special_rule_index, draw_interval, created_at, updated_at
          ) VALUES (
            ${g.id}, ${g.name}, ${g.gameType}, ${g.category}, ${g.winningRule}, ${g.entryPrice},
            ${g.prizePool}, 'OPEN', '{}', NULL, 0, '[]'::jsonb, '{}',
            ${g.activeSpecialRuleIndex ?? 0}, ${g.drawInterval ?? 3}, NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    } catch {}

    // 8. Game Cards Table — server-side card ownership (prevents duplicate sales)
    await sql`
      CREATE TABLE IF NOT EXISTS game_cards (
        id VARCHAR(64) PRIMARY KEY,
        game_id VARCHAR(64) NOT NULL,
        card_number VARCHAR(16) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        username VARCHAR(255),
        cost NUMERIC(10,2) NOT NULL DEFAULT 0,
        is_registered BOOLEAN DEFAULT FALSE,
        is_paid BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(game_id, card_number)
      );
    `;
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_game_cards_game_id ON game_cards(game_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_game_cards_user_id ON game_cards(user_id)`;
      await sql`ALTER TABLE game_cards ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE game_cards ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE`;
    } catch {}

    // 7. Announcements Table
    await sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(64) PRIMARY KEY,
        text TEXT NOT NULL,
        title VARCHAR(255),
        type VARCHAR(64) DEFAULT 'BROADCAST',
        media_url TEXT,
        media_type VARCHAR(64),
        file_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // 7b. Safe ALTER for existing announcements table
    try {
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_url TEXT`;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_type VARCHAR(64)`;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`;
    } catch {}

    return {
      connected: true,
      message: 'Neon PostgreSQL tables initialized successfully (users, wallets, transactions, withdrawals, linked_accounts, games, announcements). referred_by column ensured.',
    };
  } catch (error: any) {
    console.error('Neon schema initialization error:', error);
    return {
      connected: false,
      error: error.message,
    };
  }
}
