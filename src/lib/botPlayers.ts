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
 * Returns current hour in Ethiopia (UTC+3 / East Africa Time, 0..23).
 */
export function getEthiopianHour(): number {
  const now = new Date();
  return (now.getUTCHours() + 3) % 24;
}

/**
 * Generates realistic player counts:
 * - Night / after midnight up to morning (0:00 - 6:00 AM): small players (people sleeping)
 *   - Fetan: 25..50 players
 *   - Special: 75..130 players
 * - Morning up to lunch (6:00 AM - 1:00 PM):
 *   - Fetan: 150..200 players
 *   - Special: 680..800 players
 * - Afternoon & Evening (1:00 PM - 12:00 AM midnight):
 *   - Fetan: 250..330+ players
 *   - Special: 800..950 players
 * - Weekend: scheduled games (no morning/afternoon split) - starting 700 up to 1300 players
 */
export function getBotCountForGame(gameId: string, category?: string, roundSeed?: number): number {
  const seed = Math.abs(roundSeed ?? (Math.floor(Date.now() / 60000) * 17 + hashString(gameId)));
  const isFetan = category === 'HYPER_FETAN' || gameId.includes('fetan');
  const isSpecial = category === 'HYPER_SPECIAL' || gameId.includes('special');
  const isWeekend = category === 'HYPER_WEEKEND' || gameId.includes('weekend');
  const hour = getEthiopianHour();
  const isNight = hour >= 0 && hour < 6; // 12:00 AM midnight to 6:00 AM (sleeping hours)
  const isMorning = hour >= 6 && hour < 13; // 6:00 AM to 1:00 PM (lunch time)

  if (isFetan) {
    if (isNight) {
      return 25 + (seed % 26); // 25..50 players (small during sleeping hours)
    } else if (isMorning) {
      return 150 + (seed % 51); // 150..200 players
    } else {
      return 250 + (seed % 81); // 250..330 players (up to 300 and more)
    }
  }

  if (isSpecial) {
    if (isNight) {
      return 75 + (seed % 56); // 75..130 players (smaller during sleeping hours)
    } else if (isMorning) {
      return 680 + (seed % 121); // 680..800 players
    } else {
      return 800 + (seed % 151); // 800..950 players (~800 average)
    }
  }

  if (isWeekend) {
    // Weekend games are scheduled events at 3:00 PM (9:00 Ethiopia clock time).
    // Starting 700 up to 1300 players per scheduled game.
    const weekendSeed = Math.abs(hashString(gameId) + (roundSeed ? Math.floor(roundSeed / 86400000) : 0));
    return 700 + (weekendSeed % 601); // 700..1300 players
  }

  return 25 + (seed % 26);
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
 * Checks whether a Hyper Special rule is considered hard.
 * Hard rules (Full House, 3 Lines, Letter X, Frame, Stamps, Pyramid, etc.)
 * require 8+ marked cells.
 */
export function isSpecialRuleHard(specialRuleIndex?: number): boolean {
  if (typeof specialRuleIndex !== 'number') return false;
  const rule = HYPER_SPECIAL_RULES[Math.abs(specialRuleIndex) % HYPER_SPECIAL_RULES.length];
  if (!rule) return false;
  if (
    rule.id === 'FULL_HOUSE' ||
    rule.id === 'THREE_NON_INTERSECTING_LINES' ||
    rule.id === 'LETTER_X' ||
    rule.id === 'FOUR_POSTAGE_STAMPS' ||
    rule.id === 'PYRAMID'
  ) {
    return true;
  }
  let cellCount = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (rule.pattern[r][c] && !(r === 2 && c === 2)) {
        cellCount++;
      }
    }
  }
  return cellCount >= 8;
}

/**
 * Calculate the ball on which a bot will shout Bingo if no human has won yet.
 * User requirement:
 * - Fetan: win ball called 19–25 ball
 * - Special: if rule is hard 30–40 ball; if not 25–30 ball
 * - Weekend: win ball called 45–55 ball
 */
export function getTargetWinningBall(
  gameId: string,
  roundStartedAt: number,
  category?: string,
  specialRuleIndex?: number
): number {
  const seed = Math.abs(hashString(`${gameId}_${roundStartedAt}`));
  const isFetan = category === 'HYPER_FETAN' || gameId.includes('fetan');
  const isSpecial = category === 'HYPER_SPECIAL' || gameId.includes('special');
  const isWeekend = category === 'HYPER_WEEKEND' || gameId.includes('weekend');

  if (isFetan) {
    // Hyper Fetan: win ball called 19–25
    return 19 + (seed % 7); // 19..25
  }
  if (isSpecial) {
    // Hyper Special: hard rules 30–40, non-hard rules 25–30
    const hard = isSpecialRuleHard(specialRuleIndex);
    return hard ? 30 + (seed % 11) : 25 + (seed % 6);
  }
  if (isWeekend) {
    // Hyper Weekend: win ball called 45–55
    return 45 + (seed % 11); // 45..55
  }
  return 19 + (seed % 7);
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
    const isWeekend = category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY' || String(game.id).includes('weekend');
    const pricePerCard = parseFloat(String(game.entry_price || (isWeekend ? '50' : '10')));

    // Insert bot cards into game_cards (capped at 60 to prevent serverless DB timeouts)
    const cardsToInsert = botCards.slice(0, Math.min(targetBotCount, 60));
    for (const bot of cardsToInsert) {
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

    // Count human cards and update game's authoritative current_players count in DB
    const humanCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM game_cards
      WHERE game_id = ${game.id} AND (user_id NOT LIKE 'bot_%' OR user_id IS NULL)
    `;
    const humanCount = humanCountRows[0]?.count ?? 0;
    const totalPlayers = targetBotCount + humanCount;

    await sql`
      UPDATE games
      SET current_players = ${totalPlayers}, updated_at = NOW()
      WHERE id = ${game.id}
    `;

    return targetBotCount;
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
    if (game.status !== 'RUNNING' || drawnNumbers.length < 18) {
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
    const targetBall = getTargetWinningBall(game.id, roundStartedAt, category, game.active_special_rule_index);

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
    const targetBotCount = getBotCountForGame(game.id, category, roundStartedAt);
    const totalPlayers = Math.max(botRows.length, Number(game.current_players || 0), targetBotCount);
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
  const seed = hashString(gameId);
  const count = getBotCountForGame(gameId, category, seed);
  const cards = generateBotCards(gameId, category, count, new Set(), seed);
  return cards
    .map((c) => parseInt(c.cardNumber, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export interface BotActivityEntry {
  username: string;
  cardNumber: string;
  timeAgoSeconds: number; // how many seconds ago the bot "joined"
}

/**
 * Generates a list of recent bot activity entries (joins) for a game,
 * simulating a live-looking activity feed. Used in the Weekend game lobby
 * to show sold cards and active player joins before the game starts.
 */
export function getBotActivityFeed(gameId: string, category?: string, count = 12): BotActivityEntry[] {
  const seed = hashString(gameId + '_activity');
  const botCards = generateBotCards(gameId, category, Math.min(count, 60), new Set(), seed);
  const entries: BotActivityEntry[] = botCards.map((bot, i) => ({
    username: bot.username,
    cardNumber: bot.cardNumber,
    // Space joins 10–240 seconds apart to look natural
    timeAgoSeconds: 10 + ((seed + i * 37) % 230),
  }));
  // Sort so most recent joins appear first
  entries.sort((a, b) => a.timeAgoSeconds - b.timeAgoSeconds);
  return entries;
}
