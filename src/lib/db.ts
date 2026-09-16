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
  TransactionType, TransactionStatus, PaymentProvider,
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
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

function rowToWallet(row: any): Wallet {
  return {
    userId: row.user_id,
    availableBalance: parseFloat(row.available_balance ?? '250'),
    bonusBalance: parseFloat(row.bonus_balance ?? '50'),
    winningBalance: parseFloat(row.winning_balance ?? '150'),
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

    if (sql) {
      try {
        const existing = await sql`
          SELECT * FROM users WHERE telegram_id = ${telegramId} OR (phone = ${params.phone} AND phone != '') LIMIT 1
        `;
        if (existing.length > 0) {
          const updated = await sql`
            UPDATE users
            SET name = ${params.name}, phone = ${params.phone}, username = ${username}, role = ${role}
            WHERE id = ${existing[0].id}
            RETURNING *
          `;
          return rowToUser(updated[0]);
        }

        const inserted = await sql`
          INSERT INTO users (id, telegram_id, name, username, phone, role, referral_code)
          VALUES (${newId}, ${telegramId}, ${params.name}, ${username}, ${params.phone}, ${role}, ${referralCode})
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
      const updated: User = {
        ...existing,
        name: params.name,
        phone: params.phone,
        username,
        role,
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
      createdAt: new Date().toISOString(),
    };
    usersMap.set(newUser.id, newUser);
    return newUser;
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
          INSERT INTO wallets (user_id)
          VALUES (${userId})
          RETURNING *
        `;
        return rowToWallet(inserted[0]);
      } catch (e) { console.error('Neon getOrCreateWallet error:', e); }
    }
    if (walletsMap.has(userId)) return walletsMap.get(userId)!;
    const wallet: Wallet = {
      userId,
      availableBalance: 250,
      bonusBalance: 50,
      winningBalance: 150,
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
    const wallet = await this.getOrCreateWallet(userId);
    wallet.availableBalance += amount;
    wallet.totalDeposited += amount;
    walletsMap.set(userId, wallet);
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
   * Create a withdrawal request and deduct from winningBalance.
   */
  async createWithdrawal(params: {
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
        // Check balance
        const walletRows = await sql`SELECT * FROM wallets WHERE user_id = ${params.userId} LIMIT 1`;
        if (walletRows.length === 0) throw new Error('Wallet not found');
        const currentWinning = parseFloat(walletRows[0].winning_balance);
        if (currentWinning < params.amount) throw new Error('Insufficient winning balance');

        // Deduct from wallet
        const updatedWallet = await sql`
          UPDATE wallets
          SET
            winning_balance = winning_balance - ${params.amount},
            total_withdrawn = total_withdrawn + ${params.amount},
            updated_at = NOW()
          WHERE user_id = ${params.userId}
          RETURNING *
        `;
        const newBalance = parseFloat(updatedWallet[0].winning_balance);

        // Insert transaction
        const txId = generateId('tx');
        const wdrRef = generateId('WDR');
        const txRows = await sql`
          INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
          VALUES (
            ${txId}, ${params.userId}, ${username}, 'WITHDRAWAL', ${-params.amount}, ${newBalance},
            ${params.paymentMethod}, 'PENDING', ${wdrRef},
            ${'Withdrawal to ' + params.paymentMethod + ' ' + params.accountNumber}
          )
          RETURNING *
        `;
        const tx = rowToTransaction(txRows[0]);

        // Insert withdrawal request
        const wdrId = generateId('wdr');
        const wdrRows = await sql`
          INSERT INTO withdrawal_requests (id, user_id, username, amount, provider, account_number, account_holder, transaction_id)
          VALUES (${wdrId}, ${params.userId}, ${username}, ${params.amount}, ${params.paymentMethod}, ${params.accountNumber}, ${params.accountName}, ${txId})
          RETURNING *
        `;
        const withdrawal = rowToWithdrawal(wdrRows[0]);
        return { withdrawal, transaction: tx };
      } catch (e: any) {
        if (e.message === 'Insufficient winning balance') throw e;
        console.error('Neon createWithdrawal error:', e);
      }
    }

    // In-memory fallback
    const wallet = await this.getOrCreateWallet(params.userId);
    if (wallet.winningBalance < params.amount) throw new Error('Insufficient winning balance');
    wallet.winningBalance -= params.amount;
    wallet.totalWithdrawn += params.amount;
    walletsMap.set(params.userId, wallet);

    const tx: Transaction = {
      id: generateId('tx'),
      userId: params.userId,
      username,
      type: 'WITHDRAWAL',
      amount: -params.amount,
      balanceAfter: wallet.winningBalance,
      reference: generateId('WDR'),
      paymentProvider: params.paymentMethod,
      status: 'PENDING',
      description: `Withdrawal to ${params.paymentMethod} ${params.accountNumber}`,
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
};

export { db };
