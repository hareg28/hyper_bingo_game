'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, UserRole, Wallet, Game, BingoCard, Transaction, 
  WithdrawalRequest, Promotion, AuditLog, Referral, WinnerRecord, GameStatus, PaymentProvider 
} from '../lib/types';
import { 
  INITIAL_USER, INITIAL_WALLET, INITIAL_GAMES, 
  INITIAL_TRANSACTIONS, INITIAL_WITHDRAWALS, 
  INITIAL_PROMOTIONS, INITIAL_AUDIT_LOGS, INITIAL_REFERRALS, INITIAL_CARDS 
} from '../lib/store';
import { createNewBingoCard, checkLineWin, countCompletedLines, checkFullHouseWin } from '../lib/bingoUtils';
import { isAdminTelegramId } from '../lib/authUtils';

import { Language, translations } from '../lib/translations';

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
  createGame: (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => void;
  updateGameStatus: (gameId: string, status: GameStatus) => void;
  daubCell: (cardId: string, row: number, col: number) => void;
  claimBingo: (cardId: string) => { success: boolean; message: string; prize?: number };
  drawNextBall: (gameId: string) => number | null;
  dismissNotification: (id: string) => void;
  addNotification: (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'win') => void;
  toggleAutoDaub: () => void;
  autoDaubEnabled: boolean;
  toggleUserRole: () => void;
  setUserRole: (role: UserRole) => void;
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
  const [activeGameId, setActiveGameId] = useState<string | null>('gm_001');
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

  const isLoggedIn = Boolean(user);

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || translations['en'][key] || String(key);
  };
  const [notifications, setNotifications] = useState<NotificationMessage[]>([
    {
      id: 'notif_init',
      title: '🎉 Welcome to Hyper Bingo!',
      body: 'Real-Time 75-Ball games with instant Telebirr & CBE Birr payouts.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const addNotification = (title: string, body: string, type: 'success' | 'info' | 'warning' | 'win' = 'info') => {
    const notif: NotificationMessage = {
      id: `notif_${Date.now()}_${Math.random()}`,
      title,
      body,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 15)]);
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
          availableBalance: 50,
          bonusBalance: 50,
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
          `Welcome, ${newUser.name}! Your account is ready with a 50 ETB starter bonus.`,
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
      addNotification('⚠️ Insufficient Balance', `You need at least ${amount} ETB available.`, 'warning');
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

    const cardsToCreate = chosenCardNumbers && chosenCardNumbers.length > 0 ? chosenCardNumbers : ['12608', '11302'];
    const totalCost = targetGame.entryPrice * cardsToCreate.length;

    if (wallet.availableBalance < totalCost) {
      addNotification(
        '⚠️ Insufficient Balance',
        `Required ${totalCost} ETB for ${cardsToCreate.length} card(s). Please deposit.`,
        'warning'
      );
      return false;
    }

    // Deduct total entry fee
    const newBalance = wallet.availableBalance - totalCost;
    setWallet((prev) => ({
      ...prev,
      availableBalance: newBalance,
    }));

    // Create entry transaction
    const tx: Transaction = {
      id: `TX_ENTRY_${Date.now().toString().slice(-5)}`,
      userId: user.id,
      username: user.username,
      type: 'GAME_ENTRY',
      amount: -totalCost,
      balanceAfter: newBalance,
      reference: `GM-${targetGame.id}`,
      status: 'COMPLETED',
      description: `Entry ticket (${cardsToCreate.length} cards) for ${targetGame.name}`,
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
      `You joined ${targetGame.name} with cards: ${cardsToCreate.join(', ')}. Good luck!`,
      'success'
    );

    return true;
  };

  // Add individual card to existing game session
  const addCardToGame = (gameId: string, cardNumber: string): boolean => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'You must open an account to purchase cards.', 'warning');
      return false;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) return false;

    if (wallet.availableBalance < targetGame.entryPrice) {
      addNotification('⚠️ Insufficient Balance', `Card cost is ${targetGame.entryPrice} ETB.`, 'warning');
      return false;
    }

    // Deduct cost
    const newBalance = wallet.availableBalance - targetGame.entryPrice;
    setWallet((prev) => ({ ...prev, availableBalance: newBalance }));

    // Generate new card
    const newCard = createNewBingoCard(gameId, user.id, cardNumber);
    setUserCards((prev) => [...prev, newCard]);

    addNotification('🎟️ Card Added!', `Added card #${cardNumber} to active game.`, 'success');
    return true;
  };


  // 6. CREATE GAME (ADMIN)
  const createGame = (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => {
    const newGame: Game = {
      ...gameData,
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

    addNotification('🎮 New Game Configured', `Created ${newGame.name} with ${newGame.prizePool} ETB Prize Pool.`, 'info');
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

    // Check pattern completeness
    const isFullHouse = checkFullHouseWin(card.marked);
    const lineCount = countCompletedLines(card.marked);
    const isLine = checkLineWin(card.marked);

    if (!isLine && !isFullHouse) {
      addNotification('❌ Invalid Bingo Claim', 'Your card does not have a completed line or pattern yet!', 'warning');
      return { success: false, message: 'Pattern not complete yet.' };
    }

    let patternName = 'Line';
    let prizeSharePercentage = 0.3; // 30% for single line

    if (isFullHouse) {
      patternName = 'Full House';
      prizeSharePercentage = 0.7; // 70% for full house
    } else if (lineCount >= 2) {
      patternName = 'Two Lines';
      prizeSharePercentage = 0.5; // 50% for two lines
    }

    const calculatedPrize = Math.round(game.prizePool * prizeSharePercentage);

    // Record winner in game
    const winRecord: WinnerRecord = {
      userId: user.id,
      username: user.username,
      pattern: patternName,
      prizeWon: calculatedPrize,
      claimedAt: new Date().toISOString(),
    };


    setGames((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, winners: [...g.winners, winRecord] } : g))
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
      description: `BINGO Winner! ${patternName} in ${game.name}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    addNotification(
      '🏆 BINGO WINNER! 🏆',
      `Congratulations! You claimed ${patternName} and won ${calculatedPrize} ETB!`,
      'win'
    );

    return { success: true, message: `BINGO! You won ${calculatedPrize} ETB (${patternName})!`, prize: calculatedPrize };
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
        createGame,
        updateGameStatus,
        daubCell,
        claimBingo,
        drawNextBall,
        dismissNotification,
        addNotification,
        toggleAutoDaub,
        autoDaubEnabled,
        toggleUserRole,
        setUserRole,
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
