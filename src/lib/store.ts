import { 
  User, Wallet, Game, BingoCard, Transaction, 
  WithdrawalRequest, Promotion, AuditLog, Referral 
} from './types';
import { createNewBingoCard, generateSoldNumbersForGame } from './bingoUtils';

// ------------------------------------------------------------------
// PRIZE RULE (per business requirement):
// REGULAR games   → PrizePool = round((Players × EntryPrice) × 0.80)
//                    (Owner keeps 20%, remaining 80% goes to winner(s).
//                     If N winners arrive, they split that 80% equally.)
// WEEKEND games   → Fixed prize (as pre-set by owner for promo/draw).
// ------------------------------------------------------------------
export const OWNER_CUT_PCT = 0.20; // 20% Owner Profit
export const WINNERS_CUT_PCT = 1 - OWNER_CUT_PCT; // 80% Prize Pool for Winners

export const computeRegularPrizePool = (entryPrice: number, currentPlayers: number): number => {
  const totalCollected = Math.max(0, (entryPrice || 0) * Math.max(0, currentPlayers || 0));
  return Math.round(totalCollected * WINNERS_CUT_PCT);
};

/**
 * Returns the live prize pool for a game.
 * - Weekend / Lottery specials → use the configured (fixed) prizePool.
 * - All other (regular) games  → derive from (players × price × 80%).
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
    if (g.category === 'HYPER_FETAN' || g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) {
      // Real flow: no pre-sold cards initially; cards show as available and turn gray when bought
      map[g.id] = new Set<number>();
    }
  });
  return map;
};

export const WEEKEND_LOTTERY_DEFAULT_STAKE = 50;
export const WEEKEND_LOTTERY_SLOTS = 5;
export const FETAN_LOTTERY_SLOTS = 5;

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
  // ================================================================
  // CATEGORY 1: HYPER FETAN (5, 10, 30, 50 Birr)
  // - 1-500 Master Card Picker
  // - 5 Slots (S1..S5)
  // - 1 min game round duration + 30 sec card pick intermission
  // - Win Rule: 1 Line OR 4 Corners
  // ================================================================
  {
    id: 'gm_fetan_05',
    name: '⚡ Hyper Fetan 5',
    gameType: 'HYPER_FETAN',
    category: 'HYPER_FETAN',
    winningRule: 'ONE_LINE_OR_CORNERS',
    entryPrice: 5,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Live Round',
    drawInterval: 2,
    roundDuration: 60,
    pickDuration: 30,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:00:00Z',
  },
  {
    id: 'gm_fetan_10',
    name: '⚡ Hyper Fetan 10',
    gameType: 'HYPER_FETAN',
    category: 'HYPER_FETAN',
    winningRule: 'ONE_LINE_OR_CORNERS',
    entryPrice: 10,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Live Round',
    drawInterval: 2,
    roundDuration: 60,
    pickDuration: 30,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:10:00Z',
  },
  {
    id: 'gm_fetan_30',
    name: '⚡ Hyper Fetan 30',
    gameType: 'HYPER_FETAN',
    category: 'HYPER_FETAN',
    winningRule: 'ONE_LINE_OR_CORNERS',
    entryPrice: 30,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Live Round',
    drawInterval: 2,
    roundDuration: 60,
    pickDuration: 30,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:20:00Z',
  },
  {
    id: 'gm_fetan_50',
    name: '⚡ Hyper Fetan 50',
    gameType: 'HYPER_FETAN',
    category: 'HYPER_FETAN',
    winningRule: 'ONE_LINE_OR_CORNERS',
    entryPrice: 50,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Live Round',
    drawInterval: 2,
    roundDuration: 60,
    pickDuration: 30,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:30:00Z',
  },

  // ================================================================
  // CATEGORY 2: HYPER SPECIAL (Starting 10, 20, 30, 50, 100 Birr)
  // - Interface: Classic live 5, 10... Birr room format
  // - Win Rule: 1 Line, 2 Lines, Letter X, Full House
  // ================================================================
  {
    id: 'gm_special_10',
    name: '🎲 Hyper Special 10',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
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
    createdAt: '2026-09-15T20:40:00Z',
  },
  {
    id: 'gm_special_20',
    name: '🎲 Hyper Special 20',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
    entryPrice: 20,
    maxPlayers: 150,
    currentPlayers: 0,
    startTime: 'Starting in 02:45',
    drawInterval: 4,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T20:50:00Z',
  },
  {
    id: 'gm_special_30',
    name: '🎯 Hyper Special 30',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
    entryPrice: 30,
    maxPlayers: 120,
    currentPlayers: 0,
    startTime: 'Starting in 03:30',
    drawInterval: 3,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T21:00:00Z',
  },
  {
    id: 'gm_special_50',
    name: '🔥 Hyper Special 50',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
    entryPrice: 50,
    maxPlayers: 100,
    currentPlayers: 0,
    startTime: 'Tonight at 20:00',
    drawInterval: 4,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T21:10:00Z',
  },
  {
    id: 'gm_special_100',
    name: '💎 Hyper Special 100',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
    entryPrice: 100,
    maxPlayers: 100,
    currentPlayers: 0,
    startTime: 'Tonight at 21:00',
    drawInterval: 4,
    prizePool: 0,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    createdAt: '2026-09-15T21:20:00Z',
  },

  // ================================================================
  // CATEGORY 3: HYPER WEEKEND (30, 50, 100 Birr)
  // - Win Rule: FULL HOUSE ONLY (All numbers marked to win)
  // - Fri-Sun Mega Draws with huge jackpot pools
  // ================================================================
  {
    id: 'gm_weekend_30',
    name: '🌟 Hyper Weekend 30',
    gameType: 'WEEKEND_LOTTERY',
    category: 'HYPER_WEEKEND',
    winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 30,
    minPlayers: 10,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Opens 2:00 PM (Fri-Sun)',
    drawInterval: 2,
    prizePool: 30000,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T18:00:00Z',
  },
  {
    id: 'gm_weekend_50',
    name: '🌟 Hyper Weekend 50',
    gameType: 'WEEKEND_LOTTERY',
    category: 'HYPER_WEEKEND',
    winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 50,
    minPlayers: 10,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Opens 5:00 PM (Fri-Sun)',
    drawInterval: 2,
    prizePool: 50000,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T19:00:00Z',
  },
  {
    id: 'gm_weekend_100',
    name: '🌟 Hyper Weekend 100',
    gameType: 'WEEKEND_LOTTERY',
    category: 'HYPER_WEEKEND',
    winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 100,
    minPlayers: 8,
    maxPlayers: 500,
    currentPlayers: 0,
    startTime: 'Opens 7:00 PM (Fri-Sun)',
    drawInterval: 3,
    prizePool: 100000,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    isWeekendSpecial: true,
    createdAt: '2026-09-16T20:00:00Z',
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
