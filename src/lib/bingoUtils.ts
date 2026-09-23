import { BingoCard } from './types';

// Helper to pick n unique random integers between min and max (inclusive)
function getRandomNumbers(min: number, max: number, count: number): number[] {
  const nums = new Set<number>();
  while (nums.size < count) {
    const val = Math.floor(Math.random() * (max - min + 1)) + min;
    nums.add(val);
  }
  return Array.from(nums);
}

export function generateBingoCardMatrix(): number[][] {
  const colB = getRandomNumbers(1, 15, 5);
  const colI = getRandomNumbers(16, 30, 5);
  const colN = getRandomNumbers(31, 45, 4); // 4 numbers, middle is FREE
  const colG = getRandomNumbers(46, 60, 5);
  const colO = getRandomNumbers(61, 75, 5);

  const matrix: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));

  for (let r = 0; r < 5; r++) {
    matrix[r][0] = colB[r];
    matrix[r][1] = colI[r];
    if (r < 2) {
      matrix[r][2] = colN[r];
    } else if (r === 2) {
      matrix[r][2] = 0; // FREE square
    } else {
      matrix[r][2] = colN[r - 1];
    }
    matrix[r][3] = colG[r];
    matrix[r][4] = colO[r];
  }

  return matrix;
}

export function createNewBingoCard(gameId: string, userId: string, customCardNumber?: string): BingoCard {
  const numbers = generateBingoCardMatrix();
  const marked: boolean[][] = Array(5).fill(false).map(() => Array(5).fill(false));
  // FREE center square is marked by default
  marked[2][2] = true;

  // Generate realistic 5-digit card number like 12608 if custom not provided
  const cardNumber = customCardNumber || Math.floor(10000 + Math.random() * 89999).toString();

  return {
    id: `card_${cardNumber}_${Math.random().toString(36).substring(2, 6)}`,
    cardNumber,
    gameId,
    userId,
    numbers,
    marked,
  };
}

export function checkLineWin(marked: boolean[][]): boolean {
  // Check horizontal rows
  for (let r = 0; r < 5; r++) {
    if (marked[r].every((val) => val)) return true;
  }
  // Check vertical columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      if (!marked[r][c]) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }
  // Main diagonal
  if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) return true;
  // Anti-diagonal
  if (marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0]) return true;

  return false;
}

export function countCompletedLines(marked: boolean[][]): number {
  let lines = 0;
  // Rows
  for (let r = 0; r < 5; r++) {
    if (marked[r].every((val) => val)) lines++;
  }
  // Columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      if (!marked[r][c]) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) lines++;
  }
  // Main diagonal
  if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) lines++;
  // Anti-diagonal
  if (marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0]) lines++;

  return lines;
}

export function checkFullHouseWin(marked: boolean[][]): boolean {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!marked[r][c]) return false;
    }
  }
  return true;
}

export type WinningRuleId = 'ONE_LINE' | 'TWO_LINES' | 'LETTER_X' | 'FULL_HOUSE';

export interface WinningRuleMatch {
  id: WinningRuleId;
  label: string;
  labelAm: string;
  rank: number;
  isMatch: boolean;
}

export function checkLetterXWin(marked: boolean[][]): boolean {
  const diag1 = marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4];
  const diag2 = marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0];
  return diag1 && diag2;
}

const getAllCompletedLineMasks = (marked: boolean[][]): { mask: number; type: string }[] => {
  const masks: { mask: number; type: string }[] = [];
  // Rows 0..4
  for (let r = 0; r < 5; r++) {
    if (marked[r].every((v) => v)) masks.push({ mask: 1 << r, type: `row_${r}` });
  }
  // Cols 5..9
  for (let c = 0; c < 5; c++) {
    let colDone = true;
    for (let r = 0; r < 5; r++) {
      if (!marked[r][c]) { colDone = false; break; }
    }
    if (colDone) masks.push({ mask: 1 << (5 + c), type: `col_${c}` });
  }
  // Diag1 = 10, Diag2 = 11
  const d1 = marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4];
  const d2 = marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0];
  if (d1) masks.push({ mask: 1 << 10, type: 'diag1' });
  if (d2) masks.push({ mask: 1 << 11, type: 'diag2' });
  return masks;
};

export function getTwoDistinctLinesCompleted(marked: boolean[][]): boolean {
  const all = getAllCompletedLineMasks(marked);
  // Try every pair; "distinct" means at least one cell in each line not in the other line
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if ((all[i].mask & all[j].mask) === 0) return true;
    }
  }
  return countCompletedLines(marked) >= 2;
}

export function detectWinningRules(marked: boolean[][]): WinningRuleMatch[] {
  const fullHouse = checkFullHouseWin(marked);
  const linesCompleted = countCompletedLines(marked);
  const oneLine = linesCompleted >= 1;
  const twoLines = getTwoDistinctLinesCompleted(marked);
  const letterX = checkLetterXWin(marked);

  return [
    { id: 'ONE_LINE', label: '1 Line', labelAm: '1 መስመር', rank: 4, isMatch: oneLine && !fullHouse && !letterX && !twoLines },
    { id: 'TWO_LINES', label: '2 Lines', labelAm: '2 መስመሮች', rank: 3, isMatch: twoLines && !fullHouse && !letterX },
    { id: 'LETTER_X', label: 'Letter X', labelAm: 'ፊደል X', rank: 2, isMatch: letterX && !fullHouse },
    { id: 'FULL_HOUSE', label: 'Full House', labelAm: 'ሙሉ ቤት', rank: 1, isMatch: fullHouse },
  ];
}

export function getBestWinningRule(marked: boolean[][]): WinningRuleMatch | null {
  const matches = detectWinningRules(marked).filter((r) => r.isMatch).sort((a, b) => a.rank - b.rank);
  return matches.length > 0 ? matches[0] : null;
}

export const WINNING_RULES_PATTERNS: { id: WinningRuleId; title: string; titleAm: string; subtitle: string; subtitleAm: string; pattern: boolean[][] }[] = [
  {
    id: 'ONE_LINE',
    title: '1 Line',
    titleAm: '1 መስመር',
    subtitle: 'Any 1 complete row / column / diagonal',
    subtitleAm: 'የሚሰሩት 1 ጊዜ ሙሉ በሙሉ',
    pattern: [
      [false, false, false, false, false],
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
  },
  {
    id: 'TWO_LINES',
    title: '2 Lines',
    titleAm: '2 መስመሮች',
    subtitle: 'Any 2 complete rows / columns / diagonals',
    subtitleAm: 'ሁለት የተለያዩ ሙሉ መስመሮች',
    pattern: [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, true, true, true, true],
    ],
  },
  {
    id: 'LETTER_X',
    title: 'Letter X',
    titleAm: 'ፊደል X',
    subtitle: 'Both diagonals must be complete',
    subtitleAm: 'ሁለቱም አርትዕ መስመሮች የተሟሉ',
    pattern: [
      [true, false, false, false, true],
      [false, true, false, true, false],
      [false, false, true, false, false],
      [false, true, false, true, false],
      [true, false, false, false, true],
    ],
  },
  {
    id: 'FULL_HOUSE',
    title: 'Full House',
    titleAm: 'ሙሉ ቤት',
    subtitle: 'Every cell on the card is marked',
    subtitleAm: 'ሁሉም ክፍሎች የተለመዱ ነው',
    pattern: [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
    ],
  },
];

export function countRemainingNumbers(marked: boolean[][]): number {
  let remaining = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) continue; // Free center
      if (!marked[r][c]) remaining++;
    }
  }
  return remaining;
}

export function formatETB(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' ETB';
}

/**
 * Checks if today is Friday (5), Saturday (6), or Sunday (0) for the Weekend Special Win Lottery.
 */
export function isWeekendLotteryDay(): boolean {
  const day = new Date().getDay();
  return day === 5 || day === 6 || day === 0;
}

/**
 * Synthesizes an energetic victory fanfare sound using Web Audio API when user calls BINGO!
 */
export function playBingoVictoryFanfare(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Notes sequence: C5, E5, G5, C6 (classic victory arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.35, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.4);
    });
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

// ================================================================
// Weekend Lottery Number Grid (1-500) Utilities
// ================================================================

export const LOTTERY_NUMBERS_TOTAL = 500;
export const LOTTERY_MAX_SLOTS = 2;

export interface LotterySoldMap {
  [gameId: string]: Set<number>;
}

const GLOBAL_LOTTERY_SOLD_SEED: Record<string, number[]> = {
  gm_weekend_35: [
    393, 400, 401, 406, 411, 417, 421, 423, 429, 434, 435, 437,
    443, 444, 445, 449, 1, 12, 25, 37, 48, 59, 62, 73, 84, 95,
    108, 112, 127, 138, 149, 156, 161, 174, 185, 199, 204, 218,
    221, 233, 245, 256, 267, 278, 289, 292, 305, 314, 325, 336,
    347, 358, 369, 379, 384, 388,
  ],
  gm_weekend_50: [
    7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105,
    112, 119, 126, 133, 140, 147, 154, 161, 168, 175, 182, 189,
    196, 203, 210, 217, 224, 231, 238, 245, 252, 259, 266, 273,
    280, 287, 294, 301, 308, 315, 322, 329, 336, 343, 350, 357,
    364, 371, 378, 385, 392, 399, 406, 413, 420, 427, 434, 441,
    448, 455, 462, 469, 476, 483, 490, 497,
  ],
  gm_weekend_100: [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
    150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260,
    270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380,
    390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500,
  ],
};

export function generateSoldNumbersForGame(gameId: string, count: number, entryPrice: number): Set<number> {
  const sold = new Set<number>();
  const seeded = GLOBAL_LOTTERY_SOLD_SEED[gameId];
  if (seeded) {
    seeded.forEach((n) => sold.add(n));
  }
  const seed = entryPrice * 7 + 13;
  let i = 0;
  while (sold.size < count && i < 2000) {
    const n = ((seed + i * 53) % LOTTERY_NUMBERS_TOTAL) + 1;
    sold.add(n);
    i++;
  }
  return sold;
}

export function formatLotteryCardNumber(num: number): string {
  return String(num).padStart(3, '0');
}

export function getLotteryGameSoldCount(gameId: string, entryPrice: number): number {
  return generateSoldNumbersForGame(gameId, 167, entryPrice).size;
}

export interface LotterySlot {
  slotIndex: number;
  number: number | null;
}

export function getEmptyLotterySlots(count = LOTTERY_MAX_SLOTS): LotterySlot[] {
  return Array.from({ length: count }, (_, i) => ({
    slotIndex: i,
    number: null,
  }));
}

export function validateLotteryNumber(num: number): boolean {
  return Number.isInteger(num) && num >= 1 && num <= LOTTERY_NUMBERS_TOTAL;
}

export function calcLotteryTotalCost(
  filledSlotsCount: number,
  entryPrice: number
): number {
  return Math.max(0, filledSlotsCount) * Math.max(0, entryPrice);
}

export function canAffordLottery(
  walletBalance: number,
  totalCost: number
): boolean {
  return walletBalance >= totalCost;
}

export function getLotteryWeekendDaysText(lang: 'en' | 'am' = 'en'): string {
  return lang === 'am'
    ? 'የአርብ እሑድ · ቅዳሜ 10 ሰዓት'
    : 'Fri · Sat · Sun 10 PM';
}

export function getLotteryGameLabel(
  entryPrice: number,
  lang: 'en' | 'am' = 'en'
): string {
  return lang === 'am' ? `ሙሉ ዝግጅት ${entryPrice}` : `Weekend Mega ${entryPrice}`;
}
