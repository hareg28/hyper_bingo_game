import { 
  User, Wallet, Game, BingoCard, Transaction, 
  WithdrawalRequest, Promotion, AuditLog, Referral 
} from './types';
import { createNewBingoCard, generateSoldNumbersForGame } from './bingoUtils';

// ------------------------------------------------------------------
// PRIZE RULE (per business requirement):
// REGULAR games   → PrizePool = round((Players × EntryPrice) × 0.85)
//                    (Owner keeps 15%, remaining 85% goes to winner(s).
//                     If N winners arrive, they split that 85% equally.)
// WEEKEND games   → Fixed prize (as pre-set by owner for promo/draw).
// ------------------------------------------------------------------
export const OWNER_CUT_PCT = 0.15; // 15%
export const WINNERS_CUT_PCT = 1 - OWNER_CUT_PCT; // 85%

export const computeRegularPrizePool = (entryPrice: number, currentPlayers: number): number => {
  const totalCollected = Math.max(0, (entryPrice || 0) * Math.max(0, currentPlayers || 0));
  return Math.round(totalCollected * WINNERS_CUT_PCT);
};

/**
 * Returns the live prize pool for a game.
 * - Weekend / Lottery specials → use the configured (fixed) prizePool.
 * - All other (regular) games  → derive from (players × price × 85%).
 */
export const getGameLivePrizePool = (game: Game): number => {
  if (!game) return 0;
  if (game.isWeekendSpecial || game.gameType === 'WEEKEND_LOTTERY') {
    return Math.round(game.prizePool || 0);
  }
  return computeRegularPrizePool(game.entryPrice || 0, game.currentPlayers || 0);
};

// ================================================================
// Weekend Lottery: Sold numbers registry per game (1-500)
// ================================================================
export const getInitialLotterySoldMap = (games: Game[]): Record<string, Set<number>> => {
  const map: Record<string, Set<number>> = {};
  games.forEach((g) => {
    if (g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) {
      // Real flow: no pre-sold cards initially; cards show as available and turn gray when bought
      map[g.id] = new Set<number>();
    }
  });
  return map;
};

export const WEEKEND_LOTTERY_DEFAULT_STAKE = 50;
export const WEEKEND_LOTTERY_SLOTS = 2;

// Fallback Guest User Template (Not logged in by default)
export const INITIAL_USER: User = {
  id: 'usr_guest',
  name: 'Guest Player',
  phone: '',
  telegramId: '',
  username: 'guest',
  role: 'user',
  status: 'active',
  referralCode: '',
  createdAt: '2026-09-01T10:00:00Z',
};

export const INITIAL_WALLET: Wallet = {
  userId: 'usr_guest',
  availableBalance: 0,
  bonusBalance: 0,
  winningBalance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
};

export const INITIAL_GAMES: Game[] = [
  // ===== SMALL GAMES (5 – 30 ETB) =====
  {
    id: 'gm_small_05',
    name: '⚡ Hyper 5',
    gameType: 'TURBO_EXPRESS',
    entryPrice: 5,
    maxPlayers: 100,
    currentPlayers: 0,
    startTime: 'Starting soon',
    drawInterval: 2,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:00:00Z',
  },
  {
    id: 'gm_small_10',
    name: '⚡ Hyper 10',
    gameType: 'QUICK_BINGO',
    entryPrice: 10,
    maxPlayers: 200,
    currentPlayers: 0,
    startTime: 'Starting soon',
    drawInterval: 3,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:10:00Z',
  },
  {
    id: 'gm_small_20',
    name: '🎲 Hyper 20',
    gameType: 'CLASSIC_75',
    entryPrice: 20,
    maxPlayers: 150,
    currentPlayers: 0,
    startTime: 'Starting in 02:45',
    drawInterval: 4,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T20:20:00Z',
  },
  {
    id: 'gm_small_30',
    name: '🎯 Hyper 30',
    gameType: 'QUICK_BINGO',
    entryPrice: 30,
    maxPlayers: 120,
    currentPlayers: 0,
    startTime: 'Starting in 03:30',
    drawInterval: 3,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T20:30:00Z',
  },

  // ===== WEEKEND LOTTERY — Hyper 35 / Hyper 50 / Hyper 100 (Fri–Sun) =====
  {
    id: 'gm_weekend_35',
    name: '🌟 Weekend Hyper 35',
    gameType: 'WEEKEND_LOTTERY',
    entryPrice: 35,
    minPlayers: 15,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Opens 10:00 PM (Fri-Sun)',
    drawInterval: 2,
    prizePool: 35000,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T18:00:00Z',
  },
  {
    id: 'gm_weekend_50',
    name: '🌟 Weekend Hyper 50',
    gameType: 'WEEKEND_LOTTERY',
    entryPrice: 50,
    minPlayers: 10,
    maxPlayers: 300,
    currentPlayers: 0,
    startTime: 'Opens 10:00 PM (Fri-Sun)',
    drawInterval: 2,
    prizePool: 50000,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T19:00:00Z',
  },
  {
    id: 'gm_weekend_100',
    name: '🌟 Weekend Hyper 100',
    gameType: 'WEEKEND_LOTTERY',
    entryPrice: 100,
    minPlayers: 8,
    maxPlayers: 200,
    currentPlayers: 0,
    startTime: 'Opens 10:00 PM (Fri-Sun)',
    drawInterval: 3,
    prizePool: 100000,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T20:00:00Z',
  },

  // ===== HIGH STAKES GAMES (100 / 200 / 300 / 500 / 1000 ETB) =====
  {
    id: 'gm_high_100',
    name: '🔥 Hyper 100',
    gameType: 'HIGH_STAKES',
    entryPrice: 100,
    minPlayers: 20,
    maxPlayers: 100,
    currentPlayers: 0,
    startTime: 'Starting in 08:30',
    drawInterval: 4,
    prizePool: 0,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-13T19:00:00Z',
  },
  {
    id: 'gm_high_200',
    name: '💎 Hyper 200',
    gameType: 'HIGH_STAKES',
    entryPrice: 200,
    minPlayers: 15,
    maxPlayers: 75,
    currentPlayers: 0,
    startTime: 'Tonight at 20:00',
    drawInterval: 4,
    prizePool: 0,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T17:00:00Z',
  },
  {
    id: 'gm_high_300',
    name: '🏅 Hyper 300',
    gameType: 'HIGH_STAKES',
    entryPrice: 300,
    minPlayers: 12,
    maxPlayers: 60,
    currentPlayers: 0,
    startTime: 'Tonight at 21:00',
    drawInterval: 4,
    prizePool: 0,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T18:00:00Z',
  },
  {
    id: 'gm_large_500',
    name: '👑 Hyper 500',
    gameType: 'HIGH_STAKES',
    entryPrice: 500,
    minPlayers: 10,
    maxPlayers: 50,
    currentPlayers: 0,
    startTime: 'Tonight at 23:00',
    drawInterval: 4,
    prizePool: 0,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T18:00:00Z',
  },
  {
    id: 'gm_large_1000',
    name: '🏆 Hyper 1000',
    gameType: 'HIGH_STAKES',
    entryPrice: 1000,
    minPlayers: 5,
    maxPlayers: 30,
    currentPlayers: 0,
    startTime: 'Tomorrow 20:00',
    drawInterval: 5,
    prizePool: 0,
    status: 'SCHEDULED',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T19:00:00Z',
  },
];

// No mock transactions — transactions are created by real user actions (deposit/play/win/withdraw)
export const INITIAL_TRANSACTIONS: Transaction[] = [];

// No mock withdrawals — populated by real user withdrawal requests
export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [];

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'prm_1',
    title: '\u{1F389} Welcome 100% Match Bonus',
    code: 'WELCOME100',
    description: 'Double your first Telebirr or CBE Birr deposit up to 1,000 ETB!',
    bonusPercentage: 100,
    maxBonus: 1000,
    minDeposit: 100,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    active: true,
  },
  {
    id: 'prm_2',
    title: '\u26A1 Quick Bingo Rush Hour',
    code: 'RUSHRUSH',
    description: 'Get 20% bonus balance back on all Quick Bingo games played after 8 PM.',
    bonusPercentage: 20,
    maxBonus: 300,
    minDeposit: 50,
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    active: true,
  },
];

// No mock audit logs — populated by real admin actions
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

// No mock referrals — populated by real referral events
export const INITIAL_REFERRALS: Referral[] = [];

// No pre-loaded cards — players pick their own cards when they join a game
export const INITIAL_CARDS: BingoCard[] = [];
