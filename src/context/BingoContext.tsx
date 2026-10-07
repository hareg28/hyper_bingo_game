'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, UserRole, Wallet, Game, BingoCard, Transaction, 
  WithdrawalRequest, Promotion, AuditLog, Referral, WinnerRecord, GameStatus, PaymentProvider 
} from '../lib/types';
import { 
  INITIAL_USER, INITIAL_WALLET, INITIAL_GAMES, 
  INITIAL_TRANSACTIONS, INITIAL_WITHDRAWALS, 
  INITIAL_PROMOTIONS, INITIAL_AUDIT_LOGS, INITIAL_REFERRALS, INITIAL_CARDS,
  getGameLivePrizePool, OWNER_CUT_PCT, WINNERS_CUT_PCT
} from '../lib/store';
import { 
  createNewBingoCard, 
  checkLineWin, 
  countCompletedLines, 
  checkFullHouseWin, 
  getBestWinningRule,
  WinningRuleMatch,
  HYPER_SPECIAL_RULES,
  calcLotteryTotalCost,
  formatLotteryCardNumber,
  LOTTERY_NUMBERS_TOTAL,
} from '../lib/bingoUtils';
import { isAdminTelegramId } from '../lib/authUtils';

import { Language, translations } from '../lib/translations';
import { getInitialLotterySoldMap } from '../lib/store';

interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'info' | 'warning' | 'win';
  timestamp: string;
}

export const EMPTY_WALLET: Wallet = {
  userId: '',
  availableBalance: 0,
  bonusBalance: 20, // 20 ETB welcome bonus for new players
  winningBalance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
};

interface BingoContextType {
  user: User | null;
  isLoggedIn: boolean;
  wallet: Wallet;
  games: Game[];
  activeGameId: string | null;
  userCards: BingoCard[];
  transactions: Transaction[];
  withdrawals: WithdrawalRequest[];
  promotions: Promotion[];
  auditLogs: AuditLog[];
  referrals: Referral[];
  notifications: NotificationMessage[];
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
  setActiveGameId: (id: string | null) => void;
  depositWallet: (amount: number, provider: PaymentProvider, reference: string) => Promise<boolean>;
  submitPendingDeposit: (amount: number, provider: PaymentProvider, reference: string, transactionCode?: string) => Promise<boolean>;
  approveDeposit: (transactionId: string, adminName: string) => Promise<void>;
  rejectDeposit: (transactionId: string, adminName: string) => Promise<void>;
  requestWithdrawal: (amount: number, provider: PaymentProvider, accountNumber: string, accountName: string) => Promise<boolean>;
  approveWithdrawal: (withdrawalId: string, adminName: string, payoutReference?: string) => Promise<void>;
  rejectWithdrawal: (withdrawalId: string, adminName: string) => Promise<void>;
  refreshFinanceQueue: () => Promise<void>;
  joinGame: (gameId: string, chosenCardNumbers?: string[]) => boolean;
  addCardToGame: (gameId: string, cardNumber: string) => boolean;
  removeCard: (cardId: string) => void;
  createGame: (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => void;
  updateGameStatus: (gameId: string, status: GameStatus) => void;
  daubCell: (cardId: string, row: number, col: number) => void;
  claimBingo: (cardId: string) => { success: boolean; message: string; prize?: number };
  blockCard: (gameId: string, cardNumber: string) => void;
  resetGameRound: (gameId: string) => void;
  clearConsumedCards: (gameId: string) => void;
  drawNextBall: (gameId: string) => number | null;
  dismissNotification: (id: string) => void;
  addNotification: (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'win') => void;
  toggleAutoDaub: () => void;
  autoDaubEnabled: boolean;
  toggleUserRole: () => void;
  setUserRole: (role: UserRole) => void;
  updateUserRoleInDb: (targetUserId: string, role: UserRole) => Promise<{ success: boolean; message?: string }>;
  addAdminByIdentifier: (identifier: string) => Promise<{ success: boolean; message?: string }>;
  creditBonusBalance: (amount: number, reason: string) => void;
  // Weekend Lottery
  getLotterySoldNumbers: (gameId: string) => Set<number>;
  purchaseLotteryNumbers: (gameId: string, numbers: number[]) => { success: boolean; message: string; purchased?: string[] };
  // Auth extensions
  isAuthModalOpen: boolean;
  authModalMode: 'register' | 'login';
  openAuthModal: (mode?: 'register' | 'login') => void;
  closeAuthModal: () => void;
  registerAccount: (data: { name: string; phone: string; username?: string; telegramId?: string; referralCode?: string }) => Promise<{ success: boolean; message?: string }>;
  loginAccount: (identifier: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  verifyAdminAccess: (identifier: string) => Promise<{ success: boolean; isAdmin: boolean; message?: string }>;
}

const BingoContext = createContext<BingoContextType | undefined>(undefined);

export function BingoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);
  const [activeGameId, setActiveGameId] = useState<string | null>('gm_fetan_05');
  const [userCards, setUserCards] = useState<BingoCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(INITIAL_WITHDRAWALS);
  const [promotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [referrals] = useState<Referral[]>(INITIAL_REFERRALS);
  const [autoDaubEnabled, setAutoDaubEnabled] = useState<boolean>(true);
  const [language, setLanguageState] = useState<Language>('en');

  // Load persisted language from localStorage or Telegram WebApp
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('hyperbingo_lang');
      if (savedLang === 'en' || savedLang === 'am') {
        setLanguageState(savedLang);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('hyperbingo_lang', newLang);
    } catch {
      // ignore
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'register' | 'login'>('register');

  const [lotterySoldMap, setLotterySoldMap] = useState<Record<string, Set<number>>>(
    () => getInitialLotterySoldMap(INITIAL_GAMES)
  );

  const isLoggedIn = Boolean(user);

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || translations['en'][key] || String(key);
  };
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  const addNotification = (title: string, body: string, type: 'success' | 'info' | 'warning' | 'win' = 'info') => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const notif: NotificationMessage = {
      id,
      title,
      body,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 5)]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Restore saved session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Clear legacy mock test balances (250 ETB, etc.) so all user accounts start with real 20 ETB welcome bonus
      const cleanRealBalanceV3 = localStorage.getItem('hyper_bingo_clean_balance_v3');
      if (!cleanRealBalanceV3) {
        localStorage.removeItem('hyper_bingo_wallet');
        localStorage.setItem('hyper_bingo_clean_balance_v3', 'true');
      }

      const savedUserStr = localStorage.getItem('hyper_bingo_user');
      const savedWalletStr = localStorage.getItem('hyper_bingo_wallet');
      if (savedUserStr) {
        const savedUser: User = JSON.parse(savedUserStr);
        // Refresh admin role: check env whitelist OR existing DB admin status
        const isAdm = isAdminTelegramId(savedUser.telegramId) || isAdminTelegramId(savedUser.username) || savedUser.role === 'admin';
        savedUser.role = isAdm ? 'admin' : 'user';
        setUser(savedUser);
        if (savedWalletStr) {
          const parsedWallet: Wallet = JSON.parse(savedWalletStr);
          // Purge stale 250 ETB / 50 bonus mock data if present in legacy storage
          if (
            parsedWallet.availableBalance === 250 || 
            parsedWallet.winningBalance === 150 || 
            (parsedWallet.totalDeposited === 0 && parsedWallet.availableBalance > 0)
          ) {
            parsedWallet.availableBalance = 0;
            parsedWallet.winningBalance = 0;
            parsedWallet.bonusBalance = 20;
            localStorage.setItem('hyper_bingo_wallet', JSON.stringify(parsedWallet));
          }
          setWallet(parsedWallet);
        } else {
          setWallet({ ...INITIAL_WALLET, userId: savedUser.id });
        }

        // Live sync with server DB wallet & profile
        const query = savedUser.id ? `userId=${encodeURIComponent(savedUser.id)}` : savedUser.telegramId ? `telegramId=${encodeURIComponent(savedUser.telegramId)}` : `phone=${encodeURIComponent(savedUser.phone)}`;
        fetch(`/api/wallet?${query}`)
          .then((res) => res.json())
          .then((result) => {
            if (result.success && result.data?.wallet) {
              setWallet(result.data.wallet);
              localStorage.setItem('hyper_bingo_wallet', JSON.stringify(result.data.wallet));
              if (result.data.user) {
                setUser((prev) => (prev ? { ...prev, ...result.data.user } : prev));
                localStorage.setItem('hyper_bingo_user', JSON.stringify({ ...savedUser, ...result.data.user }));
              }
            }
          })
          .catch(() => {});
      } else {
        setWallet(INITIAL_WALLET);
      }
    } catch (e) {
      console.error('Error restoring session from localStorage:', e);
    }

    const syncTelegramUser = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (e) {}

        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
          const isAdm = isAdminTelegramId(tgUser.id) || (tgUser.username && isAdminTelegramId(tgUser.username));
          setUser((prev) => {
            if (prev) {
              const newTgId = String(tgUser.id);
              const targetRole = isAdm || prev.role === 'admin' ? 'admin' : prev.role;
              const updated = {
                ...prev,
                name: `${tgUser.first_name || ''}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`.trim() || prev.name,
                username: tgUser.username || prev.username,
                telegramId: newTgId,
                role: targetRole,
              };
              localStorage.setItem('hyper_bingo_user', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });

          // Check if user is promoted in DB to admin
          fetch('/api/auth/verify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: tgUser.id }),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.data?.isAdmin) {
                setUser((prev) => {
                  if (prev && prev.role !== 'admin') {
                    const updated = { ...prev, role: 'admin' as UserRole };
                    localStorage.setItem('hyper_bingo_user', JSON.stringify(updated));
                    return updated;
                  }
                  return prev;
                });
              }
            })
            .catch(() => {});

          return true;
        }
      }
      return false;
    };

    syncTelegramUser();
    const interval = setInterval(syncTelegramUser, 400);
    const timer = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  const openAuthModal = (mode: 'register' | 'login' = 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const registerAccount = async (data: {
    name: string;
    phone: string;
    username?: string;
    telegramId?: string;
    referralCode?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success && result.data?.user) {
        const newUser: User = result.data.user;
        const newWallet: Wallet = result.data.wallet || {
          userId: newUser.id,
          availableBalance: 0,
          bonusBalance: 20, // 20 ETB welcome bonus
          winningBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
        };
        setUser(newUser);
        setWallet(newWallet);
        if (typeof window !== 'undefined') {
          localStorage.setItem('hyper_bingo_user', JSON.stringify(newUser));
          localStorage.setItem('hyper_bingo_wallet', JSON.stringify(newWallet));
        }
        setIsAuthModalOpen(false);
        addNotification(
          '🎉 Account Created!',
          `Welcome, ${newUser.name}! 20 ETB game bonus added. Welcome notification sent via Telegram & SMS!`,
          'success'
        );
        return { success: true };
      } else {
        return { success: false, message: result.error || 'Registration failed' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      return { success: false, message: msg };
    }
  };

  const loginAccount = async (identifier: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const result = await res.json();
      if (result.success && result.data?.user) {
        const loggedUser: User = result.data.user;
        const loggedWallet: Wallet = result.data.wallet || {
          userId: loggedUser.id,
          availableBalance: 0,
          bonusBalance: 20, // 20 ETB welcome bonus
          winningBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
        };
        setUser(loggedUser);
        setWallet(loggedWallet);
        if (typeof window !== 'undefined') {
          localStorage.setItem('hyper_bingo_user', JSON.stringify(loggedUser));
          localStorage.setItem('hyper_bingo_wallet', JSON.stringify(loggedWallet));
        }
        setIsAuthModalOpen(false);
        addNotification('👋 Welcome Back!', `Logged in as ${loggedUser.name}`, 'success');
        return { success: true };
      } else {
        return { success: false, message: result.error || 'Account not found' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    setUser(null);
    setWallet(EMPTY_WALLET);
    setUserCards([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hyper_bingo_user');
      localStorage.removeItem('hyper_bingo_wallet');
    }
    addNotification('Logged Out', 'You have been signed out of your account.', 'info');
  };

  const verifyAdminAccess = async (
    identifier: string
  ): Promise<{ success: boolean; isAdmin: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const result = await res.json();
      if (result.success && result.data?.isAdmin) {
        const adminTgId = String(identifier).trim().replace(/^@/, '');
        setUser((prev) => {
          const updated: User = prev
            ? { ...prev, role: 'admin', telegramId: adminTgId }
            : {
                id: `adm_${adminTgId}`,
                name: 'Verified Admin',
                phone: '',
                telegramId: adminTgId,
                username: `admin_${adminTgId}`,
                role: 'admin',
                status: 'active',
                referralCode: 'ADMIN',
                createdAt: new Date().toISOString(),
              };
          if (typeof window !== 'undefined') {
            localStorage.setItem('hyper_bingo_user', JSON.stringify(updated));
          }
          return updated;
        });
        addNotification('🛡️ Admin Verified', 'Administrator access granted.', 'success');
        return { success: true, isAdmin: true };
      } else {
        return {
          success: false,
          isAdmin: false,
          message: `Telegram ID or username "${identifier}" is not configured as an administrator in .env`,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      return { success: false, isAdmin: false, message: msg };
    }
  };

  const toggleAutoDaub = () => setAutoDaubEnabled((prev) => !prev);

  const toggleUserRole = () => {
    // Only users whose Telegram ID or username is configured in .env can toggle Admin privileges
    if (!user || (!isAdminTelegramId(user.telegramId) && !isAdminTelegramId(user.username))) {
      addNotification('Access Restricted', 'Your Telegram ID is not configured as an administrator in .env.', 'warning');
      return;
    }
    setUser((prev) => (prev ? {
      ...prev,
      role: prev.role === 'admin' ? 'user' : 'admin',
    } : null));
  };

  const setUserRole = (role: UserRole) => {
    if (role === 'admin' && (!user || (!isAdminTelegramId(user.telegramId) && !isAdminTelegramId(user.username)))) {
      addNotification('Access Restricted', 'Your Telegram ID is not configured as an administrator in .env.', 'warning');
      return;
    }
    setUser((prev) => (prev ? { ...prev, role } : null));
  };

  const updateUserRoleInDb = async (targetUserId: string, role: UserRole): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminTelegramId: user?.telegramId || user?.username || 'admin',
          targetUserId,
          role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification(
          language === 'am' ? 'የአስተዳዳሪ ፈቃድ ተስተካክሏል' : 'Admin Role Updated',
          data.message || `User role updated to ${role.toUpperCase()}`,
          'success'
        );
        return { success: true, message: data.message };
      } else {
        addNotification('Role Update Failed', data.error || 'Could not update role', 'warning');
        return { success: false, message: data.error };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error updating role';
      return { success: false, message: msg };
    }
  };

  const addAdminByIdentifier = async (identifier: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminTelegramId: user?.telegramId || user?.username || 'admin',
          identifier,
          role: 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification(
          language === 'am' ? 'አዲስ አስተዳዳሪ ተጨምሯል' : 'Admin Added Successfully',
          data.message || `Administrator privileges granted to ${identifier}`,
          'success'
        );
        return { success: true, message: data.message };
      } else {
        addNotification('Failed to Add Admin', data.error || 'User not found', 'warning');
        return { success: false, message: data.error };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error adding admin';
      return { success: false, message: msg };
    }
  };

  const creditBonusBalance = (amount: number, reason: string) => {
    setWallet((prev) => ({
      ...prev,
      bonusBalance: prev.bonusBalance + amount,
    }));
    addNotification(
      language === 'am' ? '🎁 የቦነስ ሂሳብ ተጨምሯል!' : '🎁 Bonus Credited!',
      language === 'am'
        ? `${amount} ብር ቦነስ ወደ ሂሳብዎ ተጨምሯል (${reason})`
        : `${amount} ETB bonus added to your balance (${reason})`,
      'success'
    );
  };


  // 1. DEPOSIT FLOW
  const depositWallet = async (amount: number, provider: PaymentProvider, reference: string): Promise<boolean> => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'Please open an account or sign in to deposit funds.', 'warning');
      return false;
    }

    // Simulate backend payment verification API delay
    await new Promise((res) => setTimeout(res, 800));

    const newTxId = `TX_${Date.now().toString().slice(-6)}`;
    const newBalance = wallet.availableBalance + amount;

    const newTx: Transaction = {
      id: newTxId,
      userId: user.id,
      username: user.username,
      type: 'DEPOSIT',
      amount,
      balanceAfter: newBalance,
      reference,
      paymentProvider: provider,
      status: 'COMPLETED',
      description: `${provider} Instant Deposit Verified`,
      createdAt: new Date().toISOString(),
    };

    setWallet((prev) => ({
      ...prev,
      availableBalance: prev.availableBalance + amount,
      totalDeposited: prev.totalDeposited + amount,
    }));

    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '💳 Deposit Confirmed!',
      `Successfully credited ${amount} ETB via ${provider}. Ref: ${reference}`,
      'success'
    );

    return true;
  };

  // 1b. SUBMIT PENDING DEPOSIT (Secure deposit request awaiting owner approval)
  const submitPendingDeposit = async (
    amount: number,
    provider: PaymentProvider,
    reference: string,
    transactionCode?: string
  ): Promise<boolean> => {
    if (!user) {
      openAuthModal('register');
      return false;
    }

    const code = transactionCode || reference;
    const newTxId = `TX_${Date.now().toString().slice(-6)}`;

    const newTx: Transaction = {
      id: newTxId,
      userId: user.id,
      username: user.username,
      type: 'DEPOSIT',
      amount,
      balanceAfter: wallet.availableBalance, // NOT credited yet!
      reference: code,
      paymentProvider: provider,
      status: 'PENDING',
      description: `Deposit via ${provider} (Ref: ${code})`,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '⏳ Deposit Submitted for Verification',
      `Your deposit of ${amount} ETB via ${provider} (Code: ${code}) has been submitted. The owner has been notified to verify your transaction code and credit your balance shortly.`,
      'info'
    );

    return true;
  };

  // 2. WITHDRAWAL — reserve balance, PENDING until admin sends payout (or gateway if enabled)
  const requestWithdrawal = async (
    amount: number,
    provider: PaymentProvider,
    accountNumber: string,
    accountName: string
  ): Promise<boolean> => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'Please open an account or sign in to withdraw funds.', 'warning');
      return false;
    }

    const withdrawable = wallet.availableBalance + wallet.winningBalance;
    if (withdrawable < amount) {
      const totalBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
      if (totalBalance >= amount && wallet.bonusBalance > 0) {
        addNotification(
          '⚠️ Cannot Withdraw Bonus',
          `Your welcome bonus is play-only and cannot be withdrawn. Deposit real ETB to withdraw winnings.`,
          'warning'
        );
      } else {
        addNotification(
          '⚠️ Insufficient Balance',
          `You need at least ${amount} ETB withdrawable (available + winnings). Current: ${withdrawable.toFixed(0)} ETB.`,
          'warning'
        );
      }
      return false;
    }

    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount, paymentMethod: provider, accountNumber, accountName }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        addNotification('❌ Withdrawal Failed', data.error || 'Could not process withdrawal. Please try again.', 'error');
        return false;
      }

      const withdrawalId = data.data?.withdrawalId as string | undefined;
      const query = user.id ? `userId=${encodeURIComponent(user.id)}` : '';
      if (query) {
        const walletRes = await fetch(`/api/wallet?${query}`).then((r) => r.json()).catch(() => null);
        if (walletRes?.success && walletRes.data?.wallet) {
          setWallet(walletRes.data.wallet);
          localStorage.setItem('hyper_bingo_wallet', JSON.stringify(walletRes.data.wallet));
        }
      }

      const newWdRequest: WithdrawalRequest = {
        id: withdrawalId ?? `req_${Date.now().toString().slice(-6)}`,
        transactionId: withdrawalId ?? `tx_${Date.now()}`,
        userId: user.id,
        username: user.username,
        amount,
        paymentMethod: provider,
        accountNumber,
        accountName,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      setWithdrawals((prev) => [newWdRequest, ...prev]);

      addNotification(
        '✅ Withdrawal submitted',
        `${amount} ETB reserved pending admin payout to ${provider} (${accountNumber}).`,
        'success'
      );

      return true;
    } catch (err) {
      console.error('[requestWithdrawal] Error:', err);
      addNotification('❌ Withdrawal Error', 'Network error. Please try again.', 'error');
      return false;
    }
  };

  // 3. ADMIN APPROVE WITHDRAWAL (manual Telebirr/CBE payout or optional gateway)
  const approveWithdrawal = async (withdrawalId: string, adminName: string, payoutReference?: string) => {
    const wd = withdrawals.find((w) => w.id === withdrawalId);
    if (!wd || wd.status !== 'PENDING') return;

    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId,
          action: 'APPROVE',
          mode: 'manual',
          adminName,
          payoutReference,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addNotification('❌ Withdrawal', data.error ?? 'Could not complete withdrawal.', 'error');
        return;
      }
    } catch {
      addNotification('❌ Withdrawal', 'Network error approving withdrawal.', 'error');
      return;
    }

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === withdrawalId
          ? { ...w, status: 'COMPLETED', payoutReference, processedBy: adminName }
          : w
      )
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === wd.transactionId ? { ...t, status: 'COMPLETED' } : t))
    );

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      adminUsername: adminName,
      action: 'APPROVE_WITHDRAWAL',
      target: `${wd.username} (${wd.amount} ETB)`,
      amount: wd.amount,
      ipAddress: '196.188.42.10',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addNotification(
      '✅ Withdrawal Approved!',
      `Withdrawal of ${wd.amount} ETB marked complete${payoutReference ? ` (ref: ${payoutReference})` : ''}.`,
      'success'
    );
  };

  // 4. ADMIN REJECT WITHDRAWAL — refunds reserved balance on server
  const rejectWithdrawal = async (withdrawalId: string, adminName: string) => {
    const wd = withdrawals.find((w) => w.id === withdrawalId);
    if (!wd || wd.status !== 'PENDING') return;

    try {
      await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action: 'REJECT', adminName }),
      });
    } catch {}

    setWithdrawals((prev) =>
      prev.map((w) => (w.id === withdrawalId ? { ...w, status: 'FAILED' } : w))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === wd.transactionId ? { ...t, status: 'FAILED' } : t))
    );

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      adminUsername: adminName,
      action: 'REJECT_WITHDRAWAL',
      target: `${wd.username} (${wd.amount} ETB)`,
      amount: wd.amount,
      ipAddress: '196.188.42.10',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addNotification(
      '❌ Withdrawal Rejected',
      `Withdrawal of ${wd.amount} ETB rejected. Reserved funds returned to wallet.`,
      'warning'
    );
  };

  const refreshFinanceQueue = async () => {
    try {
      const [depRes, wdrRes] = await Promise.all([
        fetch('/api/admin/deposits'),
        fetch('/api/admin/withdrawals'),
      ]);
      const depJson = await depRes.json();
      const wdrJson = await wdrRes.json();
      if (depJson.success && Array.isArray(depJson.data)) {
        setTransactions((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          for (const tx of depJson.data as Transaction[]) {
            map.set(tx.id, { ...map.get(tx.id), ...tx });
          }
          return [...map.values()].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
      if (wdrJson.success && Array.isArray(wdrJson.data)) {
        setWithdrawals((prev) => {
          const map = new Map(prev.map((w) => [w.id, w]));
          for (const w of wdrJson.data as WithdrawalRequest[]) {
            map.set(w.id, { ...map.get(w.id), ...w });
          }
          return [...map.values()].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    } catch {
      /* ignore */
    }
  };

  // 4b. ADMIN APPROVE DEPOSIT
  const approveDeposit = async (transactionId: string, adminName: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx || tx.status !== 'PENDING') return;

    // Optimistically mark as COMPLETED immediately so the button disappears
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'COMPLETED' } : t))
    );

    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, action: 'APPROVE', adminName }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        // Sync with exact server state
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, ...json.data, status: 'COMPLETED' } : t))
        );
      } else if (!json.success) {
        // Revert on failure
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, status: 'PENDING' } : t))
        );
        addNotification('❌ Approval Failed', json.error ?? 'Could not approve deposit.', 'error');
        return;
      }
    } catch {
      // Revert on network error
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, status: 'PENDING' } : t))
      );
      addNotification('❌ Approval Failed', 'Network error. Please try again.', 'error');
      return;
    }

    setWallet((prev) => ({
      ...prev,
      availableBalance: prev.availableBalance + tx.amount,
      totalDeposited: prev.totalDeposited + tx.amount,
    }));

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      adminUsername: adminName,
      action: 'APPROVE_DEPOSIT',
      target: `${tx.username} (${tx.amount} ETB via ${tx.paymentProvider})`,
      amount: tx.amount,
      ipAddress: '196.188.42.10',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addNotification(
      '✅ Deposit Approved!',
      `Deposit of ${tx.amount} ETB via ${tx.paymentProvider} approved. Balance credited!`,
      'success'
    );

    // Refresh the full queue so the table is in sync with DB
    refreshFinanceQueue();
  };

  // 4c. ADMIN REJECT DEPOSIT
  const rejectDeposit = async (transactionId: string, adminName: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    // Optimistically mark as FAILED so the button disappears
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'FAILED' } : t))
    );

    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, action: 'REJECT', adminName }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert on failure
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, status: 'PENDING' } : t))
        );
        addNotification('❌ Rejection Failed', json.error ?? 'Could not reject deposit.', 'error');
        return;
      }
    } catch {
      // Revert on network error
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, status: 'PENDING' } : t))
      );
      addNotification('❌ Rejection Failed', 'Network error. Please try again.', 'error');
      return;
    }

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      adminUsername: adminName,
      action: 'REJECT_DEPOSIT',
      target: `${tx.username} (${tx.amount} ETB via ${tx.paymentProvider})`,
      amount: tx.amount,
      ipAddress: '196.188.42.10',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addNotification(
      '❌ Deposit Rejected',
      `Deposit of ${tx.amount} ETB was rejected.`,
      'warning'
    );

    // Refresh the full queue so the table is in sync with DB
    refreshFinanceQueue();
  };

  // 5. JOIN GAME (supports chosen 5-digit card numbers like '12608', '11302')
  const joinGame = (gameId: string, chosenCardNumbers?: string[]): boolean => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'You must open an account to purchase cards and play.', 'warning');
      return false;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) return false;

    // Slot max 5: cap cards to at most 5
    const rawCards = chosenCardNumbers && chosenCardNumbers.length > 0 ? chosenCardNumbers : [String(Math.floor(10000 + Math.random() * 90000))];
    const cardsToCreate = rawCards.slice(0, 5);
    const totalCost = targetGame.entryPrice * cardsToCreate.length;

    // Bonus balance is playable (can play but cannot withdraw)
    const playableBalance = wallet.availableBalance + wallet.bonusBalance;
    if (playableBalance < totalCost) {
      addNotification(
        '⚠️ Insufficient Balance',
        `Required ${totalCost} ETB for ${cardsToCreate.length} card(s). Playable balance: ${(playableBalance).toFixed(0)} ETB (inc. bonus).`,
        'warning'
      );
      return false;
    }

    // Deduct from bonus balance first, then available balance
    let remCost = totalCost;
    let newBonus = wallet.bonusBalance;
    let newAvailable = wallet.availableBalance;

    if (newBonus >= remCost) {
      newBonus -= remCost;
      remCost = 0;
    } else {
      remCost -= newBonus;
      newBonus = 0;
      newAvailable = Math.max(0, newAvailable - remCost);
    }

    setWallet((prev) => ({
      ...prev,
      availableBalance: newAvailable,
      bonusBalance: newBonus,
    }));

    // Create entry transaction
    const tx: Transaction = {
      id: `TX_ENTRY_${Date.now().toString().slice(-5)}`,
      userId: user.id,
      username: user.username,
      type: 'GAME_ENTRY',
      amount: -totalCost,
      balanceAfter: newAvailable,
      reference: `GM-${targetGame.id}`,
      status: 'COMPLETED',
      description: `Entry ticket (${cardsToCreate.length} cards, max 5 slots) for ${targetGame.name}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    // Update game player count
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, currentPlayers: g.currentPlayers + 1 } : g))
    );

    // Generate fresh cards for user
    const newCards = cardsToCreate.map((cNum) => createNewBingoCard(gameId, user.id, cNum));
    setUserCards((prev) => [...prev.filter((c) => c.gameId !== gameId), ...newCards]);

    setActiveGameId(gameId);

    addNotification(
      '🎟️ Cards Purchased!',
      `You joined ${targetGame.name} with ${cardsToCreate.length} card(s) (Slots: ${cardsToCreate.join(', ')}). Good luck!`,
      'success'
    );

    return true;
  };

  // Add individual card to existing game session (max 5 slots)
  const addCardToGame = (gameId: string, cardNumber: string): boolean => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'You must open an account to purchase cards.', 'warning');
      return false;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) return false;

    // Slot max 5 check
    const currentCardsCount = userCards.filter((c) => c.gameId === gameId).length;
    if (currentCardsCount >= 5) {
      addNotification('⚠️ Max 5 Slots', 'Maximum 5 cards/slots allowed per game.', 'warning');
      return false;
    }

    const playableBalance = wallet.availableBalance + wallet.bonusBalance;
    if (playableBalance < targetGame.entryPrice) {
      addNotification('⚠️ Insufficient Balance', `Card cost is ${targetGame.entryPrice} ETB.`, 'warning');
      return false;
    }

    // Deduct cost from bonus first
    let remCost = targetGame.entryPrice;
    let newBonus = wallet.bonusBalance;
    let newAvailable = wallet.availableBalance;

    if (newBonus >= remCost) {
      newBonus -= remCost;
    } else {
      remCost -= newBonus;
      newBonus = 0;
      newAvailable = Math.max(0, newAvailable - remCost);
    }

    setWallet((prev) => ({
      ...prev,
      availableBalance: newAvailable,
      bonusBalance: newBonus,
    }));

    // Generate new card
    const newCard = createNewBingoCard(gameId, user.id, cardNumber);
    setUserCards((prev) => [...prev, newCard]);

    addNotification('🎟️ Card Added!', `Added card #${cardNumber} (Slot ${currentCardsCount + 1}/3).`, 'success');
    return true;
  };


  // Remove a single card from the player's hand for this game
  const removeCard = (cardId: string) => {
    const card = userCards.find((c) => c.id === cardId);
    if (!card) return;
    setUserCards((prev) => prev.filter((c) => c.id !== cardId));
    addNotification('🗑️ Card Removed', `Card #${card.cardNumber} removed from your hand.`, 'info');
  };

  // 6. CREATE GAME (ADMIN)
  //    · Weekend/Lottery games → use the prizePool passed in by admin (owner-set fixed prize)
  //    · Regular games        → use PrizePool = 0 and compute live at render:
  //                              PrizePool = round(Players × Price × 0.80)
  const createGame = (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => {
    const isWeekend = !!gameData.isWeekendSpecial || gameData.gameType === 'WEEKEND_LOTTERY';
    const enforcedPrize = isWeekend
      ? Math.round(gameData.prizePool || 0)
      : 0; // Regular games → compute live in getGameLivePrizePool (players × price × 0.80)

    const newGame: Game = {
      ...gameData,
      prizePool: enforcedPrize,
      id: `gm_${Date.now().toString().slice(-4)}`,
      currentPlayers: 1,
      drawnNumbers: [],
      winners: [],
      createdAt: new Date().toISOString(),
    };

    setGames((prev) => [newGame, ...prev]);

    const audit: AuditLog = {
      id: `aud_${Date.now()}`,
      adminUsername: 'super_admin',
      action: 'CREATE_GAME',
      target: newGame.name,
      amount: newGame.prizePool,
      ipAddress: '196.188.42.1',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [audit, ...prev]);

    addNotification(
      '🎮 New Game Configured',
      `Created ${newGame.name} with $${newGame.entryPrice} entry ${
        isWeekend
          ? `→ $${newGame.prizePool.toLocaleString()} FIXED Prize (owner-set weekend draw).`
          : `→ LIVE Prize = (Players × ${newGame.entryPrice} × 80%) — Owner keeps 20%.`
      }`,
      'info'
    );
  };

  // 7. UPDATE GAME STATUS (ADMIN)
  const updateGameStatus = (gameId: string, status: GameStatus) => {
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, status } : g))
    );
  };

  // 8. DAUB CELL
  const daubCell = (cardId: string, row: number, col: number) => {
    setUserCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        const newMarked = card.marked.map((r, rIdx) =>
          r.map((val, cIdx) => (rIdx === row && cIdx === col ? !val : val))
        );
        return { ...card, marked: newMarked };
      })
    );
  };

  // 8b. BLOCK CARD (Penalty for false bingo claims)
  const blockCard = (gameId: string, cardNumber: string) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== gameId) return g;
        const currentBlocked = g.blockedCards || [];
        if (currentBlocked.includes(cardNumber)) return g;
        return {
          ...g,
          blockedCards: [...currentBlocked, cardNumber],
        };
      })
    );
  };

  // 8c. RESET GAME ROUND (Fresh 75-ball table for new round)
  const resetGameRound = (gameId: string) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== gameId) return g;
        const isSpecial = g.category === 'HYPER_SPECIAL' || g.gameType === 'HYPER_SPECIAL';
        const nextSpecialIndex = isSpecial
          ? ((g.activeSpecialRuleIndex ?? 0) + 1) % HYPER_SPECIAL_RULES.length
          : g.activeSpecialRuleIndex;
        return {
          ...g,
          drawnNumbers: [],
          currentBall: null,
          blockedCards: [],
          winners: [],
          status: 'RUNNING',
          activeSpecialRuleIndex: nextSpecialIndex,
        };
      })
    );
    // 1-Game Card Rule: Cards are valid for ONE game only!
    // After the game finishes, player must purchase new cards for the next round
    setUserCards((prev) => prev.filter((card) => card.gameId !== gameId));
  };

  // Explicitly clear consumed cards from a finished game
  const clearConsumedCards = (gameId: string) => {
    setUserCards((prev) => prev.filter((card) => card.gameId !== gameId));
  };

  // 9. CLAIM BINGO
  const claimBingo = (cardId: string): { success: boolean; message: string; prize?: number } => {
    if (!user) {
      openAuthModal('register');
      return { success: false, message: 'Please open an account to claim winnings.' };
    }

    const card = userCards.find((c) => c.id === cardId);
    if (!card) return { success: false, message: 'Card not found' };

    const game = games.find((g) => g.id === card.gameId);
    if (!game) return { success: false, message: 'Game not found' };

    // Check if card is already blocked
    if (game.blockedCards?.includes(card.cardNumber)) {
      return {
        success: false,
        message: `🚫 Card #${card.cardNumber} is blocked in this round due to an invalid claim.`,
      };
    }

    // ---- WINNING RULE CHECK ACCORDING TO GAME CATEGORY / RULE ----
    // Hyper Fetan: 1 Horizontal, 1 Vertical, 1 Diagonal, 4 Corners (No Full House, No X, No 2 Horizontal)
    // Hyper Weekend: Full House Only
    // Hyper Special: Specific active rule for this game round until finished
    const bestRule: WinningRuleMatch | null = getBestWinningRule(card.marked, game.winningRule, game.activeSpecialRuleIndex);

    if (!bestRule) {
      blockCard(game.id, card.cardNumber);
      const isAm = language === 'am';
      const ruleDesc = game.winningRule === 'ONE_LINE_OR_CORNERS'
        ? (isAm ? '1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት' : '1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners')
        : game.winningRule === 'FULL_HOUSE_ONLY'
        ? (isAm ? 'ሙሉ ቤት (Full House Only)' : 'Full House Only')
        : (() => {
            const activeRule = HYPER_SPECIAL_RULES[Math.abs(game.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
            return isAm ? activeRule.nameAm : activeRule.nameEn;
          })();

      addNotification(
        '🚫 BLOCKED! False Bingo Claim',
        `Card #${card.cardNumber} shouted Bingo without ${ruleDesc}.`,
        'warning'
      );
      return {
        success: false,
        message: `🚫 BLOCKED! Card #${card.cardNumber} shouted Bingo without ${ruleDesc}.`,
      };
    }

    // ---- PRIZE LOGIC (business rule) ------------------------------------------
    const totalCollected = Math.max(0, (game.entryPrice || 0) * Math.max(0, game.currentPlayers || 0));
    const ownerCut = Math.round(totalCollected * OWNER_CUT_PCT); // 20% owner (internal only)
    const isWeekend = !!game.isWeekendSpecial || game.gameType === 'WEEKEND_LOTTERY';
    const totalPrizePoolForWinners = isWeekend
      ? Math.round(game.prizePool || 0)
      : Math.round(totalCollected * WINNERS_CUT_PCT);

    const alreadyWonUsernames = new Set(game.winners.map(w => w.username));
    const newWinnerCount = alreadyWonUsernames.has(user.username)
      ? game.winners.length
      : game.winners.length + 1;
    const winnersN = Math.max(1, newWinnerCount);
    const perWinnerShare = Math.round(totalPrizePoolForWinners / winnersN);

    const patternName = `${bestRule.label} (${bestRule.labelAm})`;
    const calculatedPrize = perWinnerShare;
    const winBall = game.currentBall || (game.drawnNumbers.length > 0 ? game.drawnNumbers[game.drawnNumbers.length - 1] : 75);

    // Record winner in game with card number & winning ball
    const winRecord: WinnerRecord = {
      userId: user.id,
      username: user.username,
      cardNumber: card.cardNumber,
      winningBall: winBall,
      pattern: patternName,
      prizeWon: calculatedPrize,
      claimedAt: new Date().toISOString(),
    };

    setGames((prev) =>
      prev.map((g) =>
        g.id === game.id
          ? {
              ...g,
              status: 'COMPLETED',
              winners: [...g.winners, winRecord],
            }
          : g
      )
    );

    // 1-Game Card Rule: All cards played in this game are now marked used for this round
    setUserCards((prev) =>
      prev.map((c) => (c.gameId === game.id ? { ...c, isUsed: true, roundCompleted: true } : c))
    );

    // Update user wallet & transaction record
    const newWinningBalance = wallet.winningBalance + calculatedPrize;
    const newAvailableBalance = wallet.availableBalance + calculatedPrize;

    setWallet((prev) => ({
      ...prev,
      winningBalance: newWinningBalance,
      availableBalance: newAvailableBalance,
    }));

    const tx: Transaction = {
      id: `TX_WIN_${Date.now().toString().slice(-5)}`,
      userId: user.id,
      username: user.username,
      type: 'GAME_WIN',
      amount: calculatedPrize,
      balanceAfter: newAvailableBalance,
      reference: `WIN-${patternName.toUpperCase()}`,
      status: 'COMPLETED',
      description:
        `BINGO Winner! ${patternName} with Card #${card.cardNumber} in ${game.name}.` +
        (winnersN > 1 ? ` Split ${winnersN} ways.` : ''),
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    // ── REFERRAL WIN COMMISSION (1% of Owner Profit to Inviter) ──
    const ownerProfit = Math.max(0, totalCollected - totalPrizePoolForWinners) || Math.round(ownerCut || 0);
    const inviterCommission = Math.max(1, Math.round(ownerProfit * 0.01 * 100) / 100);

    if (user.referredBy) {
      const referrerCode = user.referredBy;
      const refTx: Transaction = {
        id: `TX_REF_WIN_${Date.now().toString().slice(-5)}`,
        userId: `ref_${referrerCode}`,
        username: `Referrer (${referrerCode})`,
        type: 'REFERRAL_BONUS',
        amount: inviterCommission,
        balanceAfter: inviterCommission,
        reference: `REF-WIN-${game.id}`,
        status: 'COMPLETED',
        description: `1% Owner Profit Commission from referral @${user.username} win in ${game.name} (Playable Bonus Only)`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [refTx, ...prev]);

      fetch('/api/referrals/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerCode,
          referredUsername: user.username,
          gameName: game.name,
          ownerProfit,
          commissionAmount: inviterCommission,
        }),
      }).catch((e) => console.error('[Referral Commission API] Error:', e));

      addNotification(
        '🎁 Inviter Commission Awarded!',
        `Your inviter (${referrerCode}) received ${inviterCommission} ETB (1% of house profit) into their play-only bonus wallet!`,
        'success'
      );
    }

    addNotification(
      '🏆 BINGO WINNER! 🏆',
      (winnersN > 1
        ? `🎉 Split win with ${winnersN} winners! You get `
        : `🎉 Congratulations! `) +
      `${calculatedPrize} ETB with Card #${card.cardNumber} (${patternName}).`,
      'win'
    );

    return {
      success: true,
      message: `🎉 BINGO! Card #${card.cardNumber} won ${calculatedPrize} ETB (${patternName})${winnersN > 1 ? ` (split among ${winnersN} winners)` : ''}!`,
      prize: calculatedPrize,
    };
  };

  // 10. REAL-TIME DRAW NEXT BALL
  const drawNextBall = (gameId: string): number | null => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return null;

    const drawnSet = new Set(game.drawnNumbers);
    if (drawnSet.size >= 75) return null;

    // Pick random un-drawn number between 1 and 75
    const remaining: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!drawnSet.has(i)) remaining.push(i);
    }

    const nextBall = remaining[Math.floor(Math.random() * remaining.length)];
    const updatedDrawn = [...game.drawnNumbers, nextBall];

    setGames((prev) =>
      prev.map((g) =>
        g.id === gameId
          ? {
              ...g,
              drawnNumbers: updatedDrawn,
              currentBall: nextBall,
              status: g.status === 'STARTING' || g.status === 'OPEN' ? 'RUNNING' : g.status,
            }
          : g
      )
    );

    // Auto Daub if enabled
    if (autoDaubEnabled) {
      setUserCards((prev) =>
        prev.map((card) => {
          if (card.gameId !== gameId) return card;
          const newMarked = card.marked.map((row, rIdx) =>
            row.map((val, cIdx) => {
              const num = card.numbers[rIdx][cIdx];
              return num === nextBall || (rIdx === 2 && cIdx === 2) ? true : val;
            })
          );
          return { ...card, marked: newMarked };
        })
      );
    }

    return nextBall;
  };

  // 11. WEEKEND LOTTERY: Get sold numbers for a game
  const getLotterySoldNumbers = (gameId: string): Set<number> => {
    return lotterySoldMap[gameId] || new Set<number>();
  };

  // 12. WEEKEND LOTTERY: Purchase a set of numbers (slots)
  const purchaseLotteryNumbers = (
    gameId: string,
    numbers: number[]
  ): { success: boolean; message: string; purchased?: string[] } => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'Open an account to purchase weekend lottery cards.', 'warning');
      return { success: false, message: 'Account required.' };
    }
    if (!numbers || numbers.length === 0) {
      return { success: false, message: 'No numbers selected.' };
    }

    const game = games.find((g) => g.id === gameId);
    if (!game) return { success: false, message: 'Game not found.' };

    const soldSet = new Set(lotterySoldMap[gameId] || []);
    const invalidNums: number[] = [];
    const alreadySold: number[] = [];
    const maxNumbersForGame = (game.category === 'HYPER_FETAN' || game.name?.includes('Fetan') || game.id.includes('fetan')) ? 500 : LOTTERY_NUMBERS_TOTAL;
    numbers.forEach((n) => {
      if (n < 1 || n > maxNumbersForGame || !Number.isInteger(n)) invalidNums.push(n);
      else if (soldSet.has(n)) alreadySold.push(n);
    });
    if (invalidNums.length > 0) {
      return {
        success: false,
        message: `Invalid numbers: ${invalidNums.join(', ')} (must be 1–${maxNumbersForGame}).`,
      };
    }
    if (alreadySold.length > 0) {
      return {
        success: false,
        message: `Numbers already sold: ${alreadySold.join(', ')}.`,
      };
    }

    const totalCost = calcLotteryTotalCost(numbers.length, game.entryPrice);
    const playable = wallet.availableBalance + wallet.bonusBalance;
    if (playable < totalCost) {
      addNotification(
        '⚠️ Insufficient Balance',
        `Need ${totalCost} ETB for ${numbers.length} ticket(s). Playable balance: ${playable.toFixed(0)} ETB.`,
        'warning'
      );
      return { success: false, message: `Insufficient balance. Need ${totalCost} ETB.` };
    }

    // Deduct from wallet: bonus first, then available
    let rem = totalCost;
    let newBonus = wallet.bonusBalance;
    let newAvail = wallet.availableBalance;
    if (newBonus >= rem) {
      newBonus -= rem;
      rem = 0;
    } else {
      rem -= newBonus;
      newBonus = 0;
      newAvail = Math.max(0, newAvail - rem);
    }
    setWallet((prev) => ({
      ...prev,
      availableBalance: newAvail,
      bonusBalance: newBonus,
    }));

    // Record transaction
    const tx: Transaction = {
      id: `TX_LOTTERY_${Date.now().toString().slice(-5)}`,
      userId: user.id,
      username: user.username,
      type: 'GAME_ENTRY',
      amount: -totalCost,
      balanceAfter: newAvail,
      reference: `LOTTERY-${gameId}`,
      status: 'COMPLETED',
      description: `Weekend Lottery ticket purchase (${numbers.length} cards: ${numbers
        .map((n) => formatLotteryCardNumber(n))
        .join(', ')}) in ${game.name}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    // Mark numbers as sold
    setLotterySoldMap((prev) => {
      const current = new Set(prev[gameId] || []);
      numbers.forEach((n) => current.add(n));
      return { ...prev, [gameId]: current };
    });

    // Increment players counter
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, currentPlayers: g.currentPlayers + 1 } : g))
    );

    // Create corresponding bingo cards for purchased numbers (so game room shows them)
    const newCards = numbers.map((n) =>
      createNewBingoCard(gameId, user.id, formatLotteryCardNumber(n))
    );
    setUserCards((prev) => [
      ...prev.filter((c) => c.gameId !== gameId || !numbers.map((n) => formatLotteryCardNumber(n)).includes(c.cardNumber)),
      ...newCards,
    ]);

    const purchasedLabels = numbers.map((n) => formatLotteryCardNumber(n));
    addNotification(
      '🎟️ Lottery Tickets Purchased!',
      `Bought ${numbers.length} weekend lottery ticket(s): ${purchasedLabels.join(', ')}. Good luck!`,
      'success'
    );
    return {
      success: true,
      message: `Purchased ${numbers.length} ticket(s): ${purchasedLabels.join(', ')}`,
      purchased: purchasedLabels,
    };
  };

  return (
    <BingoContext.Provider
      value={{
        user,
        isLoggedIn,
        wallet,
        games,
        activeGameId,
        userCards,
        transactions,
        withdrawals,
        promotions,
        auditLogs,
        referrals,
        notifications,
        language,
        setLanguage,
        t,
        setActiveGameId,
        depositWallet,
        submitPendingDeposit,
        approveDeposit,
        rejectDeposit,
        requestWithdrawal,
        approveWithdrawal,
        rejectWithdrawal,
        refreshFinanceQueue,
        joinGame,
        addCardToGame,
        removeCard,
        createGame,
        updateGameStatus,
        daubCell,
        claimBingo,
        blockCard,
        resetGameRound,
        clearConsumedCards,
        drawNextBall,
        dismissNotification,
        addNotification,
        toggleAutoDaub,
        autoDaubEnabled,
        toggleUserRole,
        setUserRole,
        updateUserRoleInDb,
        addAdminByIdentifier,
        creditBonusBalance,
        getLotterySoldNumbers,
        purchaseLotteryNumbers,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        registerAccount,
        loginAccount,
        logout,
        verifyAdminAccess,
      }}
    >
      {children}
    </BingoContext.Provider>
  );

}

export function useBingo() {
  const context = useContext(BingoContext);
  if (!context) {
    throw new Error('useBingo must be used within a BingoProvider');
  }
  return context;
}
