/**
 * Bot Player System for Hyper Bingo
 * 
 * Simulates active multiplayer rooms by adding realistic Ethiopian bot players.
 * Bots buy cards (shown as sold on the board), increase player counts, scale
 * up the prize pool (Derash), and win games most of the time to keep the gameplay
 * lively and engaging.
 */

import { WinnerRecord } from './types';
import { HYPER_SPECIAL_RULES, computeWeekendPrizePool } from './bingoUtils';

export const ETHIOPIAN_BOT_NAMES: string[] = [
  'Abebe_K', 'Selam_T', 'Dawit_G', 'Tigist_M', 'Natnael_B',
  'Meron_H', 'Yonas_A', 'Biruk_D', 'Bethel_S', 'Henok_T',
  'Almaz_W', 'Eyob_S', 'Kalkidan_R', 'Fitsum_E', 'Sara_M',
  'Robel_T', 'Hanna_B', 'Ermias_K', 'Blen_A', 'Kidus_N',
  'Marta_Y', 'Solomon_D', 'Lidya_T', 'Samuel_G', 'Rahel_M',
  'Daniel_A', 'Ruth_K', 'Abel_F', 'Tsion_H', 'Binyam_S',
  'Fikirte_Z', 'Desta_B', 'Girma_T', 'Eden_M', 'Mulu_K',
  'Tamirat_D', 'Hiwot_A', 'Nebiyu_S', 'Beza_W', 'Yared_L',
  'Tsige_R', 'Berhanu_K', 'Aster_G', 'Kassahun_M', 'Senait_T',
  'Ashenafi_B', 'Meseret_Y', 'Tesfaye_H', 'Genet_A', 'Zelalem_D',
  'Surafel_M', 'Netsanet_E', 'Alemayehu_P', 'Fasika_B', 'Tewodros_K',
  'Worknesh_T', 'Getachew_L', 'Tadele_M', 'Senait_G', 'Yohannes_A'
];

const SPECIAL_PRESET_CARDS = [
  '12608', '11302', '24890', '35012', '98104',
  '44192', '53001', '67123', '78904', '81234',
  '19045', '27651', '63421', '89100', '95420',
  '14320', '28901', '33412', '45980', '51209',
  '62104', '73491', '84012', '91230', '97801'
];

/** Hash string to integer */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates a randomized bot count for a game round.
 * Different games and different rounds always receive a different count
 * so rooms look natural and varied.
 */
export function getBotCountForGame(gameId: string, category?: string, roundSeed?: number): number {
  const seed = roundSeed ?? (Math.floor(Date.now() / 60000) * 17 + hashString(gameId));
  const isFetan = category === 'HYPER_FETAN' || gameId.includes('fetan');
  const isSpecial = category === 'HYPER_SPECIAL' || gameId.includes('special');
  const isWeekend = category === 'HYPER_WEEKEND' || gameId.includes('weekend');

  if (isFetan) {
    // 12 to 26 bots (e.g. 14, 21, 18, 25, 13)
    return 12 + (seed % 15);
  }
  if (isSpecial) {
    // 18 to 38 bots (e.g. 22, 34, 27, 37, 19)
    return 18 + (seed % 21);
  }
  if (isWeekend) {
    // 35 to 75 bots (e.g. 42, 68, 55, 73, 49)
    return 35 + (seed % 41);
  }
  return 10 + (seed % 12);
}

export interface BotCardInfo {
  id: string;
  gameId: string;
  cardNumber: string;
  userId: string;
  username: string;
  cost: number;
}

/**
 * Generate bot card assignments for a game round, avoiding any already-sold cards.
 */
export function generateBotCards(
  gameId: string,
  category: string | undefined,
  count: number,
  existingCards: Set<string> = new Set(),
  roundSeed?: number
): BotCardInfo[] {
  const isFetan = category === 'HYPER_FETAN' || gameId.includes('fetan');
  const isSpecial = category === 'HYPER_SPECIAL' || gameId.includes('special');
  const isWeekend = category === 'HYPER_WEEKEND' || gameId.includes('weekend');
  const maxNumber = isFetan ? 500 : isWeekend ? 1500 : 99999;
  const price = isWeekend ? 50 : 10;

  const cards: BotCardInfo[] = [];
  const usedNumbers = new Set<string>(existingCards);
  const usedNames = new Set<string>();

  // Shuffle name pool based on seed
  const seed = roundSeed ?? Date.now();
  const namePool = [...ETHIOPIAN_BOT_NAMES].sort((a, b) => {
    return (hashString(a + seed) % 100) - (hashString(b + seed) % 100);
  });

  for (let i = 0; i < count; i++) {
    // Pick bot username
    let botName = namePool[i % namePool.length];
    if (usedNames.has(botName)) {
      botName = `${botName}_${(i % 9) + 1}`;
    }
    usedNames.add(botName);
    const botUserId = `bot_${botName.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

    // Pick unique card number
    let cardNumber = '';
    if (isSpecial && i < SPECIAL_PRESET_CARDS.length && !usedNumbers.has(SPECIAL_PRESET_CARDS[i])) {
      cardNumber = SPECIAL_PRESET_CARDS[i];
    } else {
      let attempts = 0;
      while (attempts < 100) {
        attempts++;
        const candidate = isSpecial
          ? String(10000 + ((seed + i * 79 + attempts * 13) % 89999))
          : String(1 + ((seed + i * 37 + attempts * 7) % maxNumber));
        if (!usedNumbers.has(candidate)) {
          cardNumber = candidate;
          break;
        }
      }
      if (!cardNumber) {
        cardNumber = String(1 + (i % maxNumber));
      }
    }

    usedNumbers.add(cardNumber);

    cards.push({
      id: `gc_${gameId}_bot_${cardNumber}`,
      gameId,
      cardNumber,
      userId: botUserId,
      username: botName,
      cost: price,
    });
  }

  return cards;
}

/**
 * Calculate the ball on which a bot will shout Bingo if no human has won yet.
 * In 75-ball bingo:
 * - 1 line / 4 corners (Fetan): hits around ball 15-24
 * - Special patterns (2 lines, X, etc.): hits around ball 18-30
 * - Full House (Weekend): hits around ball 52-64
 */
export function getTargetWinningBall(
  gameId: string,
  roundStartedAt: number,
  category?: string
): number {
  const seed = Math.abs(hashString(`${gameId}_${roundStartedAt}`));
  const isFetan = category === 'HYPER_FETAN' || gameId.includes('fetan');
  const isSpecial = category === 'HYPER_SPECIAL' || gameId.includes('special');
  const isWeekend = category === 'HYPER_WEEKEND' || gameId.includes('weekend');

  if (isFetan) {
    return 15 + (seed % 10); // ball 15..24
  }
  if (isSpecial) {
    return 18 + (seed % 13); // ball 18..30
  }
  if (isWeekend) {
    return 52 + (seed % 13); // ball 52..64
  }
  return 17 + (seed % 10);
}

/**
 * Determine a realistic winning pattern description for the bot's claim.
 */
export function getBotWinningPattern(
  category?: string,
  gameId?: string,
  specialRuleIndex?: number
): string {
  const isFetan = category === 'HYPER_FETAN' || (gameId && gameId.includes('fetan'));
  const isSpecial = category === 'HYPER_SPECIAL' || (gameId && gameId.includes('special'));
  const isWeekend = category === 'HYPER_WEEKEND' || (gameId && gameId.includes('weekend'));

  if (isSpecial && typeof specialRuleIndex === 'number') {
    const rule = HYPER_SPECIAL_RULES[Math.abs(specialRuleIndex) % HYPER_SPECIAL_RULES.length];
    return `${rule.nameEn} (${rule.nameAm})`;
  }
  if (isWeekend) {
    return 'Full House (ሙሉ ቤት)';
  }
  if (isFetan) {
    const patterns = [
      '1 Horizontal Line (አንድ አግድም መስመር)',
      '1 Vertical Line (አንድ ቀጥታ መስመር)',
      '1 Diagonal Line (አንድ ዲያጎናል)',
      '4 Corners (4 ማዕዘናት)'
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }
  return '1 Line (አንድ መስመር)';
}

/**
 * Server Database helper: Ensure bot players exist in `game_cards` for this game.
 * Inserts bot player cards and updates `games.current_players`.
 */
export async function ensureBotPlayersInDb(
  sql: any,
  game: any
): Promise<number> {
  try {
    // Count existing bot cards in DB for this game
    const botCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM game_cards
      WHERE game_id = ${game.id} AND user_id LIKE 'bot_%'
    `;
    const existingBotCount = botCountRows[0]?.count ?? 0;

    // If bots are already populated for this round, nothing to do
    if (existingBotCount > 0) {
      return existingBotCount;
    }

    // Determine target bot count (varied per game & round)
    const category = game.category || game.game_type;
    const roundSeed = game.round_started_at ? new Date(game.round_started_at).getTime() : Date.now();
    const targetBotCount = getBotCountForGame(game.id, category, roundSeed);

    // Get any existing non-bot card numbers to avoid collisions
    const existingRows = await sql`
      SELECT card_number FROM game_cards WHERE game_id = ${game.id}
    `;
    const takenCardNumbers = new Set<string>(existingRows.map((r: any) => String(r.card_number)));

    // Generate fresh bot cards
    const botCards = generateBotCards(game.id, category, targetBotCount, takenCardNumbers, roundSeed);
    const pricePerCard = parseFloat(String(game.entry_price || '10'));

    // Insert bot cards into game_cards
    for (const bot of botCards) {
      await sql`
        INSERT INTO game_cards (id, game_id, card_number, user_id, username, cost, is_registered, is_paid)
        VALUES (
          ${bot.id},
          ${bot.gameId},
          ${bot.cardNumber},
          ${bot.userId},
          ${bot.username},
          ${pricePerCard},
          TRUE,
          TRUE
        )
        ON CONFLICT (game_id, card_number) DO NOTHING
      `;
    }

    // Update game's current_players count
    await sql`
      UPDATE games
      SET current_players = (
        SELECT COUNT(*)::integer FROM game_cards WHERE game_id = ${game.id} AND is_paid IS DISTINCT FROM FALSE
      ), updated_at = NOW()
      WHERE id = ${game.id}
    `;

    return botCards.length;
  } catch (err) {
    console.error(`[ensureBotPlayersInDb] Error seeding bots for ${game.id}:`, err);
    return 0;
  }
}

/**
 * Server Database helper: Check if a bot player should win the game.
 * "most of the time win the game the bot player"
 */
export async function checkAndTriggerBotWin(
  sql: any,
  game: any,
  drawnNumbers: number[],
  currentBall: number
): Promise<WinnerRecord | null> {
  try {
    if (game.status !== 'RUNNING' || drawnNumbers.length < 12) {
      return null;
    }

    // Check if there are already winners
    const winners = Array.isArray(game.winners)
      ? game.winners
      : (typeof game.winners === 'string' ? JSON.parse(game.winners || '[]') : []);
    if (winners.length > 0) {
      return null;
    }

    // Calculate target winning ball count for this round
    const roundStartedAt = game.round_started_at ? new Date(game.round_started_at).getTime() : Date.now();
    const category = game.category || game.game_type;
    const targetBall = getTargetWinningBall(game.id, roundStartedAt, category);

    // If drawn balls haven't reached the target winning ball yet, continue drawing
    if (drawnNumbers.length < targetBall) {
      return null;
    }

    // Fetch bot cards for this game
    const botRows = await sql`
      SELECT card_number, user_id, username FROM game_cards
      WHERE game_id = ${game.id} AND user_id LIKE 'bot_%'
    `;
    if (!botRows || botRows.length === 0) {
      return null;
    }

    // Pick winning bot (deterministic based on roundStartedAt)
    const winningBot = botRows[Math.abs(hashString(String(roundStartedAt))) % botRows.length];

    // Calculate total prize pool
    const totalPlayers = Math.max(botRows.length, Number(game.current_players || botRows.length));
    const entryPrice = parseFloat(String(game.entry_price || '10'));
    const isWeekend = category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY';
    const prizeWon = isWeekend
      ? computeWeekendPrizePool(entryPrice, totalPlayers)
      : Math.round(totalPlayers * entryPrice * 0.80);

    const pattern = getBotWinningPattern(category, game.id, game.active_special_rule_index);

    const botWinner: WinnerRecord = {
      userId: winningBot.user_id,
      username: winningBot.username,
      cardNumber: winningBot.card_number,
      winningBall: currentBall,
      pattern,
      prizeWon,
      claimedAt: new Date().toISOString(),
    };

    // Update game status to COMPLETED and append bot winner
    await sql`
      UPDATE games
      SET
        status = 'COMPLETED',
        winners = ${JSON.stringify([botWinner])}::jsonb,
        updated_at = NOW()
      WHERE id = ${game.id} AND status = 'RUNNING' AND (winners = '[]'::jsonb OR winners IS NULL)
    `;

    return botWinner;
  } catch (err) {
    console.error(`[checkAndTriggerBotWin] Error triggering bot win for ${game.id}:`, err);
    return null;
  }
}

/**
 * Returns initial bot sold cards for a game to show on initial client load.
 */
export function getInitialBotSoldCardNumbers(gameId: string, category?: string): number[] {
  const count = getBotCountForGame(gameId, category, 100);
  const cards = generateBotCards(gameId, category, count, new Set(), 100);
  return cards
    .map((c) => parseInt(c.cardNumber, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}
