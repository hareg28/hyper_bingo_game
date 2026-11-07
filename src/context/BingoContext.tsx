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
  HYPER_SPECIAL_PRICE_CYCLE,
  FETAN_PICK_SECONDS,
  SPECIAL_PICK_SECONDS,
  calcLotteryTotalCost,
  formatLotteryCardNumber,
  LOTTERY_NUMBERS_TOTAL,
  isWeekendSlotCurrentlyLive,
  computeWeekendPrizePool,
  getFetanClock,
  getSpecialPickClock,
  getNextWeekendDrawAt,
} from '../lib/bingoUtils';
import { isAdminTelegramId } from '../lib/authUtils';

import { Language, translations } from '../lib/translations';
import { getInitialLotterySoldMap } from '../lib/store';
import { getBotCountForGame, getInitialBotSoldCardNumbers, formatDisplayPlayerId } from '../lib/botPlayers';
import { audioManager } from '../lib/audioManager';
import { isMiniAppActive, subscribeToMiniAppActivity } from '../lib/miniAppActivity';

function getTelegramAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === 'string' && initData
    ? { 'X-Telegram-Init-Data': initData }
    : {};
}

interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'info' | 'warning' | 'win' | 'error';
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
  refreshTransactions: () => Promise<void>;
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
  refreshWallet: () => Promise<void>;
  requestWithdrawal: (amount: number, provider: PaymentProvider, accountNumber: string, accountName: string) => Promise<boolean>;
  approveWithdrawal: (withdrawalId: string, adminName: string, payoutReference?: string) => Promise<void>;
  rejectWithdrawal: (withdrawalId: string, adminName: string) => Promise<void>;
  refreshFinanceQueue: () => Promise<void>;
  joinGame: (gameId: string, chosenCardNumbers?: string[], customStake?: number) => boolean;
  updateGameEntryPrice: (gameId: string, newPrice: number) => void;
  addCardToGame: (gameId: string, cardNumber: string) => boolean;
  removeCard: (cardId: string) => void;
  createGame: (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => void;
  updateGameStatus: (gameId: string, status: GameStatus) => void;
  daubCell: (cardId: string, row: number, col: number) => void;
  claimBingo: (cardId: string) => { success: boolean; message: string; prize?: number };
  blockCard: (gameId: string, cardNumber: string) => void;
  resetGameRound: (gameId: string) => void;
  startSpecialRound: (gameId: string) => Promise<boolean>;
  clearConsumedCards: (gameId: string) => void;
  drawNextBall: (gameId: string) => number | null;
  dismissNotification: (id: string) => void;
  addNotification: (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'win' | 'error') => void;
  toggleUserRole: () => void;
  setUserRole: (role: UserRole) => void;
  updateUserRoleInDb: (targetUserId: string, role: UserRole) => Promise<{ success: boolean; message?: string }>;
  addAdminByIdentifier: (identifier: string) => Promise<{ success: boolean; message?: string }>;
  creditBonusBalance: (amount: number, reason: string) => void;
  // Weekend Lottery
  getLotterySoldNumbers: (gameId: string) => Set<number>;
  purchaseLotteryNumbers: (gameId: string, numbers: number[]) => { success: boolean; message: string; purchased?: string[] };
  refundLotteryNumber: (gameId: string, number: number) => { success: boolean; message: string };
  // Hyper Special Card additions
  addSpecialCards: (gameId: string, count: number) => { success: boolean; message: string; added: number };
  toggleSpecialCardRegistration: (cardId: string) => { success: boolean; message: string; isRegistered?: boolean };
  // Auth extensions
  isAuthModalOpen: boolean;
  authModalMode: 'register' | 'login';
  openAuthModal: (mode?: 'register' | 'login') => void;
  closeAuthModal: () => void;
  registerAccount: (data: { name: string; phone?: string; username?: string; telegramId?: string; referralCode?: string }) => Promise<{ success: boolean; message?: string }>;
  loginAccount: (identifier: string) => Promise<{ success: boolean; message?: string }>;
  refreshTelegramSession: () => Promise<User | null>;
  updateProfileName: (name: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  verifyAdminAccess: (identifier: string) => Promise<{ success: boolean; isAdmin: boolean; message?: string }>;
}

const BingoContext = createContext<BingoContextType | undefined>(undefined);

export function BingoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [games, setGames] = useState<Game[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hyper_bingo_special_rotation');
        if (saved) {
          const parsed = JSON.parse(saved);
          return INITIAL_GAMES.map((g) => {
            if (g.id === 'gm_special' || g.category === 'HYPER_SPECIAL') {
              return {
                ...g,
                activeSpecialRuleIndex: typeof parsed.activeSpecialRuleIndex === 'number' ? parsed.activeSpecialRuleIndex : g.activeSpecialRuleIndex,
                entryPrice: typeof parsed.entryPrice === 'number' ? parsed.entryPrice : g.entryPrice,
              };
            }
            return g;
          });
        }
      } catch {}
    }
    return INITIAL_GAMES;
  });
  const [activeGameId, setActiveGameId] = useState<string | null>('gm_fetan_10');
  const [userCards, setUserCards] = useState<BingoCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(INITIAL_WITHDRAWALS);
  const [promotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [referrals] = useState<Referral[]>(INITIAL_REFERRALS);
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
  const pendingCardPurchasesRef = React.useRef<Record<string, Promise<boolean>>>({});

  const fetchTransactionHistory = React.useCallback(async (userId: string) => {
    const authHeaders = getTelegramAuthHeaders();
    if (!authHeaders['X-Telegram-Init-Data']) return;
    const isAdmin = Boolean(user && (
      user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username)
    ));
    try {
      const url = isAdmin
        ? '/api/admin/transactions'
        : `/api/wallet/history?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, {
        headers: authHeaders,
        cache: 'no-store',
      });
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setTransactions(result.data as Transaction[]);
      }
    } catch {
      /* Keep the current history if refresh fails. */
    }
  }, [user]);

  const refreshTransactions = React.useCallback(async () => {
    if (user?.id) await fetchTransactionHistory(user.id);
  }, [user?.id, fetchTransactionHistory]);

  useEffect(() => {
    if (user?.id) void fetchTransactionHistory(user.id);
  }, [user?.id, fetchTransactionHistory]);

  const isLoggedIn = Boolean(user);

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || translations['en'][key] || String(key);
  };
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  const addNotification = (title: string, body: string, type: 'success' | 'info' | 'warning' | 'win' | 'error' = 'info') => {
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

  // Persist wallet to localStorage whenever it changes (so card purchases deduct birr permanently)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('hyper_bingo_wallet', JSON.stringify(wallet));
    } catch {}
  }, [wallet]);

  // Broadcast winner to all players/tabs via localStorage + CustomEvent
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWinnerBroadcast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.gameId || !detail.winner) return;
      setGames((prev) =>
        prev.map((g) => {
          if (g.id !== detail.gameId) return g;
          const alreadyHas = g.winners.some((w) => w.userId === detail.winner.userId);
          if (alreadyHas) return g;
          return {
            ...g,
            status: 'COMPLETED',
            winners: [...g.winners, detail.winner],
          };
        })
      );
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith('hyper_bingo_winner_')) return;
      if (!e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (!data.gameId || !data.winner) return;
        setGames((prev) =>
          prev.map((g) => {
            if (g.id !== data.gameId) return g;
            const alreadyHas = g.winners.some((w) => w.userId === data.winner.userId);
            if (alreadyHas) return g;
            return {
              ...g,
              status: 'COMPLETED',
              winners: [...g.winners, data.winner],
            };
          })
        );
      } catch {}
    };

    window.addEventListener('hyperbingo:winner', handleWinnerBroadcast);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('hyperbingo:winner', handleWinnerBroadcast);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Restore saved session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Clear known legacy mock test balances without issuing a new welcome bonus.
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
          // Purge ONLY known legacy mock test data (250 ETB or 150 ETB winning balance)
          // Do NOT reset wallets just because totalDeposited===0 — players can have real
          // balance from bonus spending, admin credits, referrals, or winning prizes.
          if (
            parsedWallet.availableBalance === 250 || 
            parsedWallet.winningBalance === 150
          ) {
            parsedWallet.availableBalance = 0;
            parsedWallet.winningBalance = 0;
            parsedWallet.bonusBalance = 0;
            localStorage.setItem('hyper_bingo_wallet', JSON.stringify(parsedWallet));
          }
          setWallet(parsedWallet);
        } else {
          setWallet({ ...INITIAL_WALLET, userId: savedUser.id });
        }

        // Live sync with server DB wallet & profile
        const query = savedUser.id ? `userId=${encodeURIComponent(savedUser.id)}` : savedUser.telegramId ? `telegramId=${encodeURIComponent(savedUser.telegramId)}` : `phone=${encodeURIComponent(savedUser.phone)}`;
        fetch(`/api/wallet?${query}`, { headers: getTelegramAuthHeaders() })
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
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
          const isAdm = isAdminTelegramId(tgUser.id) || (tgUser.username && isAdminTelegramId(tgUser.username));
          setUser((prev) => {
            if (prev) {
              const newTgId = String(tgUser.id);
              const targetRole: UserRole = isAdm || prev.role === 'admin' ? 'admin' : prev.role;
              const updated = {
                ...prev,
                name: prev.phone ? prev.name : `${tgUser.first_name || ''}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`.trim() || prev.name,
                username: tgUser.username || prev.username,
                telegramId: newTgId,
                role: targetRole,
              };
              localStorage.setItem('hyper_bingo_user', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });

          // Re-check account eligibility when the Mini App opens. Registration
          // is completed in the bot, so a player returning from registration
          // should be admitted without needing a separate web sign-in.
          if (typeof tg.initData === 'string' && tg.initData) {
            fetch('/api/auth/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData: tg.initData }),
            })
              .then((response) => response.json())
              .then((result) => {
                if (result.success && result.data?.user) {
                  setUser(result.data.user);
                  localStorage.setItem('hyper_bingo_user', JSON.stringify(result.data.user));
                  if (result.data.wallet) {
                    setWallet(result.data.wallet);
                    localStorage.setItem('hyper_bingo_wallet', JSON.stringify(result.data.wallet));
                  }
                }
              })
              .catch(() => {});
          }

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

    // Telegram's init data can arrive just after hydration. Retry briefly, but
    // stop as soon as it is available so admin verification only runs once.
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (syncTelegramUser() || attempts >= 10) clearInterval(interval);
    }, 400);
    if (syncTelegramUser()) clearInterval(interval);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // ── REAL-TIME MULTIPLAYER SYNC ─────────────────────────────────────────────
  // Polls /api/games/state and merges live DB state into local
  // game list. This makes all 1,000 concurrent players see the same drawn
  // numbers, player count, winners, and game status in near-real-time.
  const pollActiveRef = React.useRef(true);
  const fastDrawPollRef = React.useRef(false);
  const lastServerDrawCountsRef = React.useRef<Record<string, number>>({});
  const lastFetanCycleMarkersRef = React.useRef<Record<string, number>>({});
  const lastWeekendRoundKeysRef = React.useRef<Record<string, string>>({});
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setUserCards([]);
    fetch(`/api/games/buy-card?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => {
        if (cancelled || !result.success || !Array.isArray(result.data?.myCards)) return;
        const ownedRows = result.data.myCards as Array<{ gameId: string; cardNumber: string; isRegistered?: boolean; isPaid?: boolean }>;
        setUserCards((prev) => {
          const existing = new Map(prev.map((card) => [`${card.gameId}:${card.cardNumber}`, card]));
          return ownedRows.map((row) => {
            const key = `${row.gameId}:${row.cardNumber}`;
            const inMemory = existing.get(key);
            if (inMemory) return { ...inMemory, isRegistered: Boolean(row.isRegistered), isPaid: row.isPaid !== false };
            const card = createNewBingoCard(row.gameId, user.id, row.cardNumber);
            card.id = `gc_${row.gameId}_${row.cardNumber}`;
            card.isRegistered = Boolean(row.isRegistered);
            card.isPaid = row.isPaid !== false;
            return card;
          });
        });
        setLotterySoldMap((prev) => {
          const next = { ...prev };
          for (const row of ownedRows) {
            const number = Number(row.cardNumber);
            if (!Number.isFinite(number)) continue;
            const sold = new Set(next[row.gameId] || []);
            sold.add(number);
            next[row.gameId] = sold;
          }
          return next;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let polling = false;
    const scheduleNextPoll = (delay = fastDrawPollRef.current ? 800 + Math.random() * 200 : 2500 + Math.random() * 1500) => {
      if (!cancelled && isMiniAppActive()) timeoutId = setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled || polling) return;
      // Telegram can minimize its Mini App without setting document.hidden.
      if (!isMiniAppActive()) return;
      polling = true;
      try {
        const res = await fetch('/api/games/state', { cache: 'no-store' });
        if (!res.ok) throw new Error('state fetch failed');
        const json = await res.json();
        if (!isMiniAppActive()) {
          polling = false;
          return;
        }
        if (json.success && Array.isArray(json.data)) {
          fastDrawPollRef.current = json.data.some((game: any) =>
            game.status === 'RUNNING' &&
            (String(game.id).includes('fetan') || String(game.id).includes('weekend'))
          );
          const resetGameIds = json.data
            .filter((serverGame: any) => {
              const drawReset = (lastServerDrawCountsRef.current[serverGame.id] ?? 0) > 0 &&
                Array.isArray(serverGame.drawnNumbers) && serverGame.drawnNumbers.length === 0;
              const isFetan = String(serverGame.id).includes('fetan');
              const cycleMarker = Number(serverGame.nextRoundStartsAt);
              const previousCycleMarker = lastFetanCycleMarkersRef.current[serverGame.id];
              const cycleReset = isFetan && Number.isFinite(cycleMarker) && cycleMarker > 0 &&
                previousCycleMarker !== undefined && previousCycleMarker !== cycleMarker;
              if (isFetan && Number.isFinite(cycleMarker) && cycleMarker > 0) {
                lastFetanCycleMarkersRef.current[serverGame.id] = cycleMarker;
              }
              const weekendRoundKey = typeof serverGame.weekendRoundKey === 'string' ? serverGame.weekendRoundKey : '';
              const previousWeekendRoundKey = lastWeekendRoundKeysRef.current[serverGame.id];
              const weekendRoundReset = Boolean(previousWeekendRoundKey && previousWeekendRoundKey !== weekendRoundKey);
              if (weekendRoundKey) lastWeekendRoundKeysRef.current[serverGame.id] = weekendRoundKey;
              else delete lastWeekendRoundKeysRef.current[serverGame.id];
              return drawReset || cycleReset || weekendRoundReset;
            })
            .map((serverGame: any) => serverGame.id as string);
          json.data.forEach((serverGame: any) => {
            lastServerDrawCountsRef.current[serverGame.id] = Array.isArray(serverGame.drawnNumbers)
              ? serverGame.drawnNumbers.length
              : 0;
          });
          if (resetGameIds.length > 0) {
            const resetIds = new Set(resetGameIds);
            setUserCards((prev) => prev.filter((card) => !resetIds.has(card.gameId)));
          }

          setGames((prev) =>
            prev.map((localGame) => {
              const server = json.data.find((g: any) => g.id === localGame.id);
              if (!server) return localGame;
              const serverWinners = Array.isArray(server.winners) ? server.winners : [];
              const serverDrawnNumbers = Array.isArray(server.drawnNumbers) ? server.drawnNumbers : [];
              const serverBlockedCards = Array.isArray(server.blockedCards) ? server.blockedCards : [];
              const serverBlockedPlayers = Array.isArray(server.blockedPlayers) ? server.blockedPlayers : [];
              const sameValues = (left: unknown[], right: unknown[]) =>
                left.length === right.length && left.every((value, index) => value === right[index]);
              const sameWinners = JSON.stringify(localGame.winners) === JSON.stringify(serverWinners);
              if (
                localGame.status === server.status &&
                sameValues(localGame.drawnNumbers, serverDrawnNumbers) &&
                localGame.currentBall === server.currentBall &&
                localGame.currentPlayers === server.currentPlayers &&
                sameWinners &&
                sameValues(localGame.blockedCards || [], serverBlockedCards) &&
                sameValues(localGame.blockedPlayers || [], serverBlockedPlayers) &&
                localGame.activeSpecialRuleIndex === server.activeSpecialRuleIndex &&
                localGame.nextRoundStartsAt === server.nextRoundStartsAt &&
                localGame.roundStartedAt === server.roundStartedAt &&
                localGame.weekendRoundKey === server.weekendRoundKey &&
                localGame.entryPrice === server.entryPrice &&
                localGame.prizePool === server.prizePool &&
                localGame.drawInterval === server.drawInterval
              ) return localGame;
              if (serverWinners.length > 0 && JSON.stringify(localGame.winners) !== JSON.stringify(serverWinners)) {
                // Winner announcements are rendered by the active game room so
                // Fetan, Special, and Weekend results never bleed across pages.
              }
              // Only overwrite fields that come from the server;
              // keep local-only fields like name, gameType, category etc.
              return {
                ...localGame,
                status: server.status,
                drawnNumbers: serverDrawnNumbers,
                currentBall: server.currentBall,
                currentPlayers: server.currentPlayers,
                winners: serverWinners,
                blockedCards: serverBlockedCards,
                blockedPlayers: serverBlockedPlayers,
                activeSpecialRuleIndex: server.activeSpecialRuleIndex,
                nextRoundStartsAt: server.nextRoundStartsAt,
                roundStartedAt: server.roundStartedAt,
                weekendRoundKey: server.weekendRoundKey,
                entryPrice: server.entryPrice,
                prizePool: server.prizePool,
                drawInterval: server.drawInterval,
              };
            })
          );
          // Also persist special rotation to localStorage if returned from server
          if (typeof window !== 'undefined') {
            const specialServer = json.data.find((g: any) => g.id === 'gm_special');
            if (specialServer && typeof specialServer.activeSpecialRuleIndex === 'number') {
              try {
                localStorage.setItem('hyper_bingo_special_rotation', JSON.stringify({
                  activeSpecialRuleIndex: specialServer.activeSpecialRuleIndex,
                  entryPrice: specialServer.entryPrice,
                }));
              } catch {}
            }
          }
          // Sync lotterySoldMap from server buy-card data so all clients see real sold cards
          // Skip overwriting Fetan/Special games in their pick window — the gradual reveal effect handles those
          if (Array.isArray(json.data)) {
            const now = Date.now();
            setLotterySoldMap((prev) => {
              let changed = false;
              const nextMap = { ...prev };
              json.data.forEach((serverGame: any) => {
                // Don't stomp the gradual reveal for Fetan OR Special games while in their pick window
                const isGradualGame = String(serverGame.id).includes('fetan') || String(serverGame.id).includes('special');
                const inPickWindow = isGradualGame &&
                  serverGame.status === 'OPEN' &&
                  typeof serverGame.nextRoundStartsAt === 'number' &&
                  serverGame.nextRoundStartsAt > now;
                if (inPickWindow) return;

                if (Array.isArray(serverGame.soldCards)) {
                  const existing = nextMap[serverGame.id] || new Set<number>();
                  let authoritative = new Set<number>(serverGame.soldCards);
                  if (authoritative.size === 0) {
                    const fallback = getInitialBotSoldCardNumbers(serverGame.id, serverGame.category || serverGame.game_type);
                    if (fallback.length > 0) {
                      authoritative = new Set<number>(fallback);
                    }
                  }
                  if (
                    authoritative.size !== existing.size ||
                    [...authoritative].some((num) => !existing.has(num)) ||
                    [...existing].some((num) => !authoritative.has(num))
                  ) {
                    nextMap[serverGame.id] = authoritative;
                    changed = true;
                  }
                }
              });
              return changed ? nextMap : prev;
            });
          }
        }
      } catch {
        // Silently ignore network errors — keeps playing from last known state
      }
      polling = false;
      scheduleNextPoll();
    };

    const unsubscribe = subscribeToMiniAppActivity((active) => {
      if (!active) {
        clearTimeout(timeoutId);
        return;
      }
      clearTimeout(timeoutId);
      void poll();
    });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  // ── Gradual bot card reveal during Fetan (40s) and Special (4-min) pick windows ──
  // Bot cards are seeded at ~8% when the round resets; this effect incrementally
  // adds the remaining cards across the full pick window so the sold counter
  // visibly climbs rather than jumping all at once.
  useEffect(() => {
    const now = Date.now();
    // Match both Fetan and Special games that are OPEN with a future deadline
    const openPickGames = games.filter((g) => {
      const id = String(g.id);
      return (
        (id.includes('fetan') || id.includes('special')) &&
        g.status === 'OPEN' &&
        typeof g.nextRoundStartsAt === 'number' &&
        g.nextRoundStartsAt > now
      );
    });

    if (openPickGames.length === 0) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    openPickGames.forEach((game) => {
      const allBotCards = getInitialBotSoldCardNumbers(game.id, (game as any).category || (game as any).gameType);
      if (allBotCards.length === 0) return;

      const deadline = game.nextRoundStartsAt as number;
      const timeLeftMs = Math.max(0, deadline - Date.now());
      // Fetan: ~1.2 s tick fits 40 s window; Special: ~2 s tick fits 240 s window
      const isSpecialGame = String(game.id).includes('special');
      const TICK_MS = isSpecialGame ? 2000 : 1200;
      const totalTicks = Math.max(1, Math.floor(timeLeftMs / TICK_MS));
      // 8% already seeded in the reset handler; spread the remaining 92% over all ticks
      const seedCount = Math.ceil(allBotCards.length * 0.08);
      const remaining = allBotCards.length - seedCount;
      const cardsPerTick = Math.max(1, Math.ceil(remaining / totalTicks));

      let currentIndex = seedCount; // start from where the seed left off

      const interval = setInterval(() => {
        if (Date.now() >= deadline || currentIndex >= allBotCards.length) {
          // Pick window over — ensure ALL cards are shown and players count reaches full
          setLotterySoldMap((prev) => {
            const existing = prev[game.id] || new Set<number>();
            if (existing.size >= allBotCards.length) return prev;
            return { ...prev, [game.id]: new Set<number>(allBotCards) };
          });
          setGames((prev) => prev.map((g) => {
            if (g.id !== game.id) return g;
            return { ...g, currentPlayers: Math.max(g.currentPlayers || 0, allBotCards.length) };
          }));
          clearInterval(interval);
          return;
        }
        const batch = allBotCards.slice(currentIndex, currentIndex + cardsPerTick);
        currentIndex += cardsPerTick;
        setLotterySoldMap((prev) => {
          const existing = prev[game.id] || new Set<number>();
          const next = new Set<number>(existing);
          batch.forEach((n) => next.add(n));
          return { ...prev, [game.id]: next };
        });
        setGames((prev) => prev.map((g) => {
          if (g.id !== game.id) return g;
          return { ...g, currentPlayers: Math.max(g.currentPlayers || 0, currentIndex) };
        }));
      }, TICK_MS);

      intervals.push(interval);
    });

    return () => intervals.forEach(clearInterval);
    // Re-run whenever a Fetan/Special game flips to OPEN with a new deadline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games.map((g) => `${g.id}:${g.status}:${g.nextRoundStartsAt ?? ''}`).join('|')]);
  // ── End gradual bot card reveal ────────────────────────────────────────────

  // ── Weekend time-based bot card reveal ───────────────────────────────────
  // Weekend games have a 7-day selling window. Bot sold cards grow from 0 to
  // the full count linearly as time advances toward the weekly draw.
  // The server already returns the time-proportional slice; this effect keeps
  // the client display accurate between polls (updates every 60 seconds).
  useEffect(() => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const updateWeekendCards = () => {
      setLotterySoldMap((prev) => {
        let changed = false;
        const nextMap = { ...prev };
        games.forEach((g) => {
          const id = String(g.id);
          if (!id.includes('weekend') || g.status !== 'OPEN') return;
          const allBotCards = getInitialBotSoldCardNumbers(g.id, (g as any).category || (g as any).gameType);
          if (allBotCards.length === 0) return;
          const drawAt = getNextWeekendDrawAt(g as any);
          const windowStart = drawAt - WEEK_MS;
          const progress = Math.min(1, Math.max(0, (Date.now() - windowStart) / WEEK_MS));
          const visibleCount = Math.floor(allBotCards.length * progress);
          // Also include any real human-bought cards already in the set
          const existing = prev[g.id] || new Set<number>();
          const target = new Set<number>(allBotCards.slice(0, visibleCount));
          // Merge human-bought cards (numbers above bot range) with bot slice
          existing.forEach((n) => target.add(n));
          if (target.size !== existing.size || [...allBotCards.slice(0, visibleCount)].some((n) => !existing.has(n))) {
            nextMap[g.id] = target;
            changed = true;
          }
        });
        return changed ? nextMap : prev;
      });

      setGames((prev) => prev.map((g) => {
        const id = String(g.id);
        if (!id.includes('weekend') || g.status !== 'OPEN') return g;
        const allBotCards = getInitialBotSoldCardNumbers(g.id, (g as any).category || (g as any).gameType);
        if (allBotCards.length === 0) return g;
        const drawAt = getNextWeekendDrawAt(g as any);
        const windowStart = drawAt - WEEK_MS;
        const progress = Math.min(1, Math.max(0, (Date.now() - windowStart) / WEEK_MS));
        const visibleCount = Math.floor(allBotCards.length * progress);
        if (g.currentPlayers === visibleCount) return g;
        return { ...g, currentPlayers: visibleCount };
      }));
    };

    // Run immediately on mount / game change, then refresh every 60 seconds
    updateWeekendCards();
    const timer = setInterval(updateWeekendCards, 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games.filter((g) => String(g.id).includes('weekend')).map((g) => `${g.id}:${g.status}`).join('|')]);
  // ── End weekend time-based reveal ─────────────────────────────────────────

  const openAuthModal = React.useCallback((mode: 'register' | 'login' = 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = React.useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const registerAccount = async (data: {
    name: string;
    phone?: string;
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

  const updateProfileName = async (name: string): Promise<{ success: boolean; message?: string }> => {
    if (!user) return { success: false, message: 'Please register or sign in first.' };
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
        body: JSON.stringify({ name }),
      });
      const result = await res.json();
      if (!result.success || !result.data?.user) return { success: false, message: result.error || 'Could not update your name.' };
      setUser(result.data.user);
      localStorage.setItem('hyper_bingo_user', JSON.stringify(result.data.user));
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not update your name.' };
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
        audioManager.playAdminEnterAlert();
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

    // Never credit the client-side wallet directly. Every deposit must pass
    // through the server verifier or remain pending for administrator review.
    try {
      const response = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          mode: 'manual',
          provider,
          transactionCode: reference,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        addNotification('❌ Deposit Failed', data.error || 'The payment could not be verified.', 'error');
        return false;
      }
      await refreshWallet();
      addNotification(
        data.data?.status === 'COMPLETED' ? '💳 Deposit Confirmed!' : '⏳ Deposit Submitted',
        data.message || `Your ${amount} ETB deposit is being verified.`,
        data.data?.status === 'COMPLETED' ? 'success' : 'info'
      );
      return true;
    } catch {
      addNotification('❌ Deposit Error', 'The payment could not be verified. Please try again.', 'error');
      return false;
    }
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
    try {
      const response = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          mode: 'manual',
          provider,
          transactionCode: code,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        addNotification('❌ Deposit Failed', data.error || 'The payment could not be verified.', 'error');
        return false;
      }
      await refreshWallet();
      addNotification(
        data.data?.status === 'COMPLETED' ? '💳 Deposit Confirmed!' : '⏳ Deposit Submitted for Verification',
        data.message || `Your deposit of ${amount} ETB is being verified.`,
        data.data?.status === 'COMPLETED' ? 'success' : 'info'
      );
      audioManager.playApprovalRequestChime();
      return true;
    } catch {
      addNotification('❌ Deposit Error', 'The payment could not be verified. Please try again.', 'error');
      return false;
    }
  };

  // 2. WITHDRAWAL — submit a pending request; debit only after admin approval.
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

    if (!Number.isFinite(amount) || amount < 50) {
      addNotification(
        '⚠️ Minimum Withdrawal',
        'Withdrawals below 50 ETB cannot be submitted. Please enter at least 50 ETB.',
        'warning'
      );
      return false;
    }

    const withdrawable = wallet.winningBalance;
    if (withdrawable < amount) {
      addNotification(
        '⚠️ Insufficient Balance',
        `You need at least ${amount} ETB in winnings to withdraw. Current winnings: ${withdrawable.toFixed(0)} ETB.`,
        'warning'
      );
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
        const walletRes = await fetch(`/api/wallet?${query}`, { headers: getTelegramAuthHeaders() }).then((r) => r.json()).catch(() => null);
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
        `${amount} ETB requested for payout to ${provider} (${accountNumber}). Your withdrawable winnings are reserved until approval or rejection.`,
        'success'
      );
      audioManager.playApprovalRequestChime();

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
    if (user?.id) {
      const walletRes = await fetch(`/api/wallet?userId=${encodeURIComponent(user.id)}`, { headers: getTelegramAuthHeaders() }).then((r) => r.json()).catch(() => null);
      if (walletRes?.success && walletRes.data?.wallet) setWallet(walletRes.data.wallet);
    }

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
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action: 'REJECT', adminName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addNotification('❌ Withdrawal', data.error ?? 'Could not reject withdrawal.', 'error');
        return;
      }
    } catch {
      addNotification('❌ Withdrawal', 'Network error rejecting withdrawal.', 'error');
      return;
    }

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
        fetch('/api/admin/deposits', { headers: getTelegramAuthHeaders() }),
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

  const refreshWallet = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/wallet?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store', headers: getTelegramAuthHeaders() });
      const result = await res.json();
      if (result.success && result.data?.wallet) {
        setWallet(result.data.wallet);
        localStorage.setItem('hyper_bingo_wallet', JSON.stringify(result.data.wallet));
      }
      await fetchTransactionHistory(user.id);
    } catch {
      /* Keep the current balance if the refresh request fails. */
    }
  };

  const refreshTelegramSession = React.useCallback(async (): Promise<User | null> => {
    if (typeof window === 'undefined') return null;
    const initData = (window as any).Telegram?.WebApp?.initData;
    if (typeof initData !== 'string' || !initData) return null;
    try {
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const result = await response.json();
      const authenticatedUser = result.success ? result.data?.user as User | undefined : undefined;
      if (!authenticatedUser) return null;
      setUser(authenticatedUser);
      localStorage.setItem('hyper_bingo_user', JSON.stringify(authenticatedUser));
      if (result.data?.wallet) {
        setWallet(result.data.wallet);
        localStorage.setItem('hyper_bingo_wallet', JSON.stringify(result.data.wallet));
      }
      return authenticatedUser;
    } catch {
      return null;
    }
  }, []);

  // 4b. ADMIN APPROVE DEPOSIT
  const approveDeposit = async (transactionId: string, adminName: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx || !['PENDING', 'REVIEW_REQUIRED'].includes(tx.status)) return;

    // Optimistically mark as COMPLETED immediately so the button disappears
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'COMPLETED' } : t))
    );

    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
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
          prev.map((t) => (t.id === transactionId ? { ...t, status: tx.status } : t))
        );
        addNotification('❌ Approval Failed', json.error ?? 'Could not approve deposit.', 'error');
        return;
      }
    } catch {
      // Revert on network error
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, status: tx.status } : t))
      );
      addNotification('❌ Approval Failed', 'Network error. Please try again.', 'error');
      return;
    }

    await refreshWallet();

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
        headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
        body: JSON.stringify({ transactionId, action: 'REJECT', adminName }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert on failure
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, status: tx.status } : t))
        );
        addNotification('❌ Rejection Failed', json.error ?? 'Could not reject deposit.', 'error');
        return;
      }
    } catch {
      // Revert on network error
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, status: tx.status } : t))
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

  // 5. JOIN GAME — server-side card purchase via /api/games/buy-card
  //    Prevents duplicate card sales across concurrent users via DB UNIQUE constraint
  const joinGame = (gameId: string, chosenCardNumbers?: string[], customStake?: number): boolean => {
    if (!user) {
      openAuthModal('register');
      addNotification('Account Required', 'You must open an account to purchase cards and play.', 'warning');
      return false;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) return false;

    const actualStake = (customStake && customStake >= 10) ? customStake : targetGame.entryPrice;

    // Slot max 5: cap cards to at most 5
    const rawCards = chosenCardNumbers && chosenCardNumbers.length > 0 ? chosenCardNumbers : [String(Math.floor(10000 + Math.random() * 90000))];
    const cardsToCreate = rawCards.slice(0, 5);

    // ── Optimistic local update (immediate UI response) ──
    const playableBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
    const totalCost = actualStake * cardsToCreate.length;
    if (playableBalance < totalCost) {
      const isAm = language === 'am';
      addNotification(
        isAm ? '⚠️ በቂ ሒሳብ የለዎትም' : '⚠️ Insufficient Balance',
        isAm
          ? `ካርድ ለመግዛት በቂ ሒሳብ የለዎትም። ${totalCost} ETB ያስፈልጋል፤ ያለዎት ${playableBalance.toFixed(0)} ETB ነው። ለመጫወት እባክዎ ተቀማጭ ያድርጉ (Deposit)።`
          : `You don't have enough balance to buy cards. Need ${totalCost} ETB; you have ${playableBalance.toFixed(0)} ETB. Please deposit to play.`,
        'warning'
      );
      return false;
    }

    // Generate local cards immediately so the UI is instant
    const newCards = cardsToCreate.map((cNum) => createNewBingoCard(gameId, user.id, cNum));
    setUserCards((prev) => [
      ...prev.filter((c) => !(c.gameId === gameId && cardsToCreate.includes(c.cardNumber))),
      ...newCards,
    ]);

    setLotterySoldMap((prev) => {
      const cur = new Set(prev[gameId] || []);
      cardsToCreate.forEach((cNum) => {
        const n = parseInt(cNum, 10);
        if (!Number.isNaN(n)) cur.add(n);
      });
      return { ...prev, [gameId]: cur };
    });
    setActiveGameId(gameId);

    // ── Server-side purchase (async — validates uniqueness & deducts wallet in DB) ──
    fetch('/api/games/buy-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
      body: JSON.stringify({
        gameId,
        cardNumbers: cardsToCreate,
        userId: user.id,
        cost: totalCost,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          // Sync wallet from server response (authoritative balance)
          if (res.data?.walletAfter) {
            setWallet((prev) => {
              const updated = {
                ...prev,
                availableBalance: res.data.walletAfter.availableBalance,
                bonusBalance: res.data.walletAfter.bonusBalance,
                winningBalance: res.data.walletAfter.winningBalance ?? prev.winningBalance,
              };
              try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          // Remove any cards that were already sold to another player
          if (res.data?.alreadySold?.length > 0) {
            const soldElsewhere: string[] = res.data.alreadySold;
            setUserCards((prev) => prev.filter((c) =>
              !(c.gameId === gameId && soldElsewhere.includes(c.cardNumber))
            ));
            addNotification(
              '⚠️ Cards Taken',
              `Card(s) ${soldElsewhere.join(', ')} were already sold. New ones assigned.`,
              'warning'
            );
          }
          // Create local transaction record
          const actualCost = res.data?.cost ?? totalCost;
          const tx: Transaction = {
            id: `TX_ENTRY_${Date.now().toString().slice(-5)}`,
            userId: user.id,
            username: user.username,
            type: 'GAME_ENTRY',
            amount: -actualCost,
            balanceAfter: res.data?.walletAfter?.availableBalance ?? wallet.availableBalance,
            reference: `GM-${gameId}`,
            status: 'COMPLETED',
            description: `${targetGame.category === 'HYPER_FETAN' ? 'Hyper Fetan entry fee' : targetGame.category === 'HYPER_SPECIAL' ? 'Hyper Special entry fee' : 'Bingo entry fee'}: ${cardsToCreate.length} card(s) in ${targetGame.name}`,
            createdAt: new Date().toISOString(),
          };
          setTransactions((prev) => [tx, ...prev]);
        } else {
          // Server rejected — rollback local card state
          if (res.data?.wallet) {
            setWallet((prev) => {
              const updated = { ...prev, ...res.data.wallet };
              try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          addNotification('❌ Purchase Failed', res.error || 'Card purchase failed on server.', 'warning');
          setUserCards((prev) => prev.filter((c) =>
            !(c.gameId === gameId && cardsToCreate.includes(c.cardNumber))
          ));
          setLotterySoldMap((prev) => {
            const cur = new Set(prev[gameId] || []);
            cardsToCreate.forEach((cNum) => cur.delete(parseInt(cNum, 10)));
            return { ...prev, [gameId]: cur };
          });
        }
      })
      .catch(() => {
        // On network error, keep optimistic state — will sync on next poll
      });

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

    const playableBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
    if (playableBalance < targetGame.entryPrice) {
      addNotification('⚠️ Insufficient Balance', `Card cost is ${targetGame.entryPrice} ETB.`, 'warning');
      return false;
    }

    // Spend bonus, then available balance, then winnings.
    let remCost = targetGame.entryPrice;
    let newBonus = wallet.bonusBalance;
    let newAvailable = wallet.availableBalance;
    let newWinning = wallet.winningBalance;

    if (newBonus >= remCost) {
      newBonus -= remCost;
    } else {
      remCost -= newBonus;
      newBonus = 0;
      const availableSpent = Math.min(newAvailable, remCost);
      newAvailable -= availableSpent;
      remCost -= availableSpent;
      newWinning = Math.max(0, newWinning - remCost);
    }

    setWallet((prev) => ({
      ...prev,
      availableBalance: newAvailable,
      bonusBalance: newBonus,
      winningBalance: newWinning,
    }));

    // Generate new card
    const newCard = createNewBingoCard(gameId, user.id, cardNumber);
    setUserCards((prev) => [...prev, newCard]);

    // Track sold card globally
    const num = parseInt(cardNumber, 10);
    if (!Number.isNaN(num)) {
      setLotterySoldMap((prev) => {
        const cur = new Set(prev[gameId] || []);
        cur.add(num);
        return { ...prev, [gameId]: cur };
      });
    }

    return true;
  };


  // Remove a single card from the player's hand for this game
  const removeCard = (cardId: string) => {
    const card = userCards.find((c) => c.id === cardId);
    if (!card) return;
    const game = games.find((g) => g.id === card.gameId);
    const refundAmount = game?.entryPrice || 10;
    const isSpecial = game?.category === 'HYPER_SPECIAL' || game?.gameType === 'HYPER_SPECIAL';
    if (isSpecial && (game?.status === 'RUNNING' || Boolean(game?.drawnNumbers?.length)) && (card.isRegistered || card.isPaid !== false)) return;
    if (isSpecial) {
      if (!card.isRegistered && card.isPaid === false) {
        setUserCards((prev) => prev.filter((c) => c.id !== cardId));
        return;
      }
      const cardNumber = parseInt(card.cardNumber, 10);
      if (Number.isFinite(cardNumber)) refundLotteryNumber(card.gameId, cardNumber);
      return;
    }

    setUserCards((prev) => prev.filter((c) => c.id !== cardId));
    const num = parseInt(card.cardNumber, 10);
    if (!Number.isNaN(num)) {
      setLotterySoldMap((prev) => {
        const cur = new Set(prev[card.gameId] || []);
        cur.delete(num);
        cur.delete(card.cardNumber as any);
        return { ...prev, [card.gameId]: cur };
      });
    }

    // Special draft cards have not been paid for until they are registered.
    if (!isSpecial) {
      let newAvail = wallet.availableBalance + refundAmount;
      setWallet((prev) => {
        newAvail = prev.availableBalance + refundAmount;
        const updated = { ...prev, availableBalance: newAvail };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    }

    // The room's participant total represents paid cards, not distinct users.
    if (card.isPaid !== false) {
      setGames((prev) =>
        prev.map((g) =>
          g.id === card.gameId ? { ...g, currentPlayers: Math.max(0, (g.currentPlayers || 1) - 1) } : g
        )
      );
    }

  };

  // Add multiple cards for Hyper Special (options: 1, 2, 3, 5, 10 up to max 30)
  const addSpecialCards = (gameId: string, count: number): { success: boolean; message: string; added: number } => {
    const currentCards = userCards.filter((c) => c.gameId === gameId);
    const availableSlots = 30 - currentCards.length;
    if (availableSlots <= 0) {
      return { success: false, message: 'ከ30 በላይ ካርዶች አይፈቀድም (Max 30 cards allowed)', added: 0 };
    }
    const toAdd = Math.min(count, availableSlots);
    const existingNums = new Set(currentCards.map((c) => parseInt(c.cardNumber, 10)));

    // Pick unique numbers from 1 to 1000
    const newCards: BingoCard[] = [];
    let candidate = Math.floor(Math.random() * 1000) + 1;
    for (let i = 0; i < toAdd; i++) {
      let attempts = 0;
      while (existingNums.has(candidate) && attempts < 1000) {
        candidate = (candidate % 1000) + 1;
        attempts++;
      }
      existingNums.add(candidate);
      const newCard = createNewBingoCard(gameId, user?.id || 'guest', String(candidate));
      newCard.isRegistered = false;
      newCard.isPaid = false;
      newCards.push(newCard);
      candidate = Math.floor(Math.random() * 1000) + 1;
    }

    setUserCards((prev) => [...prev, ...newCards]);
    return {
      success: true,
      message: `${toAdd} ካርዶች ተጨምረዋል (${toAdd} card${toAdd > 1 ? 's' : ''} added)`,
      added: toAdd,
    };
  };

  // Register / Unregister a card in Hyper Special (max 5 registered cards per player)
  const toggleSpecialCardRegistration = (cardId: string): { success: boolean; message: string; isRegistered?: boolean } => {
    const card = userCards.find((c) => c.id === cardId);
    if (!card) return { success: false, message: 'Card not found' };

    const game = games.find((g) => g.id === card.gameId);
    const entryPrice = game?.entryPrice || 10;

    if (card.isRegistered) {
      const num = parseInt(card.cardNumber, 10);
      if (Number.isNaN(num)) return { success: false, message: 'Invalid card number.' };
      setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: false } : c));
      if (user?.id) {
        fetch('/api/games/buy-card', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
          body: JSON.stringify({ gameId: card.gameId, userId: user.id, cardNumber: card.cardNumber }),
        }).then(async (response) => {
          const result = await response.json();
          if (!response.ok || !result.success) {
            setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: true } : c));
            return;
          }
          const isPaid = result.data?.isPaid !== false;
          setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: false, isPaid } : c));
          if (result.data?.walletAfter) {
            setWallet((prev) => {
              const updated = { ...prev, availableBalance: result.data.walletAfter.availableBalance, bonusBalance: result.data.walletAfter.bonusBalance };
              try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          if (result.data?.refund > 0) {
            setGames((prev) => prev.map((g) => g.id === card.gameId
              ? { ...g, currentPlayers: Math.max(0, (g.currentPlayers || 0) - 1) }
              : g));
            const tx: Transaction = {
              id: `TX_REFUND_${Date.now().toString(36)}`, userId: user.id, username: user.username,
              type: 'GAME_ENTRY', amount: result.data.refund,
              balanceAfter: result.data.walletAfter?.availableBalance ?? wallet.availableBalance,
              reference: `REFUND-${card.gameId}`, status: 'COMPLETED',
              description: `Refund for unregistered Hyper Special card #${card.cardNumber} in ${game?.name || card.gameId}`,
              createdAt: new Date().toISOString(),
            };
            setTransactions((prev) => [tx, ...prev]);
          }
        }).catch(() => setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: true } : c)));
      }
      return { success: true, message: `Card #${card.cardNumber} is unregistered and remains available to register again.`, isRegistered: false };
    } else {
      // Register card
      const registeredInGame = userCards.filter((c) => c.gameId === card.gameId && c.isRegistered).length;
      if (registeredInGame >= 5) {
        return { success: false, message: 'ከ5 በላይ ካርዶች መመዝገብ አይቻልም! (Max 5 registered cards)' };
      }

      const playableBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
      if (!card.isPaid && playableBalance < entryPrice) {
        return { success: false, message: `በቂ ሒሳብ የለዎትም! (${entryPrice} ETB ያስፈልጋል)` };
      }

      // Optimistic local deduction — bonus, then available balance, then winnings.
      let remCost = card.isPaid ? 0 : entryPrice;
      let newBonus = wallet.bonusBalance;
      let newAvailable = wallet.availableBalance;
      let newWinning = wallet.winningBalance;
      if (newBonus >= remCost) {
        newBonus -= remCost;
        remCost = 0;
      } else {
        remCost -= newBonus;
        newBonus = 0;
        const availableSpent = Math.min(newAvailable, remCost);
        newAvailable -= availableSpent;
        remCost -= availableSpent;
        newWinning = Math.max(0, newWinning - remCost);
      }

      setWallet((prev) => {
        const updated = { ...prev, availableBalance: newAvailable, bonusBalance: newBonus, winningBalance: newWinning };
        try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
        return updated;
      });

      setUserCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isRegistered: true, isPaid: true } : c))
      );

      // Count a newly purchased/refunded card as a player; free re-registration
      // of an already-paid card must not increment the player count again.
      if (!card.isPaid) {
        setGames((prev) =>
          prev.map((g) => (g.id === card.gameId ? { ...g, currentPlayers: (g.currentPlayers || 0) + 1 } : g))
        );
      }

      const num = parseInt(card.cardNumber, 10);
      if (!Number.isNaN(num)) {
        setLotterySoldMap((prev) => {
          const cur = new Set(prev[card.gameId] || []);
          cur.add(num);
          return { ...prev, [card.gameId]: cur };
        });
      }

      // Persist deduction to server DB so balance doesn't restore on app reopen
      if (user?.id) {
        fetch('/api/games/buy-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
          body: JSON.stringify({
            gameId: card.gameId,
            cardNumbers: [card.cardNumber],
            userId: user.id,
            cost: entryPrice,
            isRegistered: true,
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (!res.success) {
              setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: false, isPaid: card.isPaid } : c));
              setWallet((prev) => ({ ...prev, availableBalance: wallet.availableBalance, bonusBalance: wallet.bonusBalance, winningBalance: wallet.winningBalance }));
            } else if (res.data?.walletAfter) {
              // Sync authoritative server wallet back to local state + localStorage
              setWallet((prev) => {
                const updated = {
                  ...prev,
                  availableBalance: res.data.walletAfter.availableBalance,
                  bonusBalance: res.data.walletAfter.bonusBalance,
                  winningBalance: res.data.walletAfter.winningBalance ?? prev.winningBalance,
                };
                try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
                return updated;
              });
            }
          })
          .catch(() => {
            setUserCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isRegistered: false, isPaid: card.isPaid } : c));
            setWallet((prev) => ({ ...prev, availableBalance: wallet.availableBalance, bonusBalance: wallet.bonusBalance, winningBalance: wallet.winningBalance }));
          });
      }

      return { success: true, message: card.isPaid ? `Card #${card.cardNumber} registered again.` : `ካርድ #${card.cardNumber} ተመዝግቧል! (${entryPrice} ETB ተቀንሷል)`, isRegistered: true };
    }
  };


  // 6. CREATE GAME (ADMIN)
  //    · Weekend/Lottery games → use the prizePool passed in by admin as the payout cap
  //    · Regular games        → use PrizePool = 0 and compute live at render:
  //                              PrizePool = round(Players × Price × 0.80)
  const createGame = (gameData: Omit<Game, 'id' | 'currentPlayers' | 'drawnNumbers' | 'winners' | 'createdAt'>) => {
    const isWeekend = !!gameData.isWeekendSpecial || gameData.gameType === 'WEEKEND_LOTTERY';
    if (isWeekend) {
      addNotification('Weekend Schedule Managed', 'Weekend draws run once per day on Friday, Saturday, and Sunday at 3:00 PM (9:00 Ethiopia clock time).', 'warning');
      return;
    }
    const enforcedPrize = isWeekend
      ? Math.round(gameData.prizePool || 0)
      : 0; // Regular games → compute live in getGameLivePrizePool (players × price × 0.80)

    const newGame: Game = {
      ...gameData,
      prizePool: enforcedPrize,
      id: `gm_${Date.now().toString().slice(-4)}`,
      currentPlayers: 0,
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
    const card = userCards.find((item) => item.id === cardId);
    const game = card && games.find((item) => item.id === card.gameId);
    const number = card?.numbers[row]?.[col];
    if (!card || !game || number === undefined || (row === 2 && col === 2) || !game.drawnNumbers.includes(number)) return;
    const marked = !card.marked[row]?.[col];
    setUserCards((prev) =>
      prev.map((gameCard) => {
        if (gameCard.gameId !== card.gameId) return gameCard;
        const newMarked = gameCard.marked.map((r, rIdx) =>
          r.map((val, cIdx) =>
            gameCard.numbers[rIdx]?.[cIdx] === number ? marked : val
          )
        );
        return { ...gameCard, marked: newMarked };
      })
    );
  };

  // 8b. BLOCK CARD (Penalty for false bingo claims)
  const blockCard = (gameId: string, cardNumber: string) => {
    const blockedPlayerId = user?.id;
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== gameId) return g;
        const currentBlocked = g.blockedCards || [];
        const alreadyBlockedCard = currentBlocked.includes(cardNumber);
        if (alreadyBlockedCard) return g;
        return {
          ...g,
          blockedCards: [...currentBlocked, cardNumber],
        };
      })
    );
    if (blockedPlayerId) {
      void fetch('/api/games/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, cardNumber, userId: blockedPlayerId }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) return;
        setGames((prev) => prev.map((game) => game.id !== gameId ? game : {
          ...game,
          blockedCards: result.data.blockedCards,
        }));
      }).catch(() => {});
    }
  };

  // 8c. RESET GAME ROUND — persists to DB via /api/games/reset
  //     All clients see the reset within 3 seconds via the poll.
  const resetGameRound = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const isSpecial = game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL' || gameId === 'gm_special';
    const isFetan = game.category === 'HYPER_FETAN' || game.gameType === 'HYPER_FETAN' || gameId.includes('fetan');
    const nextSpecialIndex = isSpecial
      ? ((game.activeSpecialRuleIndex ?? 0) + 1) % HYPER_SPECIAL_RULES.length
      : (game.activeSpecialRuleIndex ?? 0);
    const nextPrice = isSpecial
      ? HYPER_SPECIAL_PRICE_CYCLE[nextSpecialIndex % HYPER_SPECIAL_PRICE_CYCLE.length]
      : game.entryPrice;
    const nextRoundStartsAt = isSpecial
      ? Date.now() + SPECIAL_PICK_SECONDS * 1000
      : isFetan
        ? Date.now() + FETAN_PICK_SECONDS * 1000
        : undefined;

    // Optimistic local reset with fresh bot players (varied count and new cards)
    const freshBotCount = getBotCountForGame(gameId, game.category || game.gameType);
    const freshBotCards = getInitialBotSoldCardNumbers(gameId, game.category || game.gameType);
    const isGradualReveal = isFetan || isSpecial;
    const initialPlayersCount = isGradualReveal
      ? Math.ceil(freshBotCount * 0.08)
      : (game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY' || gameId.includes('weekend'))
        ? (() => {
            const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
            const drawAt = getNextWeekendDrawAt(game);
            const progress = Math.min(1, Math.max(0, (Date.now() - (drawAt - WEEK_MS)) / WEEK_MS));
            return Math.floor(freshBotCount * progress);
          })()
        : freshBotCount;

    setGames((prev) => {
      const updated = prev.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          currentPlayers: initialPlayersCount,
          drawnNumbers: [],
          currentBall: undefined,
          blockedCards: [],
          winners: [],
          status: 'OPEN' as const,
          roundStartedAt: undefined,
          activeSpecialRuleIndex: nextSpecialIndex,
          entryPrice: nextPrice,
          nextRoundStartsAt,
        };
      });
      if (typeof window !== 'undefined' && isSpecial) {
        try {
          localStorage.setItem('hyper_bingo_special_rotation', JSON.stringify({
            activeSpecialRuleIndex: nextSpecialIndex,
            entryPrice: nextPrice,
          }));
        } catch {}
      }
      return updated;
    });
    // For Fetan AND Special games, only seed a small initial batch so the gradual reveal effect can fill the rest
    if (isGradualReveal) {
      const initialSeed = freshBotCards.slice(0, Math.ceil(freshBotCards.length * 0.08));
      setLotterySoldMap((prev) => ({ ...prev, [gameId]: new Set<number>(initialSeed) }));
    } else {
      setLotterySoldMap((prev) => ({ ...prev, [gameId]: new Set<number>(freshBotCards) }));
    }
    setUserCards((prev) => prev.filter((card) => card.gameId !== gameId));

    // Persist to DB (fire-and-forget)
    fetch('/api/games/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId }),
    }).then(async (res) => {
      if (!res.ok) return;
      const result = await res.json();
      if (!result.success || !result.data) return;
      const reset = result.data;
      const serverRuleIndex = Number(reset.nextSpecialIndex);
      const serverPrice = Number(reset.nextPrice);
      const serverDeadline = reset.nextRoundStartsAt == null ? undefined : Number(reset.nextRoundStartsAt);
      setGames((prev) => prev.map((g) => g.id !== gameId ? g : {
        ...g,
        activeSpecialRuleIndex: Number.isFinite(serverRuleIndex) ? serverRuleIndex : g.activeSpecialRuleIndex,
        entryPrice: Number.isFinite(serverPrice) ? serverPrice : g.entryPrice,
        nextRoundStartsAt: serverDeadline,
      }));
      if (typeof window !== 'undefined' && reset.isSpecial) {
        try {
          localStorage.setItem('hyper_bingo_special_rotation', JSON.stringify({
            activeSpecialRuleIndex: serverRuleIndex,
            entryPrice: serverPrice,
          }));
        } catch {}
      }
    }).catch(() => {});
  };

  // 8d. START SPECIAL GAME ROUND — ends the 4-minute pick window
  const startSpecialRound = async (gameId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/games/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) return false;
    } catch {
      return false;
    }

    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          status: 'RUNNING',
          roundStartedAt: Date.now(),
          nextRoundStartsAt: undefined,
        };
      })
    );
    return true;
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

    if (game.status === 'COMPLETED' || (game.winners && game.winners.length > 0)) {
      return {
        success: false,
        message: 'ይቅርታ! ሌላ ተጫዋች ቀድሞ ቢንጎ ብሏል (Another player already called Bingo first)',
      };
    }

    // Check if card is already blocked
    if (game.blockedCards?.includes(card.cardNumber)) {
      return {
        success: false,
        message: `🚫 Card #${card.cardNumber} is blocked in this round due to an invalid claim.`,
      };
    }

    // For Hyper Special, only a paid registered card is eligible to claim.
    if ((game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL') && !card.isRegistered) {
      return {
        success: false,
        message: 'ካርዱ አልተመዘገበም! ለመጫወት እባክዎ «Register Card» ይጫኑ (Card is not registered! Click Register Card to play)',
      };
    }

    // ---- WINNING RULE CHECK ACCORDING TO GAME CATEGORY / RULE ----
    const effectiveMarked = card.numbers.map((row, rIdx) =>
      row.map((_, cIdx) => (rIdx === 2 && cIdx === 2) || card.marked[rIdx][cIdx])
    );

    const isFetan = game.category === 'HYPER_FETAN' || game.name?.includes('Fetan') || game.id.includes('fetan');
    const isWeekend = !!game.isWeekendSpecial || game.gameType === 'WEEKEND_LOTTERY' || game.category === 'HYPER_WEEKEND';
    const effectiveRuleType = isFetan
      ? 'ONE_LINE_OR_CORNERS'
      : isWeekend
      ? 'FULL_HOUSE_ONLY'
      : game.winningRule;

    // Hyper Fetan: 1 Horizontal, 1 Vertical, 1 Diagonal, 4 Corners (Any 1 line from hint rule)
    // Hyper Weekend: Full House Only
    // Hyper Special: Specific active rule for this game round
    const bestRule: WinningRuleMatch | null = getBestWinningRule(effectiveMarked, effectiveRuleType, game.activeSpecialRuleIndex);

    if (!bestRule) {
      blockCard(game.id, card.cardNumber);
      const isAm = language === 'am';
      const ruleDesc = effectiveRuleType === 'ONE_LINE_OR_CORNERS'
        ? (isAm ? '1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት' : '1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners')
        : effectiveRuleType === 'FULL_HOUSE_ONLY'
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

    // ---- PRIZE LOGIC: 80% to winners (Derash) & 20% to owner ----
    const soldCount = Math.max(0, game.currentPlayers || 0);
    const totalCollected = Math.max(0, (game.entryPrice || 10) * soldCount);
    const ownerCut = Math.round(totalCollected * OWNER_CUT_PCT); // 20% owner
    const weekendPlayerCount = soldCount;
    const totalPrizePoolForWinners = isWeekend
      ? computeWeekendPrizePool(game.entryPrice || 0, weekendPlayerCount)
      : Math.round(totalCollected * WINNERS_CUT_PCT); // 80% Derash for winners

    const alreadyWonUsernames = new Set(game.winners.map(w => w.username));
    const newWinnerCount = alreadyWonUsernames.has(user.username)
      ? game.winners.length
      : game.winners.length + 1;
    const winnersN = Math.max(1, newWinnerCount);
    const perWinnerShare = Math.round(totalPrizePoolForWinners / winnersN);

    const patternName = `${bestRule.label} (${bestRule.labelAm})`;
    const calculatedPrize = perWinnerShare;
    const winBall = game.currentBall || (game.drawnNumbers.length > 0 ? game.drawnNumbers[game.drawnNumbers.length - 1] : 75);

    // 1-Game Card Rule: All cards played in this game are marked used for this round
    setUserCards((prev) =>
      prev.map((c) => (c.gameId === game.id ? { ...c, isUsed: true, roundCompleted: true } : c))
    );

    // ── Send claim to server (human claims are rejected and force a bot victory) ──
    fetch('/api/games/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: game.id,
        userId: user.id,
        username: user.username,
        cardNumber: card.cardNumber,
        pattern: patternName,
        prizeWon: calculatedPrize,
        winningBall: winBall,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.botWinner) {
          const bw = res.botWinner as WinnerRecord;
          setGames((prev) =>
            prev.map((g) =>
              g.id !== game.id
                ? g
                : {
                    ...g,
                    status: 'COMPLETED',
                    winners: [bw],
                  }
            )
          );
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`hyper_bingo_winner_${game.id}`, JSON.stringify({ gameId: game.id, winner: bw }));
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('hyperbingo:winner', { detail: { gameId: game.id, winner: bw } }));
            } catch {}
          }
        }
        if (res.error) {
          addNotification('Bingo', res.error, 'warning');
        }
      })
      .catch(() => {});

    return {
      success: false,
      message: 'ይቅርታ! ሌላ ተጫዋች ቀድሞ ቢንጎ ብሏል (Another player already called Bingo first)',
    };
  };

  // 10. REAL-TIME DRAW NEXT BALL — only accept the server's authoritative ball.
  //     Each request includes the drawn count it observed so concurrent clients
  //     cannot append different balls to the same round state.
  const drawNextBall = (gameId: string): number | null => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return null;
    if (game.status === 'COMPLETED' || (game.winners && game.winners.length > 0)) return null;

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL' || gameId.includes('special');
    const isFetan = game.category === 'HYPER_FETAN' || game.gameType === 'HYPER_FETAN' || gameId.includes('fetan');
    const isWeekend = game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY' || gameId.includes('weekend');
    if ((isSpecial || isFetan) && game.nextRoundStartsAt && Date.now() < game.nextRoundStartsAt) return null;
    if (isWeekend && !isWeekendSlotCurrentlyLive(game)) return null;

    if (game.drawnNumbers.length >= 75) return null;

    // Don't invent a local ball: every client applies the same committed server result.
    fetch('/api/games/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, expectedDrawnCount: game.drawnNumbers.length }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res.success && Array.isArray(res.data?.drawnNumbers)) {
          setGames((prev) => prev.map((g) => g.id === gameId ? {
            ...g,
            drawnNumbers: res.data.drawnNumbers,
            currentBall: res.data.currentBall ?? g.currentBall,
          } : g));
          return;
        }
        if (res.success && res.data?.ball && Array.isArray(res.data.drawnNumbers)) {
          const serverBall: number = res.data.ball;
          const serverWinner = res.data.winner as WinnerRecord | undefined;
          setGames((prev) =>
            prev.map((g) => {
              if (g.id !== gameId) return g;
              return {
                ...g,
                drawnNumbers: res.data.drawnNumbers,
                currentBall: serverBall,
                status: res.data.isCompleted ? 'COMPLETED' : 'RUNNING',
                winners: serverWinner ? [serverWinner] : g.winners,
              };
            })
          );
          if (serverWinner && typeof window !== 'undefined') {
            try {
              localStorage.setItem(`hyper_bingo_winner_${gameId}`, JSON.stringify({ gameId, winner: serverWinner }));
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('hyperbingo:winner', { detail: { gameId, winner: serverWinner } }));
            } catch {}
          }
        }
      })
      .catch(() => {});

    return null;
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
    const isFetanGame = game.category === 'HYPER_FETAN' || game.name?.includes('Fetan') || game.id.includes('fetan');
    const isSpecialGame = game.category === 'HYPER_SPECIAL' || game.name?.includes('Special') || game.id.includes('special');
    if (isFetanGame && !getFetanClock(game.nextRoundStartsAt, game.status, game.drawnNumbers?.length || 0).pickingCards) {
      return { success: false, message: 'Card picking is closed. Wait for the 30-second select window.' };
    }
    if (isSpecialGame) {
      const specialClock = getSpecialPickClock(game.nextRoundStartsAt, game.status, game.drawnNumbers?.length || 0);
      if (!specialClock.pickingCards) {
        return { success: false, message: 'Special card picking is closed. Watch the live game or wait for the next 4-minute window.' };
      }
    }
    const maxNumbersForGame = isFetanGame ? 500 : isSpecialGame ? 99999 : LOTTERY_NUMBERS_TOTAL;
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
    const playable = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
    if (playable < totalCost) {
      const isAm = language === 'am';
      const msg = isAm
        ? `በቂ ሒሳብ የለዎትም! (${totalCost} ETB ያስፈልጋል፣ ያለዎት ${playable.toFixed(0)} ETB)። ለመጫወት እባክዎ ተቀማጭ ያድርጉ (Deposit)።`
        : `Insufficient balance. Need ${totalCost} ETB; you have ${playable.toFixed(0)} ETB. Please deposit to play.`;
      addNotification(
        isAm ? '⚠️ በቂ ሒሳብ የለዎትም' : '⚠️ Insufficient Balance',
        msg,
        'warning'
      );
      return { success: false, message: msg };
    }

    // Spend bonus, then available balance, then winnings.
    let newAvail = wallet.availableBalance;
    let newWinning = wallet.winningBalance;
    setWallet((prev) => {
      let rem = totalCost;
      let newBonus = prev.bonusBalance;
      let newAv = prev.availableBalance;
      let newWin = prev.winningBalance;
      if (newBonus >= rem) {
        newBonus -= rem;
        rem = 0;
      } else {
        rem -= newBonus;
        newBonus = 0;
        const availableSpent = Math.min(newAv, rem);
        newAv -= availableSpent;
        rem -= availableSpent;
        newWin = Math.max(0, newWin - rem);
      }
      newAvail = newAv;
      newWinning = newWin;
      const updated = {
        ...prev,
        availableBalance: newAv,
        bonusBalance: newBonus,
        winningBalance: newWinning,
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

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

    // Create corresponding bingo cards for purchased numbers (so game room shows them)
    const newCards = numbers.map((n) => {
      const card = createNewBingoCard(gameId, user.id, formatLotteryCardNumber(n));
      if (isSpecialGame) {
        card.isRegistered = false;
      }
      return card;
    });
    setUserCards((prev) => [
      ...prev.filter((c) => c.gameId !== gameId || !numbers.map((n) => formatLotteryCardNumber(n)).includes(c.cardNumber)),
      ...newCards,
    ]);

    const purchasedLabels = numbers.map((n) => formatLotteryCardNumber(n));
    const bonusSpent = Math.min(wallet.bonusBalance, totalCost);
    const availableSpent = Math.min(wallet.availableBalance, totalCost - bonusSpent);
    const winningSpent = Math.max(0, totalCost - bonusSpent - availableSpent);
    const purchasePromise = fetch('/api/games/buy-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
      body: JSON.stringify({ gameId, cardNumbers: purchasedLabels, userId: user.id, cost: totalCost }),
    })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (response.ok && body.success) {
          const walletAfter = body.data?.walletAfter;
          if (walletAfter) {
            setWallet((prev) => {
              const updated = {
                ...prev,
                availableBalance: walletAfter.availableBalance,
                bonusBalance: walletAfter.bonusBalance,
                winningBalance: walletAfter.winningBalance ?? prev.winningBalance,
              };
              try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          return true;
        }

        setLotterySoldMap((prev) => {
          const next = new Set(prev[gameId] || []);
          numbers.forEach((num) => next.delete(num));
          return { ...prev, [gameId]: next };
        });
        setUserCards((prev) => prev.filter((card) => !(card.gameId === gameId && purchasedLabels.includes(card.cardNumber))));
        setTransactions((prev) => prev.filter((transaction) => transaction.id !== tx.id));
        setWallet((prev) => {
          const updated = {
            ...prev,
            bonusBalance: prev.bonusBalance + bonusSpent,
            availableBalance: prev.availableBalance + availableSpent,
            winningBalance: prev.winningBalance + winningSpent,
          };
          try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
          return updated;
        });
        const isInsufficientBalance = /insufficient balance/i.test(String(body.error || ''));
        if (body.data?.wallet) {
          setWallet((prev) => {
            const updated = { ...prev, ...body.data.wallet };
            try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }
        const failureMessage = isInsufficientBalance
          ? (body.error || 'Insufficient balance.')
          : (body.error || 'This card could not be reserved. Please try another number.');
        addNotification(isInsufficientBalance ? '⚠️ Insufficient Balance' : 'Card purchase failed', failureMessage, 'warning');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lottery-purchase-failed', { detail: { gameId, numbers, message: failureMessage } }));
        }
        return false;
      })
      .catch(() => false);
    purchasedLabels.forEach((cardNumber) => {
      pendingCardPurchasesRef.current[`${gameId}:${cardNumber}`] = purchasePromise;
    });
    void purchasePromise.finally(() => {
      purchasedLabels.forEach((cardNumber) => {
        const key = `${gameId}:${cardNumber}`;
        if (pendingCardPurchasesRef.current[key] === purchasePromise) {
          delete pendingCardPurchasesRef.current[key];
        }
      });
    });

    return {
      success: true,
      message: `Purchased ${numbers.length} ticket(s): ${purchasedLabels.join(', ')}`,
      purchased: purchasedLabels,
    };
  };

  // Refund a single purchased lottery number (for unselect toggle)
  const refundLotteryNumber = (gameId: string, number: number): { success: boolean; message: string } => {
    if (!user) return { success: false, message: 'Account required.' };
    const game = games.find((g) => g.id === gameId);
    if (!game) return { success: false, message: 'Game not found.' };

    const numInt = typeof number === 'number' ? number : parseInt(String(number), 10);
    const label = String(numInt);
    const pendingPurchase = pendingCardPurchasesRef.current[`${gameId}:${label}`];

    // Check if card is owned by user in userCards OR marked in lotterySoldMap
    const userHasCard = userCards.some(
      (c) => c.gameId === gameId && (c.cardNumber === label || parseInt(c.cardNumber, 10) === numInt)
    );
    const ownedCard = userCards.find(
      (c) => c.gameId === gameId && (c.cardNumber === label || parseInt(c.cardNumber, 10) === numInt)
    );
    const soldSet = lotterySoldMap[gameId];
    const isMarkedSold = soldSet && (soldSet.has(numInt) || (soldSet as any).has(label));

    if (!userHasCard && !isMarkedSold) {
      return { success: false, message: 'Card not found in your cards.' };
    }

    const isFetanGame = game.category === 'HYPER_FETAN' || game.name?.includes('Fetan') || game.id.includes('fetan');
    const isSpecial = game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL';
    if (isFetanGame && !getFetanClock(game.nextRoundStartsAt, game.status, game.drawnNumbers?.length || 0).pickingCards) {
      return { success: false, message: 'Unselect is closed during the live round. Wait for the 30-second window.' };
    }
    if (isSpecial) {
      const specialClock = getSpecialPickClock(game.nextRoundStartsAt, game.status, game.drawnNumbers?.length || 0);
      if (!specialClock.pickingCards) {
        return { success: false, message: 'Unselect is closed. Watch the live game or wait for the next round.' };
      }
    }

    // Remove from sold set
    setLotterySoldMap((prev) => {
      const current = new Set(prev[gameId] || []);
      current.delete(numInt);
      current.delete(label as any);
      return { ...prev, [gameId]: current };
    });

    // Remove the corresponding user card
    setUserCards((prev) =>
      prev.filter((c) => !(c.gameId === gameId && (c.cardNumber === label || parseInt(c.cardNumber, 10) === numInt)))
    );

    let optimisticRefundTxId: string | undefined;
    const restoreCardAfterFailedRelease = (message: string) => {
      setLotterySoldMap((prev) => {
        const current = new Set(prev[gameId] || []);
        current.add(numInt);
        return { ...prev, [gameId]: current };
      });
      if (ownedCard) {
        setUserCards((prev) => prev.some((card) => card.id === ownedCard.id) ? prev : [...prev, ownedCard]);
      }
      if (!pendingPurchase) {
        setWallet((prev) => {
          const updated = { ...prev, availableBalance: Math.max(0, prev.availableBalance - (game.entryPrice || 10)) };
          try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
      if (optimisticRefundTxId) {
        setTransactions((prev) => prev.filter((transaction) => transaction.id !== optimisticRefundTxId));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lottery-refund-failed', {
          detail: { gameId, number: numInt, message },
        }));
      }
    };

    const releaseOwnedCard = async () => {
      if (pendingPurchase && !(await pendingPurchase)) return;
      try {
        const response = await fetch('/api/games/buy-card', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...getTelegramAuthHeaders() },
          body: JSON.stringify({ gameId, userId: user.id, cardNumber: label }),
        });
        const result = await response.json();
        const walletAfter = result.data?.walletAfter;
        if (!response.ok || !result.success) {
          restoreCardAfterFailedRelease(result.error || 'Card release failed. The card remains yours.');
          return;
        }
        if (result.success && walletAfter) {
          setWallet((prev) => {
            const updated = { ...prev, availableBalance: walletAfter.availableBalance, bonusBalance: walletAfter.bonusBalance };
            try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
            return updated;
          });
        }
      } catch {}
    };
    void releaseOwnedCard();

    // Special card purchases/refunds are settled by the server so retained
    // registration state and wallet balance cannot drift or be refunded twice.
    if (!pendingPurchase && !isSpecial) {
      const refundAmount = game.entryPrice || 10;
      let newAvail = wallet.availableBalance + refundAmount;
      setWallet((prev) => {
        newAvail = prev.availableBalance + refundAmount;
        const updated = {
          ...prev,
          availableBalance: newAvail,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      // Record refund transaction
      const tx: Transaction = {
        id: `TX_REFUND_${Date.now().toString().slice(-5)}`,
        userId: user.id,
        username: user.username,
        type: 'GAME_ENTRY',
        amount: refundAmount,
        balanceAfter: newAvail,
        reference: `REFUND-${gameId}`,
        status: 'COMPLETED',
        description: `Refund for unselected lottery card #${label} in ${game.name}`,
        createdAt: new Date().toISOString(),
      };
      optimisticRefundTxId = tx.id;
      setTransactions((prev) => [tx, ...prev]);

      return { success: true, message: `Refunded ${refundAmount} ETB for card #${label}` };
    }

    return { success: true, message: `ካርድ #${label} ተሰርዟል (Card #${label} removed)` };
  };

  const updateGameEntryPrice = (gameId: string, newPrice: number) => {
    if (newPrice < 10) return;
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, entryPrice: newPrice } : g))
    );
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
        refreshTransactions,
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
        refreshWallet,
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
        startSpecialRound,
        clearConsumedCards,
        drawNextBall,
        dismissNotification,
        addNotification,
        toggleUserRole,
        setUserRole,
        updateUserRoleInDb,
        addAdminByIdentifier,
        creditBonusBalance,
        updateGameEntryPrice,
        getLotterySoldNumbers,
        purchaseLotteryNumbers,
        refundLotteryNumber,
        addSpecialCards,
        toggleSpecialCardRegistration,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        registerAccount,
        loginAccount,
        refreshTelegramSession,
        updateProfileName,
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
