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
  bonusBalance: 0,
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
  requestWithdrawal: (amount: number, provider: PaymentProvider, accountNumber: string, accountName: string) => Promise<boolean>;
  approveWithdrawal: (withdrawalId: string, adminName: string) => void;
  rejectWithdrawal: (withdrawalId: string, adminName: string) => void;
  joinGame: (gameId: string, chosenCardNumbers?: string[]) => boolean;
  addCardToGame: (gameId: string, cardNumber: string) => boolean;
  removeCard: (cardId: string) => void;
  createGame: (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => void;
  updateGameStatus: (gameId: string, status: GameStatus) => void;
  daubCell: (cardId: string, row: number, col: number) => void;
  claimBingo: (cardId: string) => { success: boolean; message: string; prize?: number };
  blockCard: (gameId: string, cardNumber: string) => void;
  drawNextBall: (gameId: string) => number | null;
  dismissNotification: (id: string) => void;
  addNotification: (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'win') => void;
  toggleAutoDaub: () => void;
  autoDaubEnabled: boolean;
  toggleUserRole: () => void;
  setUserRole: (role: UserRole) => void;
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
  const [activeGameId, setActiveGameId] = useState<string | null>('gm_small_05');
  const [userCards, setUserCards] = useState<BingoCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(INITIAL_WITHDRAWALS);
  const [promotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [referrals] = useState<Referral[]>(INITIAL_REFERRALS);
  const [autoDaubEnabled, setAutoDaubEnabled] = useState<boolean>(true);
  const [language, setLanguage] = useState<Language>('en');
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
      const savedUserStr = localStorage.getItem('hyper_bingo_user');
      const savedWalletStr = localStorage.getItem('hyper_bingo_wallet');
      if (savedUserStr) {
        const savedUser: User = JSON.parse(savedUserStr);
        // Refresh admin role strictly based on current env
        const isAdm = isAdminTelegramId(savedUser.telegramId) || isAdminTelegramId(savedUser.username);
        savedUser.role = isAdm ? 'admin' : 'user';
        setUser(savedUser);
        if (savedWalletStr) {
          setWallet(JSON.parse(savedWalletStr));
        } else {
          setWallet({ ...INITIAL_WALLET, userId: savedUser.id });
        }
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
              const targetRole = isAdm ? 'admin' : prev.role;
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
          bonusBalance: 20,
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
          bonusBalance: 0,
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

  // 2. WITHDRAWAL REQUEST FLOW
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

    if (wallet.availableBalance < amount) {
      // Check if they only have bonus balance to give a helpful message
      const totalBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
      if (totalBalance >= amount && wallet.bonusBalance > 0) {
        addNotification(
          '⚠️ Cannot Withdraw Bonus',
          `Your 20 ETB welcome bonus is play-only and cannot be withdrawn. Please deposit real ETB to withdraw.`,
          'warning'
        );
      } else {
        addNotification('⚠️ Insufficient Balance', `You need at least ${amount} ETB available to withdraw. Current available: ${wallet.availableBalance.toFixed(0)} ETB.`, 'warning');
      }
      return false;
    }

    await new Promise((res) => setTimeout(res, 600));

    const txId = `WD_${Date.now().toString().slice(-6)}`;
    const newBalance = wallet.availableBalance - amount;

    const newTx: Transaction = {
      id: txId,
      userId: user.id,
      username: user.username,
      type: 'WITHDRAWAL',
      amount: -amount,
      balanceAfter: newBalance,
      reference: `WD-${provider.substring(0, 3)}-${accountNumber.slice(-4)}`,
      paymentProvider: provider,
      status: 'PENDING',
      description: `Withdrawal to ${provider} (${accountNumber})`,
      createdAt: new Date().toISOString(),
    };

    const newWdRequest: WithdrawalRequest = {
      id: `req_${Date.now().toString().slice(-6)}`,
      transactionId: txId,
      userId: user.id,
      username: user.username,
      amount,
      paymentMethod: provider,
      accountNumber,
      accountName,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };


    setWallet((prev) => ({
      ...prev,
      availableBalance: prev.availableBalance - amount,
    }));

    setTransactions((prev) => [newTx, ...prev]);
    setWithdrawals((prev) => [newWdRequest, ...prev]);

    addNotification(
      '💸 Withdrawal Request Submitted',
      `Your request for ${amount} ETB to ${accountNumber} (${provider}) is pending admin review.`,
      'info'
    );

    return true;
  };

  // 3. ADMIN APPROVE WITHDRAWAL
  const approveWithdrawal = (withdrawalId: string, adminName: string) => {
    const wd = withdrawals.find((w) => w.id === withdrawalId);
    if (!wd) return;

    setWithdrawals((prev) =>
      prev.map((w) => (w.id === withdrawalId ? { ...w, status: 'COMPLETED' } : w))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === wd.transactionId ? { ...t, status: 'COMPLETED' } : t))
    );
    setWallet((prev) => ({
      ...prev,
      totalWithdrawn: prev.totalWithdrawn + wd.amount,
    }));

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
      `Admin approved your withdrawal of ${wd.amount} ETB to ${wd.paymentMethod}.`,
      'success'
    );
  };

  // 4. ADMIN REJECT WITHDRAWAL
  const rejectWithdrawal = (withdrawalId: string, adminName: string) => {
    const wd = withdrawals.find((w) => w.id === withdrawalId);
    if (!wd) return;

    setWithdrawals((prev) =>
      prev.map((w) => (w.id === withdrawalId ? { ...w, status: 'REJECTED' } : w))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === wd.transactionId ? { ...t, status: 'REJECTED' } : t))
    );

    // Refund wallet
    setWallet((prev) => ({
      ...prev,
      availableBalance: prev.availableBalance + wd.amount,
    }));

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
      `Your withdrawal request of ${wd.amount} ETB was rejected. Funds refunded to wallet.`,
      'warning'
    );
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

    // Slot max 3: cap cards to at most 3
    const rawCards = chosenCardNumbers && chosenCardNumbers.length > 0 ? chosenCardNumbers : [String(Math.floor(10000 + Math.random() * 90000))];
    const cardsToCreate = rawCards.slice(0, 3);
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
      description: `Entry ticket (${cardsToCreate.length} cards, max 3 slots) for ${targetGame.name}`,
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

  // Add individual card to existing game session (max 3 slots)
  const addCardToGame = (gameId: string, cardNumber: string): boolean => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'You must open an account to purchase cards.', 'warning');
      return false;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) return false;

    // Slot max 3 check
    const currentCardsCount = userCards.filter((c) => c.gameId === gameId).length;
    if (currentCardsCount >= 3) {
      addNotification('⚠️ Max 3 Slots', 'Maximum 3 cards/slots allowed per game.', 'warning');
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
  //                              PrizePool = round(Players × Price × 0.85)
  const createGame = (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => {
    const isWeekend = !!gameData.isWeekendSpecial || gameData.gameType === 'WEEKEND_LOTTERY';
    const enforcedPrize = isWeekend
      ? Math.round(gameData.prizePool || 0)
      : 0; // Regular games → compute live in getGameLivePrizePool (players × price × 0.85)

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
          : `→ LIVE Prize = (Players × ${newGame.entryPrice} × 85%) — Owner keeps 15%.`
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

    // ---- WINNING RULE CHECK ----
    // 4 Rules: 1 Line, 2 Lines, Letter X, Full House
    const bestRule: WinningRuleMatch | null = getBestWinningRule(card.marked);

    if (!bestRule) {
      blockCard(game.id, card.cardNumber);
      addNotification(
        '🚫 BLOCKED! Disqualified for False Bingo',
        `Card #${card.cardNumber} shouted Bingo without a winning pattern.`,
        'warning'
      );
      return {
        success: false,
        message: `🚫 BLOCKED! Card #${card.cardNumber} is now blocked for shouting Bingo without a winning pattern.`,
      };
    }

    // ---- PRIZE LOGIC (business rule) ------------------------------------------
    const totalCollected = Math.max(0, (game.entryPrice || 0) * Math.max(0, game.currentPlayers || 0));
    const ownerCut = Math.round(totalCollected * OWNER_CUT_PCT); // 15% owner (internal only)
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
    numbers.forEach((n) => {
      if (n < 1 || n > LOTTERY_NUMBERS_TOTAL || !Number.isInteger(n)) invalidNums.push(n);
      else if (soldSet.has(n)) alreadySold.push(n);
    });
    if (invalidNums.length > 0) {
      return {
        success: false,
        message: `Invalid numbers: ${invalidNums.join(', ')} (must be 1–${LOTTERY_NUMBERS_TOTAL}).`,
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
        requestWithdrawal,
        approveWithdrawal,
        rejectWithdrawal,
        joinGame,
        addCardToGame,
        removeCard,
        createGame,
        updateGameStatus,
        daubCell,
        claimBingo,
        blockCard,
        drawNextBall,
        dismissNotification,
        addNotification,
        toggleAutoDaub,
        autoDaubEnabled,
        toggleUserRole,
        setUserRole,
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
