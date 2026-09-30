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

export function checkFourCornersWin(marked: boolean[][]): boolean {
  return Boolean(marked[0][0] && marked[0][4] && marked[4][0] && marked[4][4]);
}

export type WinningRuleId =
  | 'ONE_LINE'
  | 'TWO_LINES'
  | 'LETTER_X'
  | 'FULL_HOUSE'
  | 'FOUR_CORNERS'
  | 'HORIZONTAL_LINE'
  | 'VERTICAL_LINE'
  | 'DIAGONAL_LINE'
  | string;

export interface WinningRuleMatch {
  id: WinningRuleId;
  label: string;
  labelAm: string;
  rank: number;
  isMatch: boolean;
}

export const getCompletedRows = (marked: boolean[][]): number[] => {
  const rows: number[] = [];
  for (let r = 0; r < 5; r++) {
    if (marked[r].every((v) => v)) rows.push(r);
  }
  return rows;
};

export const getCompletedCols = (marked: boolean[][]): number[] => {
  const cols: number[] = [];
  for (let c = 0; c < 5; c++) {
    let colDone = true;
    for (let r = 0; r < 5; r++) {
      if (!marked[r][c]) {
        colDone = false;
        break;
      }
    }
    if (colDone) cols.push(c);
  }
  return cols;
};

export const isDiag1Complete = (marked: boolean[][]): boolean => {
  return Boolean(marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]);
};

export const isDiag2Complete = (marked: boolean[][]): boolean => {
  return Boolean(marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0]);
};

export function checkLetterXWin(marked: boolean[][]): boolean {
  return isDiag1Complete(marked) && isDiag2Complete(marked);
}

const getAllCompletedLineMasks = (marked: boolean[][]): { mask: number; type: string }[] => {
  const masks: { mask: number; type: string }[] = [];
  for (let r = 0; r < 5; r++) {
    if (marked[r].every((v) => v)) masks.push({ mask: 1 << r, type: `row_${r}` });
  }
  for (let c = 0; c < 5; c++) {
    let colDone = true;
    for (let r = 0; r < 5; r++) {
      if (!marked[r][c]) { colDone = false; break; }
    }
    if (colDone) masks.push({ mask: 1 << (5 + c), type: `col_${c}` });
  }
  if (isDiag1Complete(marked)) masks.push({ mask: 1 << 10, type: 'diag1' });
  if (isDiag2Complete(marked)) masks.push({ mask: 1 << 11, type: 'diag2' });
  return masks;
};

export function getTwoDistinctLinesCompleted(marked: boolean[][]): boolean {
  const all = getAllCompletedLineMasks(marked);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if ((all[i].mask & all[j].mask) === 0) return true;
    }
  }
  return countCompletedLines(marked) >= 2;
}

// ============================================================================
// 15 OFFICIAL HYPER SPECIAL RULES
// Each game round plays with exactly ONE active rule from this list until finished.
// ============================================================================
export interface HyperSpecialRuleDefinition {
  id: string;
  nameAm: string;
  nameEn: string;
  descAm: string;
  descEn: string;
  checkWin: (marked: boolean[][]) => boolean;
  checkOneAway: (marked: boolean[][], numbers: number[][]) => { neededNumber: number; neededCell: [number, number] } | null;
  pattern: boolean[][];
}

export const HYPER_SPECIAL_RULES: HyperSpecialRuleDefinition[] = [
  // 1. 2 Non-intersecting Lines
  {
    id: 'TWO_NON_INTERSECTING_LINES',
    nameAm: '2 የማይገናኙ መስመሮች',
    nameEn: '2 Non-intersecting Lines',
    descAm: 'የጋራ ነጥብ የሌላቸው 2 ሙሉ መስመሮች (2 አግድም ወይም 2 ቀጥታ)',
    descEn: '2 complete lines that share no common numbers (2 rows or 2 columns)',
    checkWin: (m) => getCompletedRows(m).length >= 2 || getCompletedCols(m).length >= 2,
    checkOneAway: (m, nums) => {
      const compRows = getCompletedRows(m);
      if (compRows.length >= 1) {
        for (let r = 0; r < 5; r++) {
          if (!compRows.includes(r)) {
            const un = [0, 1, 2, 3, 4].filter((c) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[r][un[0]], neededCell: [r, un[0]] };
          }
        }
      }
      const compCols = getCompletedCols(m);
      if (compCols.length >= 1) {
        for (let c = 0; c < 5; c++) {
          if (!compCols.includes(c)) {
            const un = [0, 1, 2, 3, 4].filter((r) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[un[0]][c], neededCell: [un[0], c] };
          }
        }
      }
      return null;
    },
    pattern: [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
  },

  // 2. 3 Non-intersecting Lines
  {
    id: 'THREE_NON_INTERSECTING_LINES',
    nameAm: '3 የማይገናኙ (የጋራ ነጥብ የሌላቸው) መስመሮች',
    nameEn: '3 Non-intersecting Lines',
    descAm: 'የጋራ ነጥብ የሌላቸው 3 ሙሉ መስመሮች (3 አግድም ወይም 3 ቀጥታ)',
    descEn: '3 complete lines with no shared numbers (3 rows or 3 columns)',
    checkWin: (m) => getCompletedRows(m).length >= 3 || getCompletedCols(m).length >= 3,
    checkOneAway: (m, nums) => {
      const compRows = getCompletedRows(m);
      if (compRows.length >= 2) {
        for (let r = 0; r < 5; r++) {
          if (!compRows.includes(r)) {
            const un = [0, 1, 2, 3, 4].filter((c) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[r][un[0]], neededCell: [r, un[0]] };
          }
        }
      }
      const compCols = getCompletedCols(m);
      if (compCols.length >= 2) {
        for (let c = 0; c < 5; c++) {
          if (!compCols.includes(c)) {
            const un = [0, 1, 2, 3, 4].filter((r) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[un[0]][c], neededCell: [un[0], c] };
          }
        }
      }
      return null;
    },
    pattern: [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [true, true, true, true, true],
      [false, false, false, false, false],
      [true, true, true, true, true],
    ],
  },

  // 3. 4 Corners
  {
    id: 'FOUR_CORNERS',
    nameAm: '4 ማዕዘኖች (የካርዱ አራት ጥጎች)',
    nameEn: '4 Corners',
    descAm: 'የካርዱ አራት ጥጎች (የላይ ግራ፣ የላይ ቀኝ፣ የታች ግራ፣ የታች ቀኝ)',
    descEn: 'All four corner squares of the card',
    checkWin: (m) => checkFourCornersWin(m),
    checkOneAway: (m, nums) => {
      const corners: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];
      const un = corners.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [true, false, false, false, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, false, false, false, true],
    ],
  },

  // 4. Full House (Blackout)
  {
    id: 'FULL_HOUSE',
    nameAm: 'ሙሉ ካርድ (Blackout)',
    nameEn: 'Full House (Blackout) / ሙሉ ካርድ',
    descAm: 'በካርዱ ላይ ያሉትን ሁሉንም 24 ቁጥሮች ምልክት ማድረግ',
    descEn: 'Mark all 24 numbers across the entire bingo card',
    checkWin: (m) => checkFullHouseWin(m),
    checkOneAway: (m, nums) => {
      const un: [number, number][] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!m[r][c]) un.push([r, c]);
        }
      }
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: Array.from({ length: 5 }, () => Array(5).fill(true)),
  },

  // 5. 2 Parallel Lines
  {
    id: 'TWO_PARALLEL_LINES',
    nameAm: '2 ትይዩ መስመሮች (አግድም ወይም ቀጥታ)',
    nameEn: '2 Parallel Lines (Horizontal or Vertical)',
    descAm: '2 ትይዩ መስመሮች (2 አግድም መስመሮች ወይም 2 ቀጥታ መስመሮች)',
    descEn: '2 parallel rows (horizontal) or 2 parallel columns (vertical)',
    checkWin: (m) => getCompletedRows(m).length >= 2 || getCompletedCols(m).length >= 2,
    checkOneAway: (m, nums) => {
      const compRows = getCompletedRows(m);
      if (compRows.length >= 1) {
        for (let r = 0; r < 5; r++) {
          if (!compRows.includes(r)) {
            const un = [0, 1, 2, 3, 4].filter((c) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[r][un[0]], neededCell: [r, un[0]] };
          }
        }
      }
      const compCols = getCompletedCols(m);
      if (compCols.length >= 1) {
        for (let c = 0; c < 5; c++) {
          if (!compCols.includes(c)) {
            const un = [0, 1, 2, 3, 4].filter((r) => !m[r][c]);
            if (un.length === 1) return { neededNumber: nums[un[0]][c], neededCell: [un[0], c] };
          }
        }
      }
      return null;
    },
    pattern: [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, true, true, true, true],
    ],
  },

  // 6. Letter X
  {
    id: 'LETTER_X',
    nameAm: 'የ "X" ቅርጽ (ሁለቱም የጎንዮሽ መስመሮች)',
    nameEn: 'Both diagonal lines crossing from corner to corner',
    descAm: 'ሁለቱም የጎንዮሽ (ዲያጎናል) መስመሮች ተገናኝተው የ X ቅርጽ ሲሰሩ',
    descEn: 'Both diagonal lines crossing from corner to corner forming an X',
    checkWin: (m) => isDiag1Complete(m) && isDiag2Complete(m),
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 4], [1, 3], [3, 1], [4, 0],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [true, false, false, false, true],
      [false, true, false, true, false],
      [false, false, true, false, false],
      [false, true, false, true, false],
      [true, false, false, false, true],
    ],
  },

  // 7. Letter L
  {
    id: 'LETTER_L',
    nameAm: 'የ "L" ቅርጽ (የግራ ቀጥታ እና የታችኛው አግድም መስመር)',
    nameEn: 'Far-left column combined with the bottom row',
    descAm: 'የግራ ቀጥታ (1ኛ አምድ) እና የታችኛው አግድም (5ኛ ረድፍ) መስመር',
    descEn: 'Far-left column (Col 1) combined with the bottom row (Row 5)',
    checkWin: (m) => getCompletedCols(m).includes(0) && getCompletedRows(m).includes(4),
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        [4, 1], [4, 2], [4, 3], [4, 4],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, true, true, true, true],
    ],
  },

  // 8. Small Inside Box
  {
    id: 'SMALL_INSIDE_BOX',
    nameAm: 'የውስጥ ትንሽ ሳጥን (በመካከሉ ያሉ 4 ቁጥሮች)',
    nameEn: 'The 4 numbers surrounding the center free space',
    descAm: 'ከመሃሉ ነጻ (FREE) ቦታ ዙሪያ ያሉ 4 ቁጥሮች',
    descEn: 'The 4 numbers surrounding the center free space',
    checkWin: (m) => {
      const ortho = m[1][2] && m[3][2] && m[2][1] && m[2][3];
      const diag = m[1][1] && m[1][3] && m[3][1] && m[3][3];
      return Boolean(ortho || diag);
    },
    checkOneAway: (m, nums) => {
      const ortho: [number, number][] = [[1, 2], [3, 2], [2, 1], [2, 3]];
      const unOrtho = ortho.filter(([r, c]) => !m[r][c]);
      if (unOrtho.length === 1) return { neededNumber: nums[unOrtho[0][0]][unOrtho[0][1]], neededCell: unOrtho[0] };
      const diag: [number, number][] = [[1, 1], [1, 3], [3, 1], [3, 3]];
      const unDiag = diag.filter(([r, c]) => !m[r][c]);
      if (unDiag.length === 1) return { neededNumber: nums[unDiag[0][0]][unDiag[0][1]], neededCell: unDiag[0] };
      return null;
    },
    pattern: [
      [false, false, false, false, false],
      [false, false, true, false, false],
      [false, true, true, true, false],
      [false, false, true, false, false],
      [false, false, false, false, false],
    ],
  },

  // 9. Inside Frame
  {
    id: 'INSIDE_FRAME',
    nameAm: 'የውስጥ ፍሬም (ከውጭ መስመር ቀጥሎ ያለው የውስጥ ሳጥን)',
    nameEn: 'The 8 or 12 numbers forming a box inside the outer edges',
    descAm: 'ከውጭ መስመር ቀጥሎ ያለው የውስጥ 3x3 ሳጥን (8 ቁጥሮች)',
    descEn: 'The 8 numbers forming a box inside the outer edges surrounding the center',
    checkWin: (m) => {
      const cells: [number, number][] = [
        [1, 1], [1, 2], [1, 3],
        [2, 1],         [2, 3],
        [3, 1], [3, 2], [3, 3],
      ];
      return cells.every(([r, c]) => m[r][c]);
    },
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [1, 1], [1, 2], [1, 3],
        [2, 1],         [2, 3],
        [3, 1], [3, 2], [3, 3],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [false, false, false, false, false],
      [false, true, true, true, false],
      [false, true, false, true, false],
      [false, true, true, true, false],
      [false, false, false, false, false],
    ],
  },

  // 10. Plus Sign
  {
    id: 'PLUS_SIGN',
    nameAm: 'የ "+" ቅርጽ (የመካከለኛው አግድም እና ቀጥታ መስመር)',
    nameEn: 'The middle row crossing with the middle column',
    descAm: 'የመካከለኛው አግድም (Row 3) እና የመካከለኛው ቀጥታ (Col 3) መስመር',
    descEn: 'The middle row crossing with the middle column forming a plus (+)',
    checkWin: (m) => getCompletedRows(m).includes(2) && getCompletedCols(m).includes(2),
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 2], [1, 2], [3, 2], [4, 2],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [false, false, true, false, false],
      [false, false, true, false, false],
      [true, true, true, true, true],
      [false, false, true, false, false],
      [false, false, true, false, false],
    ],
  },

  // 11. 4 Postage Stamps
  {
    id: 'FOUR_POSTAGE_STAMPS',
    nameAm: '4 የቴምብር ቦታዎች (በየማዕዘኑ ያሉ የ 2x2 ሳጥኖች)',
    nameEn: 'A 2x2 square filled in each of the four corners',
    descAm: 'በአራቱም ማዕዘኖች ውስጥ ያሉ አራት 2x2 ሳጥኖች (16 ቁጥሮች)',
    descEn: 'A 2x2 square filled in each of the four corners (16 squares total)',
    checkWin: (m) => {
      const cells: [number, number][] = [
        [0, 0], [0, 1], [1, 0], [1, 1],
        [0, 3], [0, 4], [1, 3], [1, 4],
        [3, 0], [3, 1], [4, 0], [4, 1],
        [3, 3], [3, 4], [4, 3], [4, 4],
      ];
      return cells.every(([r, c]) => m[r][c]);
    },
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [0, 0], [0, 1], [1, 0], [1, 1],
        [0, 3], [0, 4], [1, 3], [1, 4],
        [3, 0], [3, 1], [4, 0], [4, 1],
        [3, 3], [3, 4], [4, 3], [4, 4],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [true, true, false, true, true],
      [true, true, false, true, true],
      [false, false, false, false, false],
      [true, true, false, true, true],
      [true, true, false, true, true],
    ],
  },

  // 12. Top and Bottom Rows
  {
    id: 'TOP_AND_BOTTOM_ROWS',
    nameAm: 'የላይኛው እና የታችኛው አግድም መስመሮች',
    nameEn: 'The complete 1st (top) row and 5th (bottom) row',
    descAm: 'የመጀመሪያው (1ኛ) እና የመጨረሻው (5ኛ) አግድም መስመሮች ሙሉ በሙሉ',
    descEn: 'The complete 1st (top) row and 5th (bottom) row',
    checkWin: (m) => getCompletedRows(m).includes(0) && getCompletedRows(m).includes(4),
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, true, true, true, true],
    ],
  },

  // 13. Pyramid
  {
    id: 'PYRAMID',
    nameAm: 'የፒራሚድ ቅርጽ (ከላይ እስከ ታች የሚሰፋ)',
    nameEn: 'Top center square expanding down to a full bottom row',
    descAm: 'ከላይ መሃል ቁጥር ጀምሮ ወደ ታች ሙሉ መስመር የሚሰፋ ፒራሚድ',
    descEn: 'Top center square expanding down to a full bottom row',
    checkWin: (m) => {
      const cells: [number, number][] = [
        [0, 2],
        [1, 1], [1, 2], [1, 3],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
      ];
      return cells.every(([r, c]) => m[r][c]);
    },
    checkOneAway: (m, nums) => {
      const cells: [number, number][] = [
        [0, 2],
        [1, 1], [1, 2], [1, 3],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
      ];
      const un = cells.filter(([r, c]) => !m[r][c]);
      if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
      return null;
    },
    pattern: [
      [false, false, true, false, false],
      [false, true, true, true, false],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
    ],
  },

  // 14. 2 Intersecting Lines
  {
    id: 'TWO_INTERSECTING_LINES',
    nameAm: '2 የሚገናኙ (የጋራ ነጥብ ያላቸው) መስመሮች',
    nameEn: 'Any 2 lines that intersect at one shared number',
    descAm: 'በአንድ የጋራ ቁጥር የሚገናኙ 2 ሙሉ መስመሮች (አግድም+ቀጥታ ወይም መስመር+ዲያጎናል)',
    descEn: 'Any 2 complete lines that intersect at one shared number',
    checkWin: (m) => {
      const rCount = getCompletedRows(m).length;
      const cCount = getCompletedCols(m).length;
      const d1 = isDiag1Complete(m);
      const d2 = isDiag2Complete(m);
      const dCount = (d1 ? 1 : 0) + (d2 ? 1 : 0);
      if (rCount >= 1 && cCount >= 1) return true;
      if (dCount >= 1 && (rCount >= 1 || cCount >= 1)) return true;
      if (dCount >= 2) return true;
      return false;
    },
    checkOneAway: (m, nums) => {
      const compRows = getCompletedRows(m);
      const compCols = getCompletedCols(m);
      const d1 = isDiag1Complete(m);
      const d2 = isDiag2Complete(m);

      if (compRows.length >= 1) {
        for (let c = 0; c < 5; c++) {
          const un = [0, 1, 2, 3, 4].filter((r) => !m[r][c]);
          if (un.length === 1) return { neededNumber: nums[un[0]][c], neededCell: [un[0], c] };
        }
        const unD1 = [0, 1, 2, 3, 4].filter((i) => !m[i][i]);
        if (unD1.length === 1) return { neededNumber: nums[unD1[0]][unD1[0]], neededCell: [unD1[0], unD1[0]] };
        const unD2 = [0, 1, 2, 3, 4].filter((i) => !m[i][4 - i]);
        if (unD2.length === 1) return { neededNumber: nums[unD2[0]][4 - unD2[0]], neededCell: [unD2[0], 4 - unD2[0]] };
      }

      if (compCols.length >= 1) {
        for (let r = 0; r < 5; r++) {
          const un = [0, 1, 2, 3, 4].filter((c) => !m[r][c]);
          if (un.length === 1) return { neededNumber: nums[r][un[0]], neededCell: [r, un[0]] };
        }
        const unD1 = [0, 1, 2, 3, 4].filter((i) => !m[i][i]);
        if (unD1.length === 1) return { neededNumber: nums[unD1[0]][unD1[0]], neededCell: [unD1[0], unD1[0]] };
        const unD2 = [0, 1, 2, 3, 4].filter((i) => !m[i][4 - i]);
        if (unD2.length === 1) return { neededNumber: nums[unD2[0]][4 - unD2[0]], neededCell: [unD2[0], 4 - unD2[0]] };
      }

      if (d1 || d2) {
        for (let r = 0; r < 5; r++) {
          const un = [0, 1, 2, 3, 4].filter((c) => !m[r][c]);
          if (un.length === 1) return { neededNumber: nums[r][un[0]], neededCell: [r, un[0]] };
        }
        for (let c = 0; c < 5; c++) {
          const un = [0, 1, 2, 3, 4].filter((r) => !m[r][c]);
          if (un.length === 1) return { neededNumber: nums[un[0]][c], neededCell: [un[0], c] };
        }
        if (d1 && !d2) {
          const unD2 = [0, 1, 2, 3, 4].filter((i) => !m[i][4 - i]);
          if (unD2.length === 1) return { neededNumber: nums[unD2[0]][4 - unD2[0]], neededCell: [unD2[0], 4 - unD2[0]] };
        }
        if (d2 && !d1) {
          const unD1 = [0, 1, 2, 3, 4].filter((i) => !m[i][i]);
          if (unD1.length === 1) return { neededNumber: nums[unD1[0]][unD1[0]], neededCell: [unD1[0], unD1[0]] };
        }
      }

      return null;
    },
    pattern: [
      [false, false, false, true, false],
      [false, false, false, true, false],
      [true, true, true, true, true],
      [false, false, false, true, false],
      [false, false, false, true, false],
    ],
  },

  // 15. Block of 6 Numbers (2x3 or 3x2)
  {
    id: 'SIX_NUMBERS_BLOCK',
    nameAm: 'የ 6 ቁጥሮች ሳጥን (በማንኛውም ቦታ ያለ 2x3 ስብስብ)',
    nameEn: 'Any block of 6 numbers in a 2x3 or 3x2 grid',
    descAm: 'በካርዱ ላይ በማንኛውም ቦታ ያለ የተሞላ 2x3 ወይም 3x2 ስብስብ (6 ቁጥሮች)',
    descEn: 'Any solid block of 6 numbers in a 2x3 or 3x2 grid anywhere on the card',
    checkWin: (m) => {
      // Check 2x3 blocks
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c <= 2; c++) {
          let allMarked = true;
          for (let dr = 0; dr < 2; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              if (!m[r + dr][c + dc]) { allMarked = false; break; }
            }
            if (!allMarked) break;
          }
          if (allMarked) return true;
        }
      }
      // Check 3x2 blocks
      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 3; c++) {
          let allMarked = true;
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 2; dc++) {
              if (!m[r + dr][c + dc]) { allMarked = false; break; }
            }
            if (!allMarked) break;
          }
          if (allMarked) return true;
        }
      }
      return false;
    },
    checkOneAway: (m, nums) => {
      // Check 2x3 blocks
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c <= 2; c++) {
          const un: [number, number][] = [];
          for (let dr = 0; dr < 2; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              if (!m[r + dr][c + dc]) un.push([r + dr, c + dc]);
            }
          }
          if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
        }
      }
      // Check 3x2 blocks
      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 3; c++) {
          const un: [number, number][] = [];
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 2; dc++) {
              if (!m[r + dr][c + dc]) un.push([r + dr, c + dc]);
            }
          }
          if (un.length === 1) return { neededNumber: nums[un[0][0]][un[0][1]], neededCell: un[0] };
        }
      }
      return null;
    },
    pattern: [
      [false, false, false, false, false],
      [false, true, true, true, false],
      [false, true, true, true, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
  },
];

// ============================================================================
// WIN DETECTION ACROSS ALL GAME CATEGORIES
// ============================================================================
export function detectWinningRules(
  marked: boolean[][],
  ruleType?: 'ONE_LINE_OR_CORNERS' | 'STANDARD' | 'FULL_HOUSE_ONLY' | string,
  specialRuleIndex: number = 0
): WinningRuleMatch[] {
  // CATEGORY 1: HYPER FETAN
  // - 1 Horizontal Row
  // - 1 Vertical Column ("add vertical")
  // - 1 Diagonal Line ("remove x and make it diagonal")
  // - 4 Corners
  // - REMOVED: Full House, Letter X, 2 Horizontal lines
  if (ruleType === 'ONE_LINE_OR_CORNERS') {
    const fourCorners = checkFourCornersWin(marked);
    const diag = isDiag1Complete(marked) || isDiag2Complete(marked);
    const vert = getCompletedCols(marked).length >= 1;
    const horiz = getCompletedRows(marked).length >= 1;

    return [
      { id: 'FOUR_CORNERS', label: '4 Corners', labelAm: '4 ማዕዘናት', rank: 1, isMatch: fourCorners },
      { id: 'DIAGONAL_LINE', label: 'Diagonal Line', labelAm: '1 ዲያጎናል መስመር', rank: 2, isMatch: diag },
      { id: 'VERTICAL_LINE', label: 'Vertical Line', labelAm: '1 ቀጥታ (Vertical) መስመር', rank: 3, isMatch: vert },
      { id: 'HORIZONTAL_LINE', label: 'Horizontal Line', labelAm: '1 አግድም መስመር', rank: 4, isMatch: horiz },
    ];
  }

  // CATEGORY 3: HYPER WEEKEND (Full House Only)
  if (ruleType === 'FULL_HOUSE_ONLY') {
    const fullHouse = checkFullHouseWin(marked);
    return [
      { id: 'FULL_HOUSE', label: 'Full House', labelAm: 'ሙሉ ቤት', rank: 1, isMatch: fullHouse },
    ];
  }

  // CATEGORY 2: HYPER SPECIAL (Exactly 1 active rule per game until finished)
  const activeRule = HYPER_SPECIAL_RULES[Math.abs(specialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
  const isMatch = activeRule.checkWin(marked);

  return [
    {
      id: activeRule.id,
      label: activeRule.nameEn,
      labelAm: activeRule.nameAm,
      rank: 1,
      isMatch,
    },
  ];
}

export function getBestWinningRule(
  marked: boolean[][],
  ruleType?: 'ONE_LINE_OR_CORNERS' | 'STANDARD' | 'FULL_HOUSE_ONLY' | string,
  specialRuleIndex: number = 0
): WinningRuleMatch | null {
  const matches = detectWinningRules(marked, ruleType, specialRuleIndex).filter((r) => r.isMatch).sort((a, b) => a.rank - b.rank);
  return matches.length > 0 ? matches[0] : null;
}

export interface OneAwayStatus {
  isOneAway: boolean;
  neededNumber: number | null;
  neededCell: [number, number] | null;
  ruleLabel: string;
  ruleLabelAm: string;
}

export function checkOneAwayStatus(
  marked: boolean[][],
  numbers: number[][],
  ruleType?: 'ONE_LINE_OR_CORNERS' | 'STANDARD' | 'FULL_HOUSE_ONLY' | string,
  specialRuleIndex: number = 0
): OneAwayStatus {
  // If already won a pattern according to this game's rule, not 1-away
  if (getBestWinningRule(marked, ruleType, specialRuleIndex)) {
    return { isOneAway: false, neededNumber: null, neededCell: null, ruleLabel: '', ruleLabelAm: '' };
  }

  // CATEGORY 1: HYPER FETAN (4 Corners, Vertical, Diagonal, Horizontal)
  // FULL HOUSE IS EXCLUDED!
  if (ruleType === 'ONE_LINE_OR_CORNERS') {
    // 1. Check 4 corners
    const corners: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];
    const unmarkedCorners = corners.filter(([r, c]) => !marked[r][c]);
    if (unmarkedCorners.length === 1) {
      const [r, c] = unmarkedCorners[0];
      return {
        isOneAway: true,
        neededNumber: numbers[r][c],
        neededCell: [r, c],
        ruleLabel: '4 Corners',
        ruleLabelAm: '4 ማዕዘናት',
      };
    }

    // 2. Check Vertical Columns ("add vertical")
    for (let c = 0; c < 5; c++) {
      const unmarked = [0, 1, 2, 3, 4].filter((r) => !marked[r][c]);
      if (unmarked.length === 1) {
        const r = unmarked[0];
        return {
          isOneAway: true,
          neededNumber: numbers[r][c],
          neededCell: [r, c],
          ruleLabel: 'Vertical Line',
          ruleLabelAm: '1 ቀጥታ (Vertical) መስመር',
        };
      }
    }

    // 3. Check Diagonal 1 (\) ("remove x and make it diagonal")
    const diag1Unmarked = [0, 1, 2, 3, 4].filter((i) => !marked[i][i]);
    if (diag1Unmarked.length === 1) {
      const i = diag1Unmarked[0];
      return {
        isOneAway: true,
        neededNumber: numbers[i][i],
        neededCell: [i, i],
        ruleLabel: 'Diagonal Line',
        ruleLabelAm: '1 ዲያጎናል መስመር',
      };
    }

    // 4. Check Diagonal 2 (/)
    const diag2Unmarked = [0, 1, 2, 3, 4].filter((i) => !marked[i][4 - i]);
    if (diag2Unmarked.length === 1) {
      const i = diag2Unmarked[0];
      return {
        isOneAway: true,
        neededNumber: numbers[i][4 - i],
        neededCell: [i, 4 - i],
        ruleLabel: 'Diagonal Line',
        ruleLabelAm: '1 ዲያጎናል መስመር',
      };
    }

    // 5. Check Horizontal Rows ("remove the 2 horizontal line", only 1 needed)
    for (let r = 0; r < 5; r++) {
      const unmarked = [0, 1, 2, 3, 4].filter((c) => !marked[r][c]);
      if (unmarked.length === 1) {
        const c = unmarked[0];
        return {
          isOneAway: true,
          neededNumber: numbers[r][c],
          neededCell: [r, c],
          ruleLabel: 'Horizontal Line',
          ruleLabelAm: '1 አግድም መስመር',
        };
      }
    }

    return { isOneAway: false, neededNumber: null, neededCell: null, ruleLabel: '', ruleLabelAm: '' };
  }

  // CATEGORY 3: HYPER WEEKEND (Full House Only)
  if (ruleType === 'FULL_HOUSE_ONLY') {
    let fullHouseUnmarked: [number, number][] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (!marked[r][c]) fullHouseUnmarked.push([r, c]);
      }
    }
    if (fullHouseUnmarked.length === 1) {
      const [r, c] = fullHouseUnmarked[0];
      return {
        isOneAway: true,
        neededNumber: numbers[r][c],
        neededCell: [r, c],
        ruleLabel: 'Full House',
        ruleLabelAm: 'ሙሉ ቤት',
      };
    }
    return { isOneAway: false, neededNumber: null, neededCell: null, ruleLabel: '', ruleLabelAm: '' };
  }

  // CATEGORY 2: HYPER SPECIAL (Uses the one active rule for this game)
  const activeRule = HYPER_SPECIAL_RULES[Math.abs(specialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
  const specialOneAway = activeRule.checkOneAway(marked, numbers);
  if (specialOneAway) {
    return {
      isOneAway: true,
      neededNumber: specialOneAway.neededNumber,
      neededCell: specialOneAway.neededCell,
      ruleLabel: activeRule.nameEn,
      ruleLabelAm: activeRule.nameAm,
    };
  }

  return { isOneAway: false, neededNumber: null, neededCell: null, ruleLabel: '', ruleLabelAm: '' };
}

/**
 * Generates dynamic HIT & Requirement guidance for a card.
 */
export function getGameHitRequirement(
  marked: boolean[][],
  numbers: number[][],
  ruleType: 'ONE_LINE_OR_CORNERS' | 'STANDARD' | 'FULL_HOUSE_ONLY' | string = 'STANDARD',
  language: string = 'en',
  specialRuleIndex: number = 0
): { isHit: boolean; hitTitle: string; hitDetail: string; neededNumber: number | null; progressText: string } {
  const isAm = language === 'am';
  const bestWin = getBestWinningRule(marked, ruleType, specialRuleIndex);
  if (bestWin) {
    return {
      isHit: true,
      hitTitle: isAm ? '🎉 አሸናፊ ነዎት!' : '🎉 BINGO READY!',
      hitDetail: isAm ? `የ ${bestWin.labelAm} ጥምረት ተጠናቋል! አሁኑኑ BINGO ይጫኑ!` : `${bestWin.label} complete! Tap BINGO to claim!`,
      neededNumber: null,
      progressText: '100% Complete',
    };
  }

  const oneAway = checkOneAwayStatus(marked, numbers, ruleType, specialRuleIndex);
  if (oneAway.isOneAway && oneAway.neededNumber) {
    const label = isAm ? oneAway.ruleLabelAm : oneAway.ruleLabel;
    return {
      isHit: true,
      hitTitle: isAm ? `🔥 የድል ሂት! 1 ቁጥር ብቻ ቀረዎ!` : `🔥 HIT ALERT! 1 Ball Away!`,
      hitDetail: isAm 
        ? `ለ ${label} ድል ቁጥር #${oneAway.neededNumber} ያስፈልግዎታል!` 
        : `Need Ball #${oneAway.neededNumber} for ${label} Win!`,
      neededNumber: oneAway.neededNumber,
      progressText: isAm ? '1 ብቻ ቀረ' : '1 away',
    };
  }

  // Not 1-away: provide exact requirement and current progress
  if (ruleType === 'ONE_LINE_OR_CORNERS') {
    const corners: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];
    const markedCorners = corners.filter(([r, c]) => marked[r][c]).length;

    let maxLine = 0;
    for (let r = 0; r < 5; r++) {
      const c = [0, 1, 2, 3, 4].filter((col) => marked[r][col]).length;
      if (c > maxLine) maxLine = c;
    }
    for (let c = 0; c < 5; c++) {
      const r = [0, 1, 2, 3, 4].filter((row) => marked[row][c]).length;
      if (r > maxLine) maxLine = r;
    }
    const d1 = [0, 1, 2, 3, 4].filter((i) => marked[i][i]).length;
    const d2 = [0, 1, 2, 3, 4].filter((i) => marked[i][4 - i]).length;
    if (d1 > maxLine) maxLine = d1;
    if (d2 > maxLine) maxLine = d2;

    return {
      isHit: false,
      hitTitle: isAm ? '🎯 የሚያስፈልገው: 1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት' : '🎯 Win Condition: 1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners',
      hitDetail: isAm 
        ? `ማንኛውም 1 መስመር (አግድም፣ ቀጥታ፣ ዲያጎናል) ወይም አራቱን ማዕዘናት በማጠናቀቅ ያሸንፉ!`
        : `Complete any 1 Row, Column, Diagonal, or all 4 Corners to win!`,
      neededNumber: null,
      progressText: `${Math.max(markedCorners, maxLine)} / 5`,
    };
  }

  if (ruleType === 'FULL_HOUSE_ONLY') {
    let totalMarked = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (marked[r][c]) totalMarked++;
      }
    }
    const remaining = 25 - totalMarked;
    return {
      isHit: false,
      hitTitle: isAm ? '🏆 የሚያስፈልገው: ሙሉ ቤት ብቻ (Full House Only)' : '🏆 Win Condition: Full House Only',
      hitDetail: isAm 
        ? `በካርዱ ላይ ያሉትን ሁሉንም 24 ቁጥሮች ምልክት በማድረግ ሙሉ ቤት ያሸንፉ (${totalMarked}/25 ተጠናቋል)` 
        : `Mark all 24 numbers on your card to win Full House jackpot (${totalMarked}/25 marked, ${remaining} needed)`,
      neededNumber: null,
      progressText: `${totalMarked}/25`,
    };
  }

  // CATEGORY 2: HYPER SPECIAL (Active Round Law)
  const activeRule = HYPER_SPECIAL_RULES[Math.abs(specialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
  return {
    isHit: false,
    hitTitle: isAm ? `🎲 የዚህ ዙር ሕግ: ${activeRule.nameAm}` : `🎲 Round Law: ${activeRule.nameEn}`,
    hitDetail: isAm ? activeRule.descAm : activeRule.descEn,
    neededNumber: null,
    progressText: isAm ? 'ንቁ ሕግ' : 'Active Law',
  };
}

export const HYPER_FETAN_RULES = [
  {
    id: 'HORIZONTAL_LINE',
    title: '1 Horizontal Line',
    titleAm: '1 አግድም መስመር',
    subtitle: 'Any complete horizontal row (Row 1..5)',
    subtitleAm: 'ማንኛውም 1 ሙሉ አግድም መስመር',
    pattern: [
      [false, false, false, false, false],
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
  },
  {
    id: 'VERTICAL_LINE',
    title: '1 Vertical Line',
    titleAm: '1 ቀጥታ (Vertical) መስመር',
    subtitle: 'Any complete vertical column (B, I, N, G, O)',
    subtitleAm: 'ማንኛውም 1 ሙሉ ቀጥታ አምድ',
    pattern: [
      [false, true, false, false, false],
      [false, true, false, false, false],
      [false, true, false, false, false],
      [false, true, false, false, false],
      [false, true, false, false, false],
    ],
  },
  {
    id: 'DIAGONAL_LINE',
    title: '1 Diagonal Line',
    titleAm: '1 ዲያጎናል መስመር',
    subtitle: 'Any 1 diagonal corner-to-corner line',
    subtitleAm: 'ማንኛውም 1 ከማዕዘን ወደ ማዕዘን የሚያልፍ ዲያጎናል',
    pattern: [
      [true, false, false, false, false],
      [false, true, false, false, false],
      [false, false, true, false, false],
      [false, false, false, true, false],
      [false, false, false, false, true],
    ],
  },
  {
    id: 'FOUR_CORNERS',
    title: '4 Corners',
    titleAm: '4 ማዕዘናት',
    subtitle: 'All 4 corner squares marked',
    subtitleAm: 'አራቱም ማዕዘናት የተሟሉ',
    pattern: [
      [true, false, false, false, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, false, false, false, true],
    ],
  },
];

export const WINNING_RULES_PATTERNS = HYPER_FETAN_RULES;


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

export const LOTTERY_NUMBERS_TOTAL = 1500;
export const LOTTERY_MAX_SLOTS = 5;

export interface LotterySoldMap {
  [gameId: string]: Set<number>;
}

const GLOBAL_LOTTERY_SOLD_SEED: Record<string, number[]> = {
  gm_weekend_35: [
    393, 400, 401, 406, 411, 417, 421, 423, 429, 434, 435, 437,
    443, 444, 445, 449, 1, 12, 25, 37, 48, 59, 62, 73, 84, 95,
    108, 112, 127, 138, 149, 156, 161, 174, 185, 199, 204, 218,
    221, 233, 245, 256, 267, 278, 289, 292, 305, 314, 325, 336,
    347, 358, 369, 379, 384, 388, 512, 525, 533, 601, 647, 700,
    712, 756, 808, 845, 901, 999, 1025, 1100, 1201, 1299, 1350, 1410,
  ],
  gm_weekend_50: [
    7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105,
    112, 119, 126, 133, 140, 147, 154, 161, 168, 175, 182, 189,
    196, 203, 210, 217, 224, 231, 238, 245, 252, 259, 266, 273,
    280, 287, 294, 301, 308, 315, 322, 329, 336, 343, 350, 357,
    364, 371, 378, 385, 392, 399, 406, 413, 420, 427, 434, 441,
    448, 455, 462, 469, 476, 483, 490, 497, 550, 625, 700, 777,
    850, 925, 1000, 1075, 1150, 1225, 1300, 1375, 1450,
  ],
  gm_weekend_100: [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
    150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260,
    270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380,
    390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500,
    600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
  ],
};

export function generateSoldNumbersForGame(gameId: string, count: number, entryPrice: number): Set<number> {
  const sold = new Set<number>();
  const isFetan = gameId.includes('fetan') || entryPrice <= 10;
  const total = isFetan ? 500 : 1500;
  const seeded = GLOBAL_LOTTERY_SOLD_SEED[gameId];
  if (seeded) {
    seeded.forEach((n) => {
      if (n <= total) sold.add(n);
    });
  }
  const seed = entryPrice * 7 + 13;
  let i = 0;
  const targetCount = isFetan ? Math.min(count, 120) : count;
  while (sold.size < targetCount && i < 2500) {
    const n = ((seed + i * 53) % total) + 1;
    sold.add(n);
    i++;
  }
  return sold;
}

export function formatLotteryCardNumber(num: number): string {
  return String(num).padStart(4, '0');
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
