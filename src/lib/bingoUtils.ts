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
