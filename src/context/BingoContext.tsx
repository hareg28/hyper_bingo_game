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
  SPECIAL_PICK_SECONDS,
  calcLotteryTotalCost,
  formatLotteryCardNumber,
  LOTTERY_NUMBERS_TOTAL,
  isWeekendSlotCurrentlyLive,
  getFetanClock,
  getSpecialPickClock,
} from '../lib/bingoUtils';
import { isAdminTelegramId } from '../lib/authUtils';

import { Language, translations } from '../lib/translations';
import { getInitialLotterySoldMap } from '../lib/store';
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
  addNotification: (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'win') => void;
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
  registerAccount: (data: { name: string; phone: string; username?: string; telegramId?: string; referralCode?: string }) => Promise<{ success: boolean; message?: string }>;
  loginAccount: (identifier: string) => Promise<{ success: boolean; message?: string }>;
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

  useEffect(() => {
    if (user?.id) void fetchTransactionHistory(user.id);
  }, [user?.id, fetchTransactionHistory]);

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
          // Purge ONLY known legacy mock test data (250 ETB or 150 ETB winning balance)
          // Do NOT reset wallets just because totalDeposited===0 — players can have real
          // balance from bonus spending, admin credits, referrals, or winning prizes.
          if (
            parsedWallet.availableBalance === 250 || 
            parsedWallet.winningBalance === 150
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
  // Polls /api/games/state every 3 seconds and merges live DB state into local
  // game list. This makes all 1,000 concurrent players see the same drawn
  // numbers, player count, winners, and game status in near-real-time.
  const pollActiveRef = React.useRef(true);
  const lastServerDrawCountsRef = React.useRef<Record<string, number>>({});
  const lastFetanCycleMarkersRef = React.useRef<Record<string, number>>({});
  const lastWeekendRoundKeysRef = React.useRef<Record<string, string>>({});
  const announcedWinnerKeysRef = React.useRef<Set<string> | null>(null);
  const currentUserIdRef = React.useRef(user?.id);
  currentUserIdRef.current = user?.id;
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setUserCards([]);
    fetch(`/api/games/buy-card?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => {
        if (cancelled || !result.success || !Array.isArray(result.data?.myCards)) return;
        const ownedRows = result.data.myCards as Array<{ gameId: string; cardNumber: string; isRegistered?: boolean }>;
        setUserCards((prev) => {
          const existing = new Map(prev.map((card) => [`${card.gameId}:${card.cardNumber}`, card]));
          return ownedRows.map((row) => {
            const key = `${row.gameId}:${row.cardNumber}`;
            const inMemory = existing.get(key);
            if (inMemory) return inMemory;
            const card = createNewBingoCard(row.gameId, user.id, row.cardNumber);
            card.id = `gc_${row.gameId}_${row.cardNumber}`;
            card.isRegistered = Boolean(row.isRegistered);
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
    const scheduleNextPoll = (delay = 2500 + Math.random() * 1500) => {
      if (!cancelled && isMiniAppActive()) timeoutId = setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled || polling) return;
      // Telegram can minimize its Mini App without setting document.hidden.
      if (!isMiniAppActive()) return;
      polling = true;
      try {
        const res = await fetch('/api/games/state', { cache: 'no-cache' });
        if (!res.ok) throw new Error('state fetch failed');
        const json = await res.json();
        if (!isMiniAppActive()) {
          polling = false;
          return;
        }
        if (json.success && Array.isArray(json.data)) {
          const winnerKeys = new Set<string>();
          json.data.forEach((serverGame: any) => {
            const winners = Array.isArray(serverGame.winners) ? serverGame.winners : [];
            winners.forEach((winner: any) => {
              const key = `${serverGame.id}:${winner.userId}:${winner.cardNumber ?? ''}:${winner.claimedAt ?? ''}`;
              winnerKeys.add(key);
              if (
                announcedWinnerKeysRef.current !== null &&
                !announcedWinnerKeysRef.current.has(key) &&
                winner.userId !== currentUserIdRef.current
              ) {
                addNotification(
                  '🏆 BINGO WINNER!',
                  `${winner.username || 'A player'} won${winner.cardNumber ? ` with Card #${winner.cardNumber}` : ''}.`,
                  'win'
                );
              }
            });
          });
          announcedWinnerKeysRef.current = winnerKeys;
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
          if (Array.isArray(json.data)) {
            setLotterySoldMap((prev) => {
              let changed = false;
              const nextMap = { ...prev };
              json.data.forEach((serverGame: any) => {
                if (Array.isArray(serverGame.soldCards)) {
                  const existing = nextMap[serverGame.id] || new Set<number>();
                  const authoritative = new Set<number>(serverGame.soldCards);
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

  const openAuthModal = React.useCallback((mode: 'register' | 'login' = 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = React.useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

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
    audioManager.playApprovalRequestChime();

    return true;
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

    const withdrawable = wallet.winningBalance;
    if (withdrawable < amount) {
      const totalBalance = wallet.availableBalance + wallet.bonusBalance + wallet.winningBalance;
      if (totalBalance >= amount && wallet.bonusBalance > 0) {
        addNotification(
          '⚠️ Cannot Withdraw Bonus',
          `Your welcome bonus is play-only and cannot be withdrawn. Only bingo winnings can be withdrawn; deposits and bonuses remain in your play balance.`,
          'warning'
        );
      } else {
        addNotification(
          '⚠️ Insufficient Balance',
          `You need at least ${amount} ETB in winnings to withdraw. Current winnings: ${withdrawable.toFixed(0)} ETB.`,
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
        `${amount} ETB requested for payout to ${provider} (${accountNumber}). Your wallet is debited after approval.`,
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
      const walletRes = await fetch(`/api/wallet?userId=${encodeURIComponent(user.id)}`).then((r) => r.json()).catch(() => null);
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
      const res = await fetch(`/api/wallet?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
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
    const playableBalance = wallet.availableBalance + wallet.bonusBalance;
    const totalCost = actualStake * cardsToCreate.length;
    if (playableBalance < totalCost) {
      addNotification(
        '⚠️ Insufficient Balance',
        `You don't have enough balance to buy this card. Need ${totalCost} ETB; you have ${playableBalance.toFixed(0)} ETB.`,
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
      headers: { 'Content-Type': 'application/json' },
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
            description: `Entry: ${cardsToCreate.length} card(s) for ${targetGame.name}`,
            createdAt: new Date().toISOString(),
          };
          setTransactions((prev) => [tx, ...prev]);
        } else {
          // Server rejected — rollback local card state
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
    if (isSpecial && card.isRegistered) {
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

    // If user has no more cards in this game, decrement player count
    const remaining = userCards.filter(
      (c) => c.gameId === card.gameId && c.id !== cardId && c.userId === card.userId
    );
    if (remaining.length === 0) {
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
      return Number.isNaN(num)
        ? { success: false, message: 'Invalid card number.' }
        : refundLotteryNumber(card.gameId, num);
    } else {
      // Register card
      const registeredInGame = userCards.filter((c) => c.gameId === card.gameId && c.isRegistered).length;
      if (registeredInGame >= 5) {
        return { success: false, message: 'ከ5 በላይ ካርዶች መመዝገብ አይቻልም! (Max 5 registered cards)' };
      }

      const playableBalance = wallet.availableBalance + wallet.bonusBalance;
      if (playableBalance < entryPrice) {
        return { success: false, message: `በቂ ሒሳብ የለዎትም! (${entryPrice} ETB ያስፈልጋል)` };
      }

      // Optimistic local deduction — bonus first, then available
      let remCost = entryPrice;
      let newBonus = wallet.bonusBalance;
      let newAvailable = wallet.availableBalance;
      if (newBonus >= remCost) {
        newBonus -= remCost;
      } else {
        remCost -= newBonus;
        newBonus = 0;
        newAvailable = Math.max(0, newAvailable - remCost);
      }

      setWallet((prev) => {
        const updated = { ...prev, availableBalance: newAvailable, bonusBalance: newBonus };
        try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
        return updated;
      });

      setUserCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isRegistered: true } : c))
      );

      // Increment game player count if first registered card
      if (registeredInGame === 0) {
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
          headers: { 'Content-Type': 'application/json' },
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
            if (res.success && res.data?.walletAfter) {
              // Sync authoritative server wallet back to local state + localStorage
              setWallet((prev) => {
                const updated = {
                  ...prev,
                  availableBalance: res.data.walletAfter.availableBalance,
                  bonusBalance: res.data.walletAfter.bonusBalance,
                };
                try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
                return updated;
              });
            }
          })
          .catch(() => {
            // Network error — optimistic state stands; will sync on next wallet poll
          });
      }

      return { success: true, message: `ካርድ #${card.cardNumber} ተመዝግቧል! (${entryPrice} ETB ተቀንሷል)`, isRegistered: true };
    }
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
    const card = userCards.find((item) => item.id === cardId);
    const game = card && games.find((item) => item.id === card.gameId);
    if (!card || !game || (row === 2 && col === 2) || !game.drawnNumbers.includes(card.numbers[row]?.[col])) return;
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
        ? Date.now() + 30 * 1000
        : undefined;

    // Optimistic local reset
    setGames((prev) => {
      const updated = prev.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          currentPlayers: 0,
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
    setLotterySoldMap((prev) => ({ ...prev, [gameId]: new Set<number>() }));
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
    const isSpecial = game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL';
    const specialRegisteredCards = userCards.filter(c => c.gameId === game.id && c.isRegistered);
    const soldCount = isSpecial
      ? Math.max(
          lotterySoldMap[game.id]?.size || 0,
          specialRegisteredCards.length,
          1
        )
      : Math.max(
          game.currentPlayers || 0,
          (lotterySoldMap[game.id]?.size || 0),
          userCards.filter(c => c.gameId === game.id).length,
          1
        );
    const totalCollected = Math.max(0, (game.entryPrice || 10) * soldCount);
    const ownerCut = Math.round(totalCollected * OWNER_CUT_PCT); // 20% owner
    const totalPrizePoolForWinners = isWeekend
      ? Math.round(game.prizePool || 0)
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

    // ── Broadcast winner to server DB (other clients see it via 3s poll) ──
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
        if (res.success && res.data?.winRecord) {
          // Sync the server-verified prize (may differ if multiple winners claimed simultaneously)
          const serverPrize: number = res.data.prizeWon ?? calculatedPrize;
          if (serverPrize !== calculatedPrize) {
            setWallet((prev) => ({
              ...prev,
              winningBalance: prev.winningBalance - calculatedPrize + serverPrize,
            }));
          }
        }
      })
      .catch(() => {});

    // Also broadcast via localStorage + CustomEvent for same-tab listeners
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`hyper_bingo_winner_${game.id}`, JSON.stringify({ gameId: game.id, winner: winRecord }));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('hyperbingo:winner', { detail: { gameId: game.id, winner: winRecord } }));
      } catch {}
    }

    // 1-Game Card Rule: All cards played in this game are now marked used for this round
    setUserCards((prev) =>
      prev.map((c) => (c.gameId === game.id ? { ...c, isUsed: true, roundCompleted: true } : c))
    );

    // Update user wallet & transaction record
    const newWinningBalance = wallet.winningBalance + calculatedPrize;
    const newAvailableBalance = wallet.availableBalance;

    setWallet((prev) => ({
      ...prev,
      winningBalance: newWinningBalance,
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

  // 10. REAL-TIME DRAW NEXT BALL — only accept the server's authoritative ball.
  //     Each request includes the drawn count it observed so concurrent clients
  //     cannot append different balls to the same round state.
  const drawNextBall = (gameId: string): number | null => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return null;
    if (game.status === 'COMPLETED' || (game.winners && game.winners.length > 0)) return null;

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL';
    if (isSpecial && game.nextRoundStartsAt && Date.now() < game.nextRoundStartsAt) return null;

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
          setGames((prev) =>
            prev.map((g) => {
              if (g.id !== gameId) return g;
              return {
                ...g,
                drawnNumbers: res.data.drawnNumbers,
                currentBall: serverBall,
                status: res.data.isCompleted ? 'COMPLETED' : 'RUNNING',
              };
            })
          );
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
    const playable = wallet.availableBalance + wallet.bonusBalance;
    if (playable < totalCost) {
      addNotification(
        '⚠️ Insufficient Balance',
        `You don't have enough balance to buy this card. Need ${totalCost} ETB; you have ${playable.toFixed(0)} ETB.`,
        'warning'
      );
      return { success: false, message: `You don't have enough balance to buy this card. Need ${totalCost} ETB; you have ${playable.toFixed(0)} ETB.` };
    }

    // Deduct from wallet: bonus first, then available
    let newAvail = wallet.availableBalance;
    setWallet((prev) => {
      let rem = totalCost;
      let newBonus = prev.bonusBalance;
      let newAv = prev.availableBalance;
      if (newBonus >= rem) {
        newBonus -= rem;
        rem = 0;
      } else {
        rem -= newBonus;
        newBonus = 0;
        newAv = Math.max(0, newAv - rem);
      }
      newAvail = newAv;
      const updated = {
        ...prev,
        availableBalance: newAv,
        bonusBalance: newBonus,
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
    const purchasePromise = fetch('/api/games/buy-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, cardNumbers: purchasedLabels, userId: user.id, cost: totalCost }),
    })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (response.ok && body.success) {
          const walletAfter = body.data?.walletAfter;
          if (walletAfter) {
            setWallet((prev) => {
              const updated = { ...prev, availableBalance: walletAfter.availableBalance, bonusBalance: walletAfter.bonusBalance };
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
            availableBalance: prev.availableBalance + (totalCost - bonusSpent),
          };
          try { localStorage.setItem('hyper_bingo_wallet', JSON.stringify(updated)); } catch {}
          return updated;
        });
        const isInsufficientBalance = /insufficient balance/i.test(String(body.error || ''));
        const failureMessage = isInsufficientBalance
          ? "You don't have enough balance to buy this card."
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
          headers: { 'Content-Type': 'application/json' },
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

    // Refund entry price only if not Hyper Special
    if (!pendingPurchase) {
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
