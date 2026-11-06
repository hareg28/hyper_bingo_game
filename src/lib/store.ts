import { 
  User, Wallet, Game, BingoCard, Transaction, 
  WithdrawalRequest, Promotion, AuditLog, Referral 
} from './types';
import { computeWeekendPrizePool, createNewBingoCard, generateSoldNumbersForGame } from './bingoUtils';
import { getInitialBotSoldCardNumbers } from './botPlayers';

// ------------------------------------------------------------------
// PRIZE RULE (per business requirement):
// REGULAR games   → PrizePool = round((Players × EntryPrice) × 0.80)
//                    (Owner keeps 20%, remaining 80% goes to winner(s).
//                     If N winners arrive, they split that 80% equally.)
// WEEKEND games   → 80% of collected entries, capped at 50,000 ETB.
// ------------------------------------------------------------------
export const OWNER_CUT_PCT = 0.20; // 20% Owner Profit
export const WINNERS_CUT_PCT = 1 - OWNER_CUT_PCT; // 80% Prize Pool for Winners

export const computeRegularPrizePool = (entryPrice: number, currentPlayers: number): number => {
  const totalCollected = Math.max(0, (entryPrice || 0) * Math.max(0, currentPlayers || 0));
  return Math.round(totalCollected * WINNERS_CUT_PCT);
};

/**
 * Returns the live prize pool for a game.
 * - Weekend / Lottery specials → 80% of entries, capped at 50,000 ETB.
 * - All other (regular) games  → derive from (players × price × 80%).
 */
export const getGameLivePrizePool = (game: Game): number => {
  if (!game) return 0;
  if (game.isWeekendSpecial || game.gameType === 'WEEKEND_LOTTERY' || game.category === 'HYPER_WEEKEND') {
    return computeWeekendPrizePool(game.entryPrice || 0, game.currentPlayers || 0);
  }
  return computeRegularPrizePool(game.entryPrice || 0, game.currentPlayers || 0);
};

// ================================================================
// Weekend Lottery: Sold numbers registry per game (1-500)
// ================================================================
export const getInitialLotterySoldMap = (games: Game[]): Record<string, Set<number>> => {
  const map: Record<string, Set<number>> = {};
  games.forEach((g) => {
    if (g.category === 'HYPER_FETAN' || g.category === 'HYPER_WEEKEND' || g.category === 'HYPER_SPECIAL' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) {
      // Pre-seed initial bot player sold cards so rooms display active players and sold cards immediately
      const initialCards = getInitialBotSoldCardNumbers(g.id, g.category || g.gameType);
      map[g.id] = new Set<number>(initialCards);
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
  bonusBalance: 20, // 20 ETB welcome bonus for new players
  winningBalance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
};

export const INITIAL_GAMES: Game[] = [
  // ================================================================
  // CATEGORY 1: HYPER FETAN (10 Birr ONLY)
  // - 1-500 Master Card Picker
  // - 5 Slots (S1..S5)
  // - 30 sec card pick window; draws are initiated by a player
  // - Win Rule: 1 Line OR 4 Corners
  // ================================================================
  {
    id: 'gm_fetan_10',
    name: '⚡ Hyper Fetan',
    gameType: 'HYPER_FETAN',
    category: 'HYPER_FETAN',
    winningRule: 'ONE_LINE_OR_CORNERS',
    entryPrice: 10,
    maxPlayers: 500,
    currentPlayers: 165,
    startTime: 'Live Round',
    drawInterval: 2,
    roundDuration: 525,
    pickDuration: 40,
    prizePool: 1320,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:10:00Z',
  },

  // ================================================================
  // CATEGORY 2: HYPER SPECIAL — 10 / 20 ETB rotating entry price
  // - 4-minute card pick window and 12-minute game round
  // - Rotating Special Game Law (1 rule active per game until finished)
  // ================================================================
  {
    id: 'gm_special',
    name: '🎲 Hyper Special',
    gameType: 'HYPER_SPECIAL',
    category: 'HYPER_SPECIAL',
    winningRule: 'STANDARD',
    activeSpecialRuleIndex: 0,
    entryPrice: 10,
    pickDuration: 240,
    roundDuration: 720,
    maxPlayers: 1000,
    currentPlayers: 800,
    startTime: 'Live Round',
    drawInterval: 3,
    prizePool: 6400,
    status: 'OPEN',
    drawnNumbers: [],
    winners: [],
    blockedCards: [],
    createdAt: '2026-09-15T20:40:00Z',
  },

  // ================================================================
  // ================================================================
  // One Weekend game per day. Ethiopia time is UTC+3.
  {
    id: 'gm_weekend_fri_2pm',
    name: '🌟 Friday Weekend 50 — 9:00 AM',
    gameType: 'WEEKEND_LOTTERY', category: 'HYPER_WEEKEND', winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 50, minPlayers: 10, maxPlayers: 1500, currentPlayers: 0,
    startTime: 'Friday 9:00 AM Ethiopia local time', drawInterval: 2, prizePool: 50000, status: 'OPEN',
    drawnNumbers: [], winners: [], blockedCards: [], isWeekendSpecial: true,
    weekendDay: 'FRI', weekendSlot: '9AM', createdAt: '2026-09-16T14:00:00Z',
  },
  {
    id: 'gm_weekend_sat_6pm',
    name: '🌟 Saturday Weekend 50 — 9:00 AM',
    gameType: 'WEEKEND_LOTTERY', category: 'HYPER_WEEKEND', winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 50, minPlayers: 10, maxPlayers: 1500, currentPlayers: 0,
    startTime: 'Saturday 9:00 AM Ethiopia local time', drawInterval: 2, prizePool: 50000, status: 'OPEN',
    drawnNumbers: [], winners: [], blockedCards: [], isWeekendSpecial: true,
    weekendDay: 'SAT', weekendSlot: '9AM', createdAt: '2026-09-17T18:00:00Z',
  },
  {
    id: 'gm_weekend_sun_2pm',
    name: '🌟 Sunday Weekend 50 — 9:00 AM',
    gameType: 'WEEKEND_LOTTERY', category: 'HYPER_WEEKEND', winningRule: 'FULL_HOUSE_ONLY',
    entryPrice: 50, minPlayers: 10, maxPlayers: 1500, currentPlayers: 0,
    startTime: 'Sunday 9:00 AM Ethiopia local time', drawInterval: 2, prizePool: 50000, status: 'OPEN',
    drawnNumbers: [], winners: [], blockedCards: [], isWeekendSpecial: true,
    weekendDay: 'SUN', weekendSlot: '9AM', createdAt: '2026-09-18T14:00:00Z',
  },
];

// Retired second daily draws from the former six-game weekend schedule.
export const LEGACY_WEEKEND_GAME_IDS = [
  'gm_weekend_fri_6pm',
  'gm_weekend_sat_2pm',
  'gm_weekend_sun_6pm',
] as const;

// No mock transactions — transactions are created by real user actions (deposit/play/win/withdraw)
export const INITIAL_TRANSACTIONS: Transaction[] = [];

// No mock withdrawals — populated by real user withdrawal requests
export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [];

// Promotions are managed dynamically via announcements and admin panel — no static fake ones
export const INITIAL_PROMOTIONS: Promotion[] = [];

// No mock audit logs — populated by real admin actions
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

// No mock referrals — populated by real referral events
export const INITIAL_REFERRALS: Referral[] = [];

// No pre-loaded cards — players pick their own cards when they join a game
export const INITIAL_CARDS: BingoCard[] = [];
