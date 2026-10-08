/**
 * Database Abstraction Layer for Hyper Bingo
 *
 * Uses Neon Serverless PostgreSQL when DATABASE_URL is set.
 * Falls back to in-memory store if DATABASE_URL is not configured.
 *
 * Required env variables:
 *   DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
 */

import {
  User, Wallet, Transaction, WithdrawalRequest,
  LinkedPaymentAccount, LinkedAccountType, LinkedAccountStatus,
  TransactionType, TransactionStatus, PaymentProvider, UserRole,
  SystemAnnouncement,
} from './types';
import { TelegramUser } from './types';
import { isAdminTelegramId } from './authUtils';
import { getNeonSql, initDatabaseSchema } from './neon';

// ── In-Memory Fallback Store ─────────────────────────────────────────────────

const usersMap = new Map<string, User>();
const walletsMap = new Map<string, Wallet>();
const transactionsMap = new Map<string, Transaction>();
const withdrawalsMap = new Map<string, WithdrawalRequest>();
const linkedAccountsMap = new Map<string, LinkedPaymentAccount[]>();
const announcementsMap = new Map<string, SystemAnnouncement>();
let activeAnnouncementInMemory: SystemAnnouncement | null = null;

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateReferralCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    telegramId: row.telegram_id,
    username: row.username || '',
    role: row.role || 'user',
    status: (row.status || 'active') as User['status'],
    referralCode: row.referral_code || '',
    referredBy: row.referred_by || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

function rowToWallet(row: any): Wallet {
  return {
    userId: row.user_id,
    availableBalance: parseFloat(row.available_balance ?? '0'),
    bonusBalance: parseFloat(row.bonus_balance ?? '0'),
    winningBalance: parseFloat(row.winning_balance ?? '0'),
    totalDeposited: parseFloat(row.total_deposited ?? '0'),
    totalWithdrawn: parseFloat(row.total_withdrawn ?? '0'),
  };
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username || '',
    type: row.type as TransactionType,
    amount: parseFloat(row.amount),
    balanceAfter: parseFloat(row.balance_after ?? '0'),
    reference: row.reference || '',
    paymentProvider: (row.provider || 'Chapa') as PaymentProvider,
    status: (row.status || 'COMPLETED') as TransactionStatus,
    description: row.description || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    verifiedBy: row.verified_by || undefined,
  };
}

function rowToWithdrawal(row: any): WithdrawalRequest {
  return {
    id: row.id,
    transactionId: row.transaction_id || '',
    userId: row.user_id,
    username: row.username || '',
    amount: parseFloat(row.amount),
    paymentMethod: (row.provider || 'Telebirr') as PaymentProvider,
    accountNumber: row.account_number || '',
    accountName: row.account_holder || '',
    status: (row.status || 'PENDING') as TransactionStatus,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    payoutReference: row.payout_reference || undefined,
    processedBy: row.processed_by || undefined,
  };
}

function rowToLinkedAccount(row: any): LinkedPaymentAccount {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as LinkedAccountType,
    accountNumber: row.account_number,
    accountName: row.account_holder_name,
    status: (row.status || 'VERIFIED') as LinkedAccountStatus,
    isDefault: row.is_default || false,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

// ── DB Methods ────────────────────────────────────────────────────────────────

const db = {
  /**
   * Initialize the database schema (create all tables if not exist).
   * Call this once on first boot.
   */
  async init() {
    return initDatabaseSchema();
  },

  /**
   * Upsert a user from Telegram initData.
   */
  async upsertUserFromTelegram(tgUser: TelegramUser): Promise<User> {
    const sql = getNeonSql();
    const isAdmin = isAdminTelegramId(tgUser.id);
    const name = `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`;
    const username = tgUser.username ?? `user${tgUser.id}`;
    const telegramId = String(tgUser.id);
    const role = isAdmin ? 'admin' : 'user';

    if (sql) {
      try {
        const existing = await sql`
          SELECT * FROM users WHERE telegram_id = ${telegramId} LIMIT 1
        `;
        if (existing.length > 0) {
          const updated = await sql`
            UPDATE users
            SET name = ${name}, username = ${username}, role = ${role}
            WHERE telegram_id = ${telegramId}
            RETURNING *
          `;
          return rowToUser(updated[0]);
        }

        const referralCode = generateReferralCode();
        const newId = generateId('usr');
        const inserted = await sql`
          INSERT INTO users (id, telegram_id, name, username, role, referral_code)
          VALUES (${newId}, ${telegramId}, ${name}, ${username}, ${role}, ${referralCode})
          RETURNING *
        `;
        return rowToUser(inserted[0]);
      } catch (e) {
        console.error('Neon upsertUser error:', e);
        // Fallthrough to in-memory
      }
    }

    // --- In-memory fallback ---
    const existingKey = [...usersMap.keys()].find(k => usersMap.get(k)?.telegramId === telegramId);
    if (existingKey) {
      const existing = usersMap.get(existingKey)!;
      const updated: User = { ...existing, name, username, role };
      usersMap.set(existing.id, updated);
      return updated;
    }
    const newUser: User = {
      id: generateId('usr'),
      name,
      phone: '',
      telegramId,
      username,
      role,
      status: 'active',
      referralCode: generateReferralCode(),
      createdAt: new Date().toISOString(),
    };
    usersMap.set(newUser.id, newUser);
    return newUser;
  },

  async getUserById(userId: string): Promise<User | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
        return rows.length > 0 ? rowToUser(rows[0]) : null;
      } catch (e) { console.error('Neon getUserById error:', e); }
    }
    return usersMap.get(userId) ?? null;
  },

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM users WHERE telegram_id = ${telegramId} LIMIT 1`;
        return rows.length > 0 ? rowToUser(rows[0]) : null;
      } catch (e) { console.error('Neon getUserByTelegramId error:', e); }
    }
    return [...usersMap.values()].find(u => u.telegramId === telegramId) ?? null;
  },

  /**
   * Get all real Telegram user IDs (excluding web_ placeholder IDs) for broadcasting.
   */
  async getAllUserTelegramIds(): Promise<string[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT DISTINCT telegram_id FROM users
          WHERE telegram_id IS NOT NULL
            AND telegram_id NOT LIKE 'web_%'
          ORDER BY telegram_id
        `;
        return (rows as { telegram_id: string }[]).map(r => r.telegram_id).filter(Boolean);
      } catch (e) {
        console.error('Neon getAllUserTelegramIds error:', e);
      }
    }
    return [...usersMap.values()]
      .map(u => u.telegramId)
      .filter((id): id is string => Boolean(id) && !id.startsWith('web_'));
  },

  async getUserByPhone(phone: string): Promise<User | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
        return rows.length > 0 ? rowToUser(rows[0]) : null;
      } catch (e) { console.error('Neon getUserByPhone error:', e); }
    }
    return [...usersMap.values()].find(u => u.phone === phone) ?? null;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM users WHERE LOWER(username) = ${clean} LIMIT 1`;
        return rows.length > 0 ? rowToUser(rows[0]) : null;
      } catch (e) { console.error('Neon getUserByUsername error:', e); }
    }
    return [...usersMap.values()].find(u => u.username?.toLowerCase().replace(/^@/, '') === clean) ?? null;
  },

  async getUser(userId: string): Promise<User | null> {
    return this.getUserById(userId);
  },

  async getUserByReferralCode(referralCode: string): Promise<User | null> {
    const normalizedCode = referralCode.trim().toUpperCase();
    const sql = getNeonSql();
    if (sql) {
      try {
        // Case-insensitive lookup — referral codes are stored uppercase but be safe
        const rows = await sql`SELECT * FROM users WHERE UPPER(referral_code) = ${normalizedCode} LIMIT 1`;
        return rows.length > 0 ? rowToUser(rows[0]) : null;
      } catch (e) { console.error('Neon getUserByReferralCode error:', e); }
    }
    return [...usersMap.values()].find(u => u.referralCode?.toUpperCase() === normalizedCode) ?? null;
  },

  async registerUser(params: {
    name: string;
    phone: string;
    username?: string;
    telegramId?: string;
    referredBy?: string;
  }): Promise<User> {
    const sql = getNeonSql();
    const telegramId = params.telegramId ? String(params.telegramId) : `web_${Date.now()}`;
    const isAdmin = isAdminTelegramId(params.telegramId || params.username);
    const role = isAdmin ? 'admin' : 'user';
    const username = params.username || `user_${params.phone.replace(/\D/g, '').slice(-4)}`;
    const referralCode = generateReferralCode();
    const newId = generateId('usr');
    // Normalize: referredBy should be stored as uppercase for consistent lookup
    const normalizedReferredBy = params.referredBy ? params.referredBy.trim().toUpperCase() : null;

    if (sql) {
      try {
        const existing = await sql`
          SELECT * FROM users WHERE telegram_id = ${telegramId} OR (phone = ${params.phone} AND phone != '') LIMIT 1
        `;
        if (existing.length > 0) {
          const effectiveRole = existing[0].role === 'admin' ? 'admin' : role;
          // If user exists but has no referred_by and we now have one, update it
          if (!existing[0].referred_by && normalizedReferredBy) {
            const updated = await sql`
              UPDATE users
              SET name = ${params.name}, phone = ${params.phone}, username = ${username}, role = ${effectiveRole}, referred_by = ${normalizedReferredBy}
              WHERE id = ${existing[0].id}
              RETURNING *
            `;
            return rowToUser(updated[0]);
          }
          const updated = await sql`
            UPDATE users
            SET name = ${params.name}, phone = ${params.phone}, username = ${username}, role = ${effectiveRole}
            WHERE id = ${existing[0].id}
            RETURNING *
          `;
          return rowToUser(updated[0]);
        }

        const inserted = await sql`
          INSERT INTO users (id, telegram_id, name, username, phone, role, referral_code, referred_by)
          VALUES (${newId}, ${telegramId}, ${params.name}, ${username}, ${params.phone}, ${role}, ${referralCode}, ${normalizedReferredBy})
          RETURNING *
        `;
        return rowToUser(inserted[0]);
      } catch (e) {
        console.error('Neon registerUser error:', e);
      }
    }

    // In-memory fallback
    const existing = [...usersMap.values()].find(
      u => (params.telegramId && u.telegramId === telegramId) || (params.phone && u.phone === params.phone)
    );
    if (existing) {
      const effectiveRole = existing.role === 'admin' ? 'admin' : role;
      const updated: User = {
        ...existing,
        name: params.name,
        phone: params.phone,
        username,
        role: effectiveRole,
        referredBy: normalizedReferredBy ?? existing.referredBy,
      };
      usersMap.set(existing.id, updated);
      return updated;
    }

    const newUser: User = {
      id: newId,
      name: params.name,
      phone: params.phone,
      telegramId,
      username,
      role,
      status: 'active',
      referralCode,
      referredBy: normalizedReferredBy ?? undefined,
      createdAt: new Date().toISOString(),
    };
    usersMap.set(newUser.id, newUser);
    return newUser;
  },

  /**
   * Update a user's role (e.g. promote to 'admin' or demote to 'user')
   */
  async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          UPDATE users
          SET role = ${role}
          WHERE id = ${userId}
          RETURNING *
        `;
        if (rows.length > 0) {
          const u = rowToUser(rows[0]);
          usersMap.set(u.id, u);
          return u;
        }
      } catch (e) {
        console.error('Neon updateUserRole error:', e);
      }
    }
    const user = usersMap.get(userId);
    if (user) {
      user.role = role;
      usersMap.set(userId, user);
      return user;
    }
    return null;
  },

  /**
   * Add / promote an admin by identifier (telegramId, username, or phone)
   */
  async addAdminByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim().toLowerCase().replace(/^@/, '');
    const user = (await this.getUserByTelegramId(clean)) ||
                 (await this.getUserByUsername(clean)) ||
                 (await this.getUserByPhone(identifier.trim()));
    if (!user) return null;
    return this.updateUserRole(user.id, 'admin');
  },

  /**
   * Get or create a wallet for a user.
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM wallets WHERE user_id = ${userId} LIMIT 1`;
        if (rows.length > 0) return rowToWallet(rows[0]);
        const inserted = await sql`
          INSERT INTO wallets (user_id, available_balance, bonus_balance, winning_balance, total_deposited, total_withdrawn)
          VALUES (${userId}, 0.00, 20.00, 0.00, 0.00, 0.00)
          ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
          RETURNING *
        `;
        return rowToWallet(inserted[0]);
      } catch (e) { console.error('Neon getOrCreateWallet error:', e); }
    }
    if (walletsMap.has(userId)) return walletsMap.get(userId)!;
    const wallet: Wallet = {
      userId,
      availableBalance: 0,
      bonusBalance: 20, // 20 ETB welcome bonus — play-only, cannot be withdrawn
      winningBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    };
    walletsMap.set(userId, wallet);
    return wallet;
  },

  async getWallet(userId: string): Promise<Wallet | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM wallets WHERE user_id = ${userId} LIMIT 1`;
        return rows.length > 0 ? rowToWallet(rows[0]) : null;
      } catch (e) { console.error('Neon getWallet error:', e); }
    }
    return walletsMap.get(userId) ?? null;
  },

  /**
   * Credit ETB to a user's available balance after successful deposit.
   */
  async creditDeposit(userId: string, amount: number, txRef: string, provider: PaymentProvider): Promise<Transaction> {
    const sql = getNeonSql();
    const user = await this.getUserById(userId);
    const username = user?.username ?? 'unknown';

    if (sql) {
      try {
        // Check if already processed to prevent double crediting
        const existingTx = await sql`
          SELECT * FROM transactions WHERE reference = ${txRef} LIMIT 1
        `;
        if (existingTx.length > 0 && existingTx[0].status === 'COMPLETED') {
          return rowToTransaction(existingTx[0]);
        }

        // Update wallet
        const walletRows = await sql`
          UPDATE wallets
          SET
            available_balance = available_balance + ${amount},
            total_deposited   = total_deposited + ${amount},
            updated_at        = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
        const newBalance = walletRows.length > 0 ? parseFloat(walletRows[0].available_balance) : 0;

        if (existingTx.length > 0) {
          const updatedTxRows = await sql`
            UPDATE transactions
            SET status = 'COMPLETED', balance_after = ${newBalance}, provider = ${provider}
            WHERE id = ${existingTx[0].id}
            RETURNING *
          `;
          return rowToTransaction(updatedTxRows[0]);
        }

        // Insert transaction
        const txId = generateId('tx');
        const txRows = await sql`
          INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
          VALUES (
            ${txId}, ${userId}, ${username}, 'DEPOSIT', ${amount}, ${newBalance},
            ${provider}, 'COMPLETED', ${txRef}, ${'Deposit via ' + provider}
          )
          RETURNING *
        `;
        return rowToTransaction(txRows[0]);
      } catch (e) { console.error('Neon creditDeposit error:', e); }
    }

    // In-memory fallback
    const existing = [...transactionsMap.values()].find(t => t.reference === txRef);
    if (existing && existing.status === 'COMPLETED') {
      return existing;
    }

    const wallet = await this.getOrCreateWallet(userId);
    wallet.availableBalance += amount;
    wallet.totalDeposited += amount;
    walletsMap.set(userId, wallet);

    if (existing) {
      existing.status = 'COMPLETED';
      existing.balanceAfter = wallet.availableBalance;
      existing.paymentProvider = provider;
      transactionsMap.set(existing.id, existing);
      return existing;
    }

    const tx: Transaction = {
      id: generateId('tx'),
      userId,
      username,
      type: 'DEPOSIT',
      amount,
      balanceAfter: wallet.availableBalance,
      reference: txRef,
      paymentProvider: provider,
      status: 'COMPLETED',
      description: `Deposit via ${provider}`,
      createdAt: new Date().toISOString(),
    };
    transactionsMap.set(tx.id, tx);
    return tx;
  },

  /**
   * Create a PENDING deposit request without crediting balance yet.
   */
  async createPendingDeposit(params: {
    id?: string;
    userId: string;
    amount: number;
    provider: PaymentProvider;
    reference: string;
    description: string;
  }): Promise<Transaction> {
    const sql = getNeonSql();
    const user = await this.getUserById(params.userId);
    const username = user?.username ?? 'unknown';
    const txId = params.id || generateId('tx');

    if (sql) {
      try {
        const walletRows = await sql`SELECT available_balance FROM wallets WHERE user_id = ${params.userId} LIMIT 1`;
        const currentBal = walletRows.length > 0 ? parseFloat(walletRows[0].available_balance) : 0;
        const txRows = await sql`
          INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
          VALUES (
            ${txId}, ${params.userId}, ${username}, 'DEPOSIT', ${params.amount}, ${currentBal},
            ${params.provider}, 'PENDING', ${params.reference}, ${params.description}
          )
          RETURNING *
        `;
        return rowToTransaction(txRows[0]);
      } catch (e) {
        console.error('Neon createPendingDeposit error:', e);
      }
    }

    const wallet = await this.getOrCreateWallet(params.userId);
    const tx: Transaction = {
      id: txId,
      userId: params.userId,
      username,
      type: 'DEPOSIT',
      amount: params.amount,
      balanceAfter: wallet.availableBalance,
      reference: params.reference,
      paymentProvider: params.provider,
      status: 'PENDING',
      description: params.description,
      createdAt: new Date().toISOString(),
    };
    transactionsMap.set(tx.id, tx);
    return tx;
  },

  /**
   * Reject duplicate player-supplied bank/Telebirr reference (already credited).
   */
  /**
   * Reject duplicate player-supplied bank/Telebirr reference (already credited or pending).
   * Normalizes code (uppercase, trimmed, spaces and dashes removed).
   */
  async isDepositReferenceAlreadyUsed(reference: string, excludeTxId?: string): Promise<boolean> {
    const cleanRef = reference.trim().toUpperCase().replace(/[\s-_]/g, '');
    if (cleanRef.length < 3) return false;
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = excludeTxId
          ? await sql`
              SELECT id FROM transactions
              WHERE type = 'DEPOSIT'
                AND UPPER(REPLACE(REPLACE(reference, ' ', ''), '-', '')) = ${cleanRef}
                AND status IN ('COMPLETED', 'PENDING')
                AND id <> ${excludeTxId}
              LIMIT 1
            `
          : await sql`
              SELECT id FROM transactions
              WHERE type = 'DEPOSIT'
                AND UPPER(REPLACE(REPLACE(reference, ' ', ''), '-', '')) = ${cleanRef}
                AND status IN ('COMPLETED', 'PENDING')
              LIMIT 1
            `;
        return rows.length > 0;
      } catch (e) {
        console.error('Neon isDepositReferenceAlreadyUsed error:', e);
      }
    }
    return [...transactionsMap.values()].some(
      (t) =>
        t.type === 'DEPOSIT' &&
        t.reference &&
        t.reference.trim().toUpperCase().replace(/[\s-_]/g, '') === cleanRef &&
        (t.status === 'COMPLETED' || t.status === 'PENDING') &&
        t.id !== excludeTxId
    );
  },

  /**
   * Find an existing deposit transaction by reference.
   */
  async findDepositByReference(reference: string): Promise<Transaction | null> {
    const cleanRef = reference.trim().toUpperCase().replace(/[\s-_]/g, '');
    if (cleanRef.length < 3) return null;
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT * FROM transactions
          WHERE type = 'DEPOSIT'
            AND UPPER(REPLACE(REPLACE(reference, ' ', ''), '-', '')) = ${cleanRef}
          ORDER BY created_at DESC
          LIMIT 1
        `;
        if (rows.length > 0) return rowToTransaction(rows[0]);
      } catch (e) {
        console.error('Neon findDepositByReference error:', e);
      }
    }
    return [...transactionsMap.values()].find(
      (t) =>
        t.type === 'DEPOSIT' &&
        t.reference &&
        t.reference.trim().toUpperCase().replace(/[\s-_]/g, '') === cleanRef
    ) || null;
  },

  /**
   * Get count of pending deposits for a user (used to stop spamming multiple fake requests).
   */
  async getPendingDepositsCountForUser(userId: string): Promise<number> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT COUNT(*)::int as count FROM transactions
          WHERE user_id = ${userId}
            AND type = 'DEPOSIT'
            AND status = 'PENDING'
        `;
        return rows[0]?.count ?? 0;
      } catch (e) {
        console.error('Neon getPendingDepositsCountForUser error:', e);
      }
    }
    return [...transactionsMap.values()].filter(
      (t) => t.userId === userId && t.type === 'DEPOSIT' && t.status === 'PENDING'
    ).length;
  },

  /**
   * Admin approves a pending deposit -> credits user's wallet.
   */
  async approvePendingDeposit(transactionId: string, verifiedBy?: string): Promise<Transaction | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const txRows = await sql`SELECT * FROM transactions WHERE id = ${transactionId} LIMIT 1`;
        if (txRows.length === 0) return null;
        const tx = rowToTransaction(txRows[0]);
        if (tx.status !== 'PENDING') return tx;

        // Credit user wallet
        const walletRows = await sql`
          UPDATE wallets
          SET
            available_balance = available_balance + ${tx.amount},
            total_deposited = total_deposited + ${tx.amount},
            updated_at = NOW()
          WHERE user_id = ${tx.userId}
          RETURNING *
        `;
        const newBal = walletRows.length > 0 ? parseFloat(walletRows[0].available_balance) : 0;

        // Update tx
        const updatedTxRows = await sql`
          UPDATE transactions
          SET status = 'COMPLETED', balance_after = ${newBal}, verified_by = ${verifiedBy ?? null}
          WHERE id = ${transactionId}
          RETURNING *
        `;
        return rowToTransaction(updatedTxRows[0]);
      } catch (e) {
        console.error('Neon approvePendingDeposit error:', e);
      }
    }

    // In-memory
    const tx = transactionsMap.get(transactionId);
    if (!tx || tx.status !== 'PENDING') return tx || null;

    const wallet = await this.getOrCreateWallet(tx.userId);
    wallet.availableBalance += tx.amount;
    wallet.totalDeposited += tx.amount;
    walletsMap.set(tx.userId, wallet);

    tx.status = 'COMPLETED';
    tx.balanceAfter = wallet.availableBalance;
    if (verifiedBy) tx.verifiedBy = verifiedBy;
    transactionsMap.set(transactionId, tx);
    return tx;
  },

  /**
   * Admin rejects a pending deposit.
   */
  async rejectPendingDeposit(transactionIdOrRef: string): Promise<Transaction | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const updatedTxRows = await sql`
          UPDATE transactions
          SET status = 'FAILED'
          WHERE id = ${transactionIdOrRef} OR reference = ${transactionIdOrRef}
          RETURNING *
        `;
        if (updatedTxRows.length > 0) return rowToTransaction(updatedTxRows[0]);
      } catch (e) {
        console.error('Neon rejectPendingDeposit error:', e);
      }
    }

    const tx = transactionsMap.get(transactionIdOrRef) ||
      [...transactionsMap.values()].find(t => t.reference === transactionIdOrRef);
    if (tx) {
      tx.status = 'FAILED';
      transactionsMap.set(tx.id, tx);
      return tx;
    }
    return null;
  },

  /**
   * Get all pending deposits for admin review.
   */
  async getPendingDeposits(): Promise<Transaction[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT * FROM transactions
          WHERE type = 'DEPOSIT' AND status = 'PENDING'
          ORDER BY created_at DESC
        `;
        return rows.map(rowToTransaction);
      } catch (e) {
        console.error('Neon getPendingDeposits error:', e);
      }
    }
    return Array.from(transactionsMap.values())
      .filter((t) => t.type === 'DEPOSIT' && t.status === 'PENDING')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Get all deposits (any status) from the last 7 days for the admin panel.
   */
  async getRecentDeposits(): Promise<Transaction[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT * FROM transactions
          WHERE type = 'DEPOSIT'
            AND created_at >= NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
        `;
        return rows.map(rowToTransaction);
      } catch (e) {
        console.error('Neon getRecentDeposits error:', e);
      }
    }
    return Array.from(transactionsMap.values())
      .filter((t) => t.type === 'DEPOSIT')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * STEP 1 — Reserve the withdrawal amount (balance deducted immediately) and
   * create a PENDING withdrawal request that awaits admin / risk approval.
   *
   * Balance is debited NOW so the player cannot double-spend while the request
   * sits in the admin queue.  If the admin rejects it, `rejectWithdrawal`
   * refunds the amount back to the wallet.
   */
  async createPendingWithdrawal(params: {
    userId: string;
    amount: number;
    paymentMethod: PaymentProvider;
    accountNumber: string;
    accountName: string;
  }): Promise<{ withdrawal: WithdrawalRequest; transaction: Transaction }> {
    const sql = getNeonSql();
    const user = await this.getUserById(params.userId);
    const username = user?.username ?? 'unknown';

    if (sql) {
      try {
        // ── Balance check ──────────────────────────────────────────────────
        const walletRows = await sql`SELECT * FROM wallets WHERE user_id = ${params.userId} LIMIT 1`;
        if (walletRows.length === 0) throw new Error('Wallet not found');
        const currentWinning  = parseFloat(walletRows[0].winning_balance)  || 0;
        const currentAvailable = parseFloat(walletRows[0].available_balance) || 0;
        const totalWithdrawable = currentWinning + currentAvailable;
        if (totalWithdrawable < params.amount) throw new Error('Insufficient withdrawable balance');

        // ── Reserve (deduct) balance — winning first, then available ───────
        let rem = params.amount;
        let newWinning  = currentWinning;
        let newAvailable = currentAvailable;
        if (newWinning >= rem) {
          newWinning -= rem; rem = 0;
        } else {
          rem -= newWinning; newWinning = 0;
          newAvailable = Math.max(0, newAvailable - rem);
        }

        const updatedWallet = await sql`
          UPDATE wallets
          SET
            winning_balance   = ${newWinning},
            available_balance = ${newAvailable},
            total_withdrawn   = total_withdrawn + ${params.amount},
            updated_at        = NOW()
          WHERE user_id = ${params.userId}
          RETURNING *
        `;
        const newBalance = parseFloat(updatedWallet[0].available_balance)
                         + parseFloat(updatedWallet[0].winning_balance);

        // ── Insert PENDING transaction ─────────────────────────────────────
        const txId  = generateId('tx');
        const wdrRef = generateId('WDR');
        const txRows = await sql`
          INSERT INTO transactions
            (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
          VALUES (
            ${txId}, ${params.userId}, ${username},
            'WITHDRAWAL', ${-params.amount}, ${newBalance},
            ${params.paymentMethod}, 'PENDING', ${wdrRef},
            ${'Pending withdrawal to ' + params.paymentMethod + ' ' + params.accountNumber}
          )
          RETURNING *
        `;
        const tx = rowToTransaction(txRows[0]);

        // ── Insert PENDING withdrawal request ──────────────────────────────
        const wdrId = generateId('wdr');
        const wdrRows = await sql`
          INSERT INTO withdrawal_requests
            (id, user_id, username, amount, provider, account_number, account_holder, transaction_id, status)
          VALUES (
            ${wdrId}, ${params.userId}, ${username}, ${params.amount},
            ${params.paymentMethod}, ${params.accountNumber}, ${params.accountName},
            ${txId}, 'PENDING'
          )
          RETURNING *
        `;
        const withdrawal = rowToWithdrawal(wdrRows[0]);
        return { withdrawal, transaction: tx };
      } catch (e: any) {
        if (e.message === 'Insufficient withdrawable balance') throw e;
        console.error('Neon createPendingWithdrawal error:', e);
        throw e;
      }
    }

    // ── In-memory fallback ─────────────────────────────────────────────────
    const wallet = await this.getOrCreateWallet(params.userId);
    const totalWithdrawable = (wallet.winningBalance || 0) + (wallet.availableBalance || 0);
    if (totalWithdrawable < params.amount) throw new Error('Insufficient withdrawable balance');

    let rem = params.amount;
    if (wallet.winningBalance >= rem) {
      wallet.winningBalance -= rem;
    } else {
      rem -= wallet.winningBalance;
      wallet.winningBalance = 0;
      wallet.availableBalance = Math.max(0, wallet.availableBalance - rem);
    }
    wallet.totalWithdrawn += params.amount;
    walletsMap.set(params.userId, wallet);

    const tx: Transaction = {
      id: generateId('tx'),
      userId: params.userId,
      username,
      type: 'WITHDRAWAL',
      amount: -params.amount,
      balanceAfter: wallet.availableBalance + wallet.winningBalance,
      reference: generateId('WDR'),
      paymentProvider: params.paymentMethod,
      status: 'PENDING',
      description: `Pending withdrawal to ${params.paymentMethod} ${params.accountNumber}`,
      createdAt: new Date().toISOString(),
    };
    transactionsMap.set(tx.id, tx);

    const withdrawal: WithdrawalRequest = {
      id: generateId('wdr'),
      transactionId: tx.id,
      userId: params.userId,
      username,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      accountNumber: params.accountNumber,
      accountName: params.accountName,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    withdrawalsMap.set(withdrawal.id, withdrawal);
    return { withdrawal, transaction: tx };
  },

  /**
   * @deprecated Use createPendingWithdrawal — this alias kept for backwards-compatibility.
   */
  async createWithdrawal(params: {
    userId: string;
    amount: number;
    paymentMethod: PaymentProvider;
    accountNumber: string;
    accountName: string;
  }) {
    return this.createPendingWithdrawal(params);
  },

  /**
   * STEP 2A — Admin APPROVES a pending withdrawal.
   * Marks both the withdrawal_request and its linked transaction as COMPLETED.
   * The caller (admin route) is responsible for triggering the disbursement.
   */
  async approveWithdrawal(
    withdrawalId: string,
    options?: { processedBy?: string; payoutReference?: string }
  ): Promise<WithdrawalRequest | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          UPDATE withdrawal_requests
          SET
            status = 'COMPLETED',
            processed_by = ${options?.processedBy ?? null},
            payout_reference = ${options?.payoutReference ?? null}
          WHERE id = ${withdrawalId} AND status = 'PENDING'
          RETURNING *
        `;
        if (rows.length === 0) return null;
        const wr = rowToWithdrawal(rows[0]);
        // Mark linked transaction COMPLETED
        await sql`
          UPDATE transactions
          SET status = 'COMPLETED'
          WHERE id = ${wr.transactionId}
        `;
        return wr;
      } catch (e) { console.error('Neon approveWithdrawal error:', e); }
    }
    const wr = withdrawalsMap.get(withdrawalId);
    if (!wr || wr.status !== 'PENDING') return null;
    wr.status = 'COMPLETED';
    if (options?.processedBy) wr.processedBy = options.processedBy;
    if (options?.payoutReference) wr.payoutReference = options.payoutReference;
    withdrawalsMap.set(withdrawalId, wr);
    const tx = transactionsMap.get(wr.transactionId);
    if (tx) { tx.status = 'COMPLETED'; transactionsMap.set(tx.id, tx); }
    return wr;
  },

  /**
   * STEP 2B — Admin REJECTS a pending withdrawal.
   * Refunds the reserved amount back to the player's wallet and marks
   * both the withdrawal_request and transaction as FAILED.
   */
  async rejectWithdrawal(withdrawalId: string): Promise<WithdrawalRequest | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          UPDATE withdrawal_requests
          SET status = 'FAILED'
          WHERE id = ${withdrawalId} AND status = 'PENDING'
          RETURNING *
        `;
        if (rows.length === 0) return null;
        const wr = rowToWithdrawal(rows[0]);

        // Refund the reserved balance back
        await sql`
          UPDATE wallets
          SET
            available_balance = available_balance + ${wr.amount},
            total_withdrawn   = GREATEST(0, total_withdrawn - ${wr.amount}),
            updated_at        = NOW()
          WHERE user_id = ${wr.userId}
        `;

        // Mark linked transaction FAILED
        await sql`
          UPDATE transactions
          SET status = 'FAILED'
          WHERE id = ${wr.transactionId}
        `;
        return wr;
      } catch (e) { console.error('Neon rejectWithdrawal error:', e); }
    }

    const wr = withdrawalsMap.get(withdrawalId);
    if (!wr || wr.status !== 'PENDING') return null;
    wr.status = 'FAILED';
    withdrawalsMap.set(withdrawalId, wr);
    // Refund in-memory wallet
    const wallet = walletsMap.get(wr.userId);
    if (wallet) {
      wallet.availableBalance += wr.amount;
      wallet.totalWithdrawn   = Math.max(0, wallet.totalWithdrawn - wr.amount);
      walletsMap.set(wr.userId, wallet);
    }
    const tx = transactionsMap.get(wr.transactionId);
    if (tx) { tx.status = 'FAILED'; transactionsMap.set(tx.id, tx); }
    return wr;
  },

  /**
   * Admin: fetch all withdrawal requests with PENDING status.
   */
  async getPendingWithdrawals(): Promise<WithdrawalRequest[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT * FROM withdrawal_requests
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
        `;
        return rows.map(rowToWithdrawal);
      } catch (e) { console.error('Neon getPendingWithdrawals error:', e); }
    }
    return [...withdrawalsMap.values()]
      .filter((w) => w.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`
          SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100
        `;
        return rows.map(rowToTransaction);
      } catch (e) { console.error('Neon getTransactions error:', e); }
    }
    return [...transactionsMap.values()]
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getAllWithdrawals(): Promise<WithdrawalRequest[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM withdrawal_requests ORDER BY created_at DESC LIMIT 200`;
        return rows.map(rowToWithdrawal);
      } catch (e) { console.error('Neon getAllWithdrawals error:', e); }
    }
    return [...withdrawalsMap.values()].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async updateWithdrawalStatus(withdrawalId: string, status: TransactionStatus): Promise<void> {
    const sql = getNeonSql();
    if (sql) {
      try {
        await sql`UPDATE withdrawal_requests SET status = ${status} WHERE id = ${withdrawalId}`;
        return;
      } catch (e) { console.error('Neon updateWithdrawalStatus error:', e); }
    }
    const w = withdrawalsMap.get(withdrawalId);
    if (w) withdrawalsMap.set(withdrawalId, { ...w, status });
  },

  // ── Linked Payment Accounts ──────────────────────────────────────────────

  async getLinkedAccounts(userId: string): Promise<LinkedPaymentAccount[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM linked_accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
        return rows.map(rowToLinkedAccount);
      } catch (e) { console.error('Neon getLinkedAccounts error:', e); }
    }
    return linkedAccountsMap.get(userId) ?? [];
  },

  async addLinkedAccount(params: {
    userId: string;
    type: LinkedAccountType;
    accountNumber: string;
    accountName: string;
    bankName?: string;
  }): Promise<LinkedPaymentAccount> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const existing = await sql`SELECT id FROM linked_accounts WHERE user_id = ${params.userId} AND account_number = ${params.accountNumber} LIMIT 1`;
        if (existing.length > 0) throw new Error('This account is already linked');

        const countRows = await sql`SELECT COUNT(*) as count FROM linked_accounts WHERE user_id = ${params.userId}`;
        const isDefault = parseInt(countRows[0].count) === 0;
        const accId = generateId('acc');
        const rows = await sql`
          INSERT INTO linked_accounts (id, user_id, type, account_number, account_holder_name, is_default)
          VALUES (${accId}, ${params.userId}, ${params.type}, ${params.accountNumber}, ${params.accountName}, ${isDefault})
          RETURNING *
        `;
        return rowToLinkedAccount(rows[0]);
      } catch (e: any) {
        if (e.message === 'This account is already linked') throw e;
        console.error('Neon addLinkedAccount error:', e);
      }
    }
    const existing = linkedAccountsMap.get(params.userId) ?? [];
    if (existing.find(a => a.accountNumber === params.accountNumber)) throw new Error('This account is already linked');
    const account: LinkedPaymentAccount = {
      id: generateId('acc'),
      userId: params.userId,
      type: params.type,
      accountNumber: params.accountNumber,
      accountName: params.accountName,
      bankName: params.bankName,
      status: 'PENDING_VERIFICATION',
      isDefault: existing.length === 0,
      createdAt: new Date().toISOString(),
    };
    linkedAccountsMap.set(params.userId, [...existing, account]);
    return account;
  },

  async deleteLinkedAccount(userId: string, accountId: string): Promise<void> {
    const sql = getNeonSql();
    if (sql) {
      try {
        await sql`DELETE FROM linked_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
        return;
      } catch (e) { console.error('Neon deleteLinkedAccount error:', e); }
    }
    const existing = linkedAccountsMap.get(userId) ?? [];
    linkedAccountsMap.set(userId, existing.filter(a => a.id !== accountId));
  },

  async setDefaultAccount(userId: string, accountId: string): Promise<void> {
    const sql = getNeonSql();
    if (sql) {
      try {
        await sql`UPDATE linked_accounts SET is_default = FALSE WHERE user_id = ${userId}`;
        await sql`UPDATE linked_accounts SET is_default = TRUE WHERE id = ${accountId} AND user_id = ${userId}`;
        return;
      } catch (e) { console.error('Neon setDefaultAccount error:', e); }
    }
    const existing = linkedAccountsMap.get(userId) ?? [];
    linkedAccountsMap.set(userId, existing.map(a => ({ ...a, isDefault: a.id === accountId })));
  },

  /**
   * Admin: Get all users
   */
  async getAllUsers(): Promise<User[]> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 500`;
        return rows.map(rowToUser);
      } catch (e) { console.error('Neon getAllUsers error:', e); }
    }
    return [...usersMap.values()];
  },

  /**
   * Admin: Get platform stats
   */
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalDeposited: number;
    totalWithdrawn: number;
    pendingWithdrawals: number;
  }> {
    const sql = getNeonSql();
    if (sql) {
      try {
        const [usersCount, walletTotals, pendingCount] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM users`,
          sql`SELECT COALESCE(SUM(total_deposited), 0) as deposited, COALESCE(SUM(total_withdrawn), 0) as withdrawn FROM wallets`,
          sql`SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = 'PENDING'`,
        ]);
        return {
          totalUsers: parseInt(usersCount[0].count),
          totalDeposited: parseFloat(walletTotals[0].deposited),
          totalWithdrawn: parseFloat(walletTotals[0].withdrawn),
          pendingWithdrawals: parseInt(pendingCount[0].count),
        };
      } catch (e) { console.error('Neon getPlatformStats error:', e); }
    }
    // In-memory fallback
    const wallets = [...walletsMap.values()];
    const pendingW = [...withdrawalsMap.values()].filter(w => w.status === 'PENDING');
    return {
      totalUsers: usersMap.size,
      totalDeposited: wallets.reduce((sum, w) => sum + w.totalDeposited, 0),
      totalWithdrawn: wallets.reduce((sum, w) => sum + w.totalWithdrawn, 0),
      pendingWithdrawals: pendingW.length,
    };
  },

  /**
   * Credit 1% owner profit commission to referrer's bonus balance (play-only).
   */
  async creditReferrerCommission(referrerCode: string, amount: number): Promise<boolean> {
    const normalizedCode = referrerCode.trim().toUpperCase();
    const sql = getNeonSql();
    if (sql) {
      try {
        const userRows = await sql`SELECT id FROM users WHERE UPPER(referral_code) = ${normalizedCode} LIMIT 1`;
        if (userRows.length > 0) {
          const referrerUserId = userRows[0].id;
          await sql`
            UPDATE wallets
            SET bonus_balance = bonus_balance + ${amount}
            WHERE user_id = ${referrerUserId}
          `;
          console.log(`[Referral Commission] +${amount} ETB bonus credited to user ${referrerUserId} (code: ${normalizedCode})`);
          return true;
        }
      } catch (e) {
        console.error('Neon creditReferrerCommission error:', e);
      }
    }
    // In-memory fallback
    const referrer = [...usersMap.values()].find((u) => u.referralCode?.toUpperCase() === normalizedCode);
    if (referrer) {
      const wallet = walletsMap.get(referrer.id);
      if (wallet) {
        wallet.bonusBalance += amount;
        walletsMap.set(referrer.id, wallet);
      }
      return true;
    }
    return false;
  },

  /**
   * Save a new announcement and set it active
   */
  async saveAnnouncement(
    text: string,
    title?: string,
    type = 'BROADCAST',
    mediaUrl?: string,
    mediaType?: 'photo' | 'document' | 'image',
    fileName?: string
  ): Promise<SystemAnnouncement> {
    const id = generateId('ann');
    const now = new Date().toISOString();
    const newRecord: SystemAnnouncement = {
      id,
      text,
      title: title || '',
      type: type as any,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      fileName: fileName || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const sql = getNeonSql();
    if (sql) {
      try {
        await initDatabaseSchema();
        // Deactivate older announcements first
        await sql`UPDATE announcements SET is_active = FALSE WHERE is_active = TRUE`;
        // Insert new active announcement with media if present
        await sql`
          INSERT INTO announcements (id, text, title, type, media_url, media_type, file_name, is_active, created_at, updated_at)
          VALUES (${id}, ${text}, ${title || ''}, ${type}, ${mediaUrl || null}, ${mediaType || null}, ${fileName || null}, TRUE, NOW(), NOW())
        `;
        return newRecord;
      } catch (e) {
        console.error('Neon saveAnnouncement error:', e);
      }
    }

    // In-memory fallback
    for (const ann of announcementsMap.values()) {
      ann.isActive = false;
    }
    announcementsMap.set(id, newRecord);
    activeAnnouncementInMemory = newRecord;
    return newRecord;
  },

  /**
   * Get the current active announcement
   */
  async getActiveAnnouncement(): Promise<SystemAnnouncement | null> {
    const sql = getNeonSql();
    if (sql) {
      try {
        await initDatabaseSchema();
        const rows = await sql`
          SELECT * FROM announcements 
          WHERE is_active = TRUE 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            text: r.text,
            title: r.title || '',
            type: r.type || 'BROADCAST',
            mediaUrl: r.media_url || undefined,
            mediaType: r.media_type || undefined,
            fileName: r.file_name || undefined,
            isActive: Boolean(r.is_active),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
          };
        }
        return null;
      } catch (e) {
        console.error('Neon getActiveAnnouncement error:', e);
      }
    }

    // In-memory fallback
    if (activeAnnouncementInMemory && activeAnnouncementInMemory.isActive) {
      return activeAnnouncementInMemory;
    }
    const active = [...announcementsMap.values()].find((a) => a.isActive);
    return active || null;
  },

  /**
   * Deactivate/dismiss active announcement
   */
  async clearActiveAnnouncement(id?: string): Promise<boolean> {
    const sql = getNeonSql();
    if (sql) {
      try {
        if (id) {
          await sql`UPDATE announcements SET is_active = FALSE WHERE id = ${id}`;
        } else {
          await sql`UPDATE announcements SET is_active = FALSE WHERE is_active = TRUE`;
        }
        return true;
      } catch (e) {
        console.error('Neon clearActiveAnnouncement error:', e);
      }
    }

    if (id) {
      const ann = announcementsMap.get(id);
      if (ann) ann.isActive = false;
    } else {
      for (const ann of announcementsMap.values()) {
        ann.isActive = false;
      }
      activeAnnouncementInMemory = null;
    }
    return true;
  },
};

export { db };
