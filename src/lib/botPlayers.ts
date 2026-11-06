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

// Predominantly Ethiopian boy names (~75%) mixed with Ethiopian girl names (~25%)
export const ETHIOPIAN_BOY_NAMES: string[] = [
  'Abebe', 'Yonas', 'Dani', 'Dawit', 'Samuel', 'Henok', 'Natnael', 'Biruk',
  'Eyob', 'Fitsum', 'Robel', 'Ermias', 'Kidus', 'Solomon', 'Binyam', 'Desta',
  'Girma', 'Tamirat', 'Nebiyu', 'Yared', 'Berhanu', 'Kassahun', 'Ashenafi', 'Tesfaye',
  'Zelalem', 'Surafel', 'Alemayehu', 'Tewodros', 'Getachew', 'Tadele', 'Yohannes', 'Kirubel',
  'Bereket', 'Tariku', 'Mikael', 'Abel', 'Nahom', 'Kalab', 'Dagim', 'Leul',
  'Habtamu', 'Tedros', 'Bekele', 'Alemu', 'Kebede', 'Muluken', 'Fasil', 'Abiy',
  'Amanuel', 'Mikiyas', 'Tadesse', 'Sisay', 'Haile', 'Anteneh', 'Mengistu', 'Aman'
];

export const ETHIOPIAN_GIRL_NAMES: string[] = [
  'Selam', 'Tigist', 'Meron', 'Bethel', 'Almaz', 'Kalkidan', 'Sara', 'Hanna',
  'Blen', 'Marta', 'Lidya', 'Rahel', 'Ruth', 'Tsion', 'Fikirte', 'Eden',
  'Mulu', 'Hiwot', 'Beza', 'Tsige', 'Aster', 'Senait', 'Meseret', 'Genet',
  'Netsanet', 'Fasika', 'Worknesh', 'Lemlem', 'Helen', 'Hawani'
];

export const REALISTIC_NUMBER_SUFFIXES: string[] = [
  '7', '9', '10', '11', '12', '14', '17', '19', '21', '22', '23', '24',
  '25', '27', '33', '44', '55', '77', '80', '88', '89', '90', '95', '98', '99',
  '01', '04', '07', '08', '2024', '2025'
];

export const INITIAL_LETTERS: string[] = ['k', 't', 'g', 'm', 'b', 'h', 'a', 'd', 's', 'w', 'r', 'e', 'y', 'f', 'l'];

const GIRL_NAME_PREFIXES: string[] = [
  'selam', 'tigist', 'meron', 'bethel', 'almaz', 'kalkidan', 'sara', 'hanna',
  'blen', 'marta', 'lidya', 'rahel', 'ruth', 'tsion', 'fikirte', 'eden',
  'mulu', 'hiwot', 'beza', 'tsige', 'aster', 'senait', 'meseret', 'genet',
  'netsanet', 'fasika', 'worknesh', 'lemlem', 'helen', 'hawani', 'tsehay',
  'beti', 'lidu', 'tigi', 'seli'
];

export function isGirlBotUsername(username: string): boolean {
  const clean = username.toLowerCase().replace(/^@/, '').replace(/^bot_/, '');
  return GIRL_NAME_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

/**
 * Generates realistic Telegram-style usernames mixed with numbers.
 * Enforces ~75% boy names and ~25% girl names.
 */
export function generateRealisticBotUsername(index: number, seed: number): string {
  // 75% boy names, 25% girl names
  const isBoy = ((index * 37 + Math.abs(seed)) % 100) < 75;
  const nameBase = isBoy
    ? ETHIOPIAN_BOY_NAMES[(index * 13 + Math.abs(seed % 97)) % ETHIOPIAN_BOY_NAMES.length].toLowerCase()
    : ETHIOPIAN_GIRL_NAMES[(index * 17 + Math.abs(seed % 53)) % ETHIOPIAN_GIRL_NAMES.length].toLowerCase();

  const num = REALISTIC_NUMBER_SUFFIXES[(index * 7 + Math.abs(seed % 31)) % REALISTIC_NUMBER_SUFFIXES.length];
  const letter = INITIAL_LETTERS[(index * 11 + Math.abs(seed % 17)) % INITIAL_LETTERS.length];
  const style = (index + Math.abs(seed)) % 4;

  if (style === 0) {
    // e.g. abebe_21, yonas_99
    return `${nameBase}_${num}`;
  } else if (style === 1) {
    // e.g. dani77, samuel24
    return `${nameBase}${num}`;
  } else if (style === 2) {
    // e.g. dawit_g24, henok_k7
    return `${nameBase}_${letter}${num}`;
  } else {
    // e.g. robel_07, selam_23
    return `${nameBase}_${num}`;
  }
}

/**
 * Formats a player or bot user ID for public display, ensuring bot IDs
 * look like realistic 9-digit numeric Telegram user IDs (e.g. 682914023)
 * without ever exposing internal 'bot_' prefixes.
 */
export function formatDisplayPlayerId(userId?: string | null): string {
  if (!userId) return '100000000';
  const clean = String(userId).trim();
  if (clean.startsWith('bot_')) {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    return String(500000000 + (Math.abs(hash) % 499999999));
  }
  return clean;
}

/**
 * Sanitizes a winner record so it is safe to send to clients:
 * - Strips any internal `bot_` prefix from userId
 * - Ensures username never contains the raw `bot_` userId
 */
export function sanitizeWinnerForDisplay(winner: WinnerRecord): WinnerRecord {
  return {
    ...winner,
    userId: formatDisplayPlayerId(winner.userId),
  };
}

export const ETHIOPIAN_BOT_NAMES: string[] = [
  'abebe_21', 'yonas_99', 'selam_07', 'dani_77', 'dawit_24',
  'samuel_11', 'meron_23', 'henok_88', 'biruk_12', 'natnael_04',
  'tigist_19', 'eyob_7', 'fitsum_14', 'robel_27', 'sara_33',
  'ermias_55', 'kidus_01', 'solomon_44', 'lidya_80', 'binyam_25',
  'yared_95', 'ashenafi_17', 'zelalem_89', 'surafel_08', 'rahel_10',
  'tewodros_24', 'kirubel_90', 'nahom_33', 'abel_07', 'kalab_55',
  'leul_98', 'bereket_21', 'tariku_14', 'mikael_77', 'ruth_11',
  'dagim_02', 'tedros_2024', 'alemu_88', 'kebede_44', 'bethel_25',
  'muluken_99', 'fasil_17', 'abiy_01', 'amanuel_12', 'mikiyas_7',
  'tadesse_23', 'sisay_80', 'haile_95', 'anteneh_33', 'eden_22',
  'mengistu_55', 'kassahun_10', 'getachew_89', 'tadele_04', 'tsion_14',
  'yohannes_27', 'desta_77', 'girma_19', 'tamirat_90', 'hiwot_08'
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

  const seed = roundSeed ?? Date.now();

  for (let i = 0; i < count; i++) {
    // Pick realistic Telegram bot username mixed with numbers (~75% boy names, ~25% girl names)
    let botName = generateRealisticBotUsername(i, seed);
    if (usedNames.has(botName)) {
      botName = `${botName}_${(i % 89) + 10}`;
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
 * Calculate the ball on which a bot will shout Bingo.
 * User requirement:
 * - Fetan: 15–20 called balls
 * - Special: 20–25 called balls based on rule hardness (hard: 23–25, easy/normal: 20–22)
 * - Weekend: 25–35 called balls
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
    // Hyper Fetan: win ball called 15–20
    return 15 + (seed % 6); // 15..20
  }
  if (isSpecial) {
    // Hyper Special: hard rules 23–25, non-hard rules 20–22 (20–25 range)
    const hard = isSpecialRuleHard(specialRuleIndex);
    return hard ? 23 + (seed % 3) : 20 + (seed % 3);
  }
  if (isWeekend) {
    // Hyper Weekend: win ball called 25–35
    return 25 + (seed % 11); // 25..35
  }
  return 15 + (seed % 6);
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
  currentBall: number,
  forceImmediate = false
): Promise<WinnerRecord | null> {
  try {
    if (game.status !== 'RUNNING') {
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
    const isFetanGame = category === 'HYPER_FETAN' || String(game.id).includes('fetan');
    const isSpecialGame = category === 'HYPER_SPECIAL' || String(game.id).includes('special');
    const isWeekendGame = category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY';
    const targetBall = getTargetWinningBall(game.id, roundStartedAt, category, game.active_special_rule_index);

    // Minimum ball check (unless forced immediately, e.g. when human is about to say Bingo)
    const minSafeBalls = isFetanGame ? 10 : isSpecialGame ? 13 : isWeekendGame ? 18 : 10;
    if (!forceImmediate && drawnNumbers.length < minSafeBalls) {
      return null;
    }

    // If drawn balls haven't reached the target winning ball yet, check if any human
    // players exist in the game — if so, use a stricter (earlier) threshold to ensure
    // bot always wins before a human can complete a pattern.
    if (!forceImmediate && drawnNumbers.length < targetBall) {
      // Check if any human cards exist in this game
      try {
        const humanRows = await sql`
          SELECT COUNT(*)::int AS count FROM game_cards
          WHERE game_id = ${game.id} AND user_id NOT LIKE 'bot_%'
        `;
        const humanCount = humanRows[0]?.count ?? 0;
        if (humanCount > 0) {
          // Humans present — bot MUST win before human can complete a pattern!
          const safeThreshold = isFetanGame ? 11 : isSpecialGame ? 14 : isWeekendGame ? 20 : 11;
          if (drawnNumbers.length < safeThreshold) return null;
          // Fall through to trigger bot win at reduced threshold
        } else {
          // No humans — keep standard targetBall threshold
          return null;
        }
      } catch {
        return null;
      }
    }

    // Fetch bot cards for this game
    let botRows = await sql`
      SELECT card_number, user_id, username FROM game_cards
      WHERE game_id = ${game.id} AND user_id LIKE 'bot_%'
    `;
    if (!botRows || botRows.length === 0) {
      try {
        await ensureBotPlayersInDb(sql, game);
        botRows = await sql`
          SELECT card_number, user_id, username FROM game_cards
          WHERE game_id = ${game.id} AND user_id LIKE 'bot_%'
        `;
      } catch {}
    }
    if (!botRows || botRows.length === 0) {
      // Fallback bot row to ensure a bot winner is always produced
      const seed = Math.abs(hashString(String(roundStartedAt) + '_fallback'));
      const fallbackUser = generateRealisticBotUsername(seed % 300, seed);
      botRows = [{
        card_number: String(1 + (seed % 100)),
        user_id: `bot_${fallbackUser.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'player'}`,
        username: fallbackUser,
      }];
    }

    // Split available bots into boy-named bots and girl-named bots
    const boyBots: typeof botRows = [];
    const girlBots: typeof botRows = [];
    for (const b of botRows) {
      if (isGirlBotUsername(String(b.username || b.user_id || ''))) {
        girlBots.push(b);
      } else {
        boyBots.push(b);
      }
    }

    // Determine target winner gender: ~75% boys, ~25% girls (mixed, but mostly boys as requested)
    const seedNum = Math.abs(hashString(String(roundStartedAt) + '_winner'));
    const wantsBoy = (seedNum % 100) < 75;

    let pool = wantsBoy && boyBots.length > 0 ? boyBots : (girlBots.length > 0 ? girlBots : botRows);
    if (!wantsBoy && girlBots.length > 0) {
      pool = girlBots;
    }
    const winningBot = pool[seedNum % pool.length];

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
      userId: formatDisplayPlayerId(winningBot.user_id),
      username: winningBot.username,
      cardNumber: winningBot.card_number,
      winningBall: currentBall,
      pattern,
      prizeWon,
      claimedAt: new Date().toISOString(),
    };

    // Update game status to COMPLETED and append bot winner
    const winnerRows = await sql`
      UPDATE games
      SET
        status = 'COMPLETED',
        winners = ${JSON.stringify([botWinner])}::jsonb,
        updated_at = NOW()
      WHERE id = ${game.id} AND status = 'RUNNING' AND (winners = '[]'::jsonb OR winners IS NULL)
      RETURNING id
    `;

    // Only the request that successfully changed the game may announce the
    // winner. This prevents duplicate Telegram announcements from overlapping polls.
    if (winnerRows.length === 0) return null;

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
