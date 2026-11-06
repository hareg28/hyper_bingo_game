import { NextResponse } from 'next/server';
import { ensureBlockedPlayersColumn, ensureBuiltinGameRows, ensureGameCardPaidColumn, ensureGameDrawTimestampColumn, ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';
import { FETAN_BALL_INTERVAL_MS, FETAN_PICK_SECONDS, FETAN_ROUND_SECONDS, getNextWeekendDrawAt, getWeekendRoundKey, getWeekendScheduledStartAt, HYPER_SPECIAL_PRICE_CYCLE, HYPER_SPECIAL_RULES, SPECIAL_BALL_INTERVAL_MS, SPECIAL_PICK_SECONDS, SPECIAL_ROUND_SECONDS, WEEKEND_BALL_INTERVAL_MS } from '@/lib/bingoUtils';
import { ensureBotPlayersInDb, checkAndTriggerBotWin, getBotCountForGame, getInitialBotSoldCardNumbers, formatDisplayPlayerId, sanitizeWinnerForDisplay } from '@/lib/botPlayers';
import { notifyUsersTelegram } from '@/lib/adminNotifications';

let weekendScheduleMigration: Promise<void> | null = null;

async function ensureSingleDrawWeekendMigration(sql: NonNullable<ReturnType<typeof getNeonSql>>): Promise<void> {
  if (!weekendScheduleMigration) {
    weekendScheduleMigration = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS weekend_schedule_migrations (
        migration_key VARCHAR(100) PRIMARY KEY,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      const [completed] = await sql`SELECT migration_key FROM weekend_schedule_migrations WHERE migration_key = 'one_draw_per_weekend_day_v1' LIMIT 1`;
      if (completed) return;

      // Retire the three removed draws and return their paid card costs to the
      // purchasers' available balances. The migration is idempotent because
      // refunds are calculated only from cards this statement actually deletes.
      await sql`
        WITH removed_cards AS (
          DELETE FROM game_cards
          WHERE game_id IN ('gm_weekend_fri_6pm', 'gm_weekend_sat_2pm', 'gm_weekend_sun_6pm')
          RETURNING game_id, card_number, user_id, username, cost, is_paid
        ), refund_totals AS (
          SELECT user_id, MAX(username) AS username, SUM(COALESCE(cost, 0)) AS amount,
                 COUNT(*)::integer AS card_count
          FROM removed_cards
          WHERE is_paid IS DISTINCT FROM FALSE
          GROUP BY user_id
        ), wallet_refunds AS (
          UPDATE wallets AS wallet
          SET available_balance = wallet.available_balance + refunds.amount,
              updated_at = NOW()
          FROM refund_totals AS refunds
          WHERE wallet.user_id = refunds.user_id
          RETURNING wallet.user_id, wallet.available_balance
        ), recorded_refunds AS (
          INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
          SELECT 'TX_WEEKEND_SCHEDULE_' || SUBSTRING(MD5(refunds.user_id), 1, 24),
                 refunds.user_id, refunds.username, 'GAME_ENTRY_REFUND', refunds.amount,
                 wallet_refunds.available_balance, 'System', 'COMPLETED',
                 'REFUND-WEEKEND-SCHEDULE-' || SUBSTRING(MD5(refunds.user_id), 1, 24),
                 'Refund for ' || refunds.card_count || ' paid card(s) from the retired weekend draw schedule'
          FROM refund_totals AS refunds
          JOIN wallet_refunds USING (user_id)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        ), archived_games AS (
          UPDATE games
          SET status = 'CANCELLED', drawn_numbers = '{}', current_ball = NULL,
              round_started_at = NULL, last_ball_drawn_at = NULL, current_players = 0,
              winners = '[]'::jsonb, blocked_cards = '{}', blocked_players = '{}',
              weekend_round_key = NULL, updated_at = NOW()
          WHERE id IN ('gm_weekend_fri_6pm', 'gm_weekend_sat_2pm', 'gm_weekend_sun_6pm')
          RETURNING id
        )
        SELECT COUNT(*)::integer AS refunded_groups FROM recorded_refunds
      `;
      await sql`INSERT INTO weekend_schedule_migrations (migration_key) VALUES ('one_draw_per_weekend_day_v1') ON CONFLICT DO NOTHING`;
    })().catch((error) => {
      weekendScheduleMigration = null;
      throw error;
    });
  }
  await weekendScheduleMigration;
}

function parseIntegerArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== 'string') return [];
  const contents = value.trim().replace(/^\{|\}$/g, '');
  if (!contents) return [];
  return contents.split(',').map((part) => Number(part.trim())).filter(Number.isFinite);
}

/**
 * GET /api/games/state
 * Returns live game state for all games from the DB.
 * Called every 3 seconds by every connected client for real-time multiplayer sync.
 * Lightweight: only fetches fields that change during gameplay.
 */
export async function GET() {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    await ensureGameDrawTimestampColumn(sql);
    await ensureGameCardPaidColumn(sql);
    await ensureWeekendRoundKeyColumn(sql);
    await ensureBlockedPlayersColumn(sql);
    await ensureBuiltinGameRows(sql);
    await ensureSingleDrawWeekendMigration(sql);

    // First Hyper rounds get a shared, server-timed card-pick window. Fetan
    // opens for 40 seconds after a winner; Special opens for four minutes.
    await sql`
      UPDATE games
      SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + ${FETAN_PICK_SECONDS * 1000}
      WHERE (category = 'HYPER_FETAN' OR game_type = 'HYPER_FETAN')
        AND status = 'OPEN'
        AND drawn_numbers = '{}'
        AND next_round_starts_at IS NULL
    `;

    // Apply scheduled Weekend transitions before returning shared state so a
    // cron invocation at the slot boundary can start the round immediately.
    for (const weekendGame of INITIAL_GAMES.filter((game) => game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY')) {
      const weekendRoundKey = getWeekendRoundKey(weekendGame);
      const scheduledStartAt = getWeekendScheduledStartAt(weekendGame);
      if (!weekendRoundKey) {
        await sql`
          WITH old_round AS (
            SELECT id FROM games
            WHERE id = ${weekendGame.id} AND weekend_round_key IS NOT NULL
          ), expired_cards AS (
            DELETE FROM game_cards
            WHERE game_id IN (SELECT id FROM old_round)
            RETURNING id
          )
          UPDATE games
          SET status = 'OPEN', drawn_numbers = '{}', current_ball = NULL, round_started_at = NULL,
              last_ball_drawn_at = NULL, winners = '[]'::jsonb,
              blocked_cards = '{}', blocked_players = '{}',
              current_players = (SELECT COUNT(*)::integer FROM game_cards WHERE game_id = ${weekendGame.id} AND is_paid IS DISTINCT FROM FALSE),
              weekend_round_key = NULL, updated_at = NOW()
          WHERE id = ${weekendGame.id}
            AND (weekend_round_key IS NOT NULL OR status IN ('RUNNING', 'COMPLETED'))
        `;
        continue;
      }
      await sql`
        WITH expired_cards AS (
          DELETE FROM game_cards
          WHERE game_id = ${weekendGame.id}
            AND EXISTS (
              SELECT 1 FROM games
              WHERE id = ${weekendGame.id}
                AND weekend_round_key IS NOT NULL
                AND weekend_round_key IS DISTINCT FROM ${weekendRoundKey}
            )
          RETURNING id
        )
        UPDATE games
        SET status = 'RUNNING', round_started_at = TO_TIMESTAMP(${(scheduledStartAt || Date.now()) / 1000}), drawn_numbers = '{}', current_ball = NULL,
            last_ball_drawn_at = NULL, winners = '[]'::jsonb,
            blocked_cards = '{}', blocked_players = '{}',
            current_players = (SELECT COUNT(*)::integer FROM game_cards WHERE game_id = ${weekendGame.id} AND is_paid IS DISTINCT FROM FALSE),
            weekend_round_key = ${weekendRoundKey}, updated_at = NOW()
        WHERE id = ${weekendGame.id}
          AND (weekend_round_key IS DISTINCT FROM ${weekendRoundKey} OR status = 'OPEN')
      `;
    }

    // Keep scheduled rounds and shared state synchronized for every client.
    const hyperRows = await sql`
      SELECT id, category, game_type, status, drawn_numbers, current_ball, winners, round_started_at,
             next_round_starts_at, last_ball_drawn_at, draw_interval, active_special_rule_index,
             entry_price, weekend_round_key
      FROM games
      WHERE category IN ('HYPER_FETAN', 'HYPER_SPECIAL', 'HYPER_WEEKEND')
         OR game_type IN ('HYPER_FETAN', 'HYPER_SPECIAL', 'WEEKEND_LOTTERY')
      ORDER BY id
    `;
    for (const game of hyperRows) {
      const winners = Array.isArray(game.winners)
        ? game.winners
        : (typeof game.winners === 'string' ? JSON.parse(game.winners || '[]') : []);
      const drawn = parseIntegerArray(game.drawn_numbers);
      const isFetan = game.category === 'HYPER_FETAN' || game.game_type === 'HYPER_FETAN';
      const isSpecial = game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL';
      const isWeekend = game.category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY';
      const pickSeconds = isSpecial ? SPECIAL_PICK_SECONDS : FETAN_PICK_SECONDS;
      const ruleCount = HYPER_SPECIAL_RULES.length;
      const currentRuleIndex = Number(game.active_special_rule_index || 0);
      const nextRuleIndex = isSpecial ? (currentRuleIndex + 1) % ruleCount : currentRuleIndex;
      const nextPrice = isSpecial
        ? HYPER_SPECIAL_PRICE_CYCLE[nextRuleIndex % HYPER_SPECIAL_PRICE_CYCLE.length]
        : Number(game.entry_price || 10);
      const latestClaimAt = winners.reduce((latest: number, winner: any) => {
        const claimedAt = Date.parse(winner?.claimedAt || '');
        return Number.isFinite(claimedAt) ? Math.max(latest, claimedAt) : latest;
      }, 0);
      const completionAt = game.last_ball_drawn_at ? new Date(game.last_ball_drawn_at).getTime() : 0;
      const specialRoundStartedAt = game.round_started_at ? new Date(game.round_started_at).getTime() : 0;
      // Reset an expired Special round in the same state request that notices
      // the deadline. Waiting for a second poll after marking it COMPLETED can
      // leave the old board visible at 00:00 if no later poll reaches the DB.
      const specialRoundEnded = isSpecial && (game.status === 'RUNNING' || game.status === 'COMPLETED') && specialRoundStartedAt > 0 &&
        Date.now() >= specialRoundStartedAt + SPECIAL_ROUND_SECONDS * 1000;
      const fullRoundEnded = specialRoundEnded || (game.status === 'COMPLETED' && drawn.length >= 75 && completionAt > 0 && Date.now() >= completionAt + 10_000);
      const claimedRoundEnded = winners.length > 0 && latestClaimAt > 0 && Date.now() >= latestClaimAt + 10_000;
      const scheduledGame = isWeekend ? INITIAL_GAMES.find((candidate) => candidate.id === game.id) : null;
      const activeWeekendKey = scheduledGame ? getWeekendRoundKey(scheduledGame) : null;
      const weekendRoundIsLive = isWeekend && Boolean(activeWeekendKey && game.weekend_round_key === activeWeekendKey);
      const fetanRoundEnded = isFetan && game.status === 'RUNNING' && specialRoundStartedAt > 0 &&
        Date.now() >= specialRoundStartedAt + FETAN_ROUND_SECONDS * 1000;

      if ((fullRoundEnded || fetanRoundEnded || claimedRoundEnded) && !isWeekend) {
        const resetRows = await sql`
          WITH reset_game AS (
            UPDATE games
            SET status = 'OPEN', drawn_numbers = '{}', current_ball = NULL, round_started_at = NULL,
                last_ball_drawn_at = NULL, current_players = 0, winners = '[]'::jsonb,
                blocked_cards = '{}', blocked_players = '{}',
                active_special_rule_index = ${nextRuleIndex}, entry_price = ${nextPrice},
                next_round_starts_at = ${isWeekend ? null : Date.now() + pickSeconds * 1000},
                updated_at = NOW()
            WHERE id = ${game.id} AND status = ${game.status}
              AND drawn_numbers = ${`{${drawn.join(',')}}`}::int4[]
              AND winners = ${JSON.stringify(winners)}::jsonb
              AND (${!isWeekend} OR weekend_round_key = ${game.weekend_round_key})
            RETURNING id
          ), deleted_cards AS (
            DELETE FROM game_cards WHERE game_id IN (SELECT id FROM reset_game) RETURNING id
          )
          SELECT id FROM reset_game
        `;
        if (resetRows.length > 0) {
          await ensureBotPlayersInDb(sql, { ...game, status: 'OPEN', entry_price: nextPrice, round_started_at: null });
          continue;
        }
      }

      // Ensure active bot players are present in all rooms (including Weekend OPEN games before game starts)
      if (game.status === 'OPEN' || game.status === 'RUNNING') {
        await ensureBotPlayersInDb(sql, game);
      }

      if (isWeekend && !weekendRoundIsLive) continue;

      // Start the shared round as soon as its pick deadline expires.
      if (!isWeekend && game.status === 'OPEN' && drawn.length === 0 && game.next_round_starts_at &&
          Date.now() >= Number(game.next_round_starts_at)) {
        await sql`
          UPDATE games SET status = 'RUNNING', round_started_at = COALESCE(round_started_at, NOW()), next_round_starts_at = NULL, updated_at = NOW()
          WHERE id = ${game.id} AND status = 'OPEN' AND drawn_numbers = '{}'
            AND next_round_starts_at = ${game.next_round_starts_at}
            AND next_round_starts_at <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
        `;
      }

      if (isSpecial && game.status === 'RUNNING' && specialRoundStartedAt > 0 &&
          Date.now() >= specialRoundStartedAt + SPECIAL_ROUND_SECONDS * 1000) {
        await sql`
          UPDATE games SET status = 'COMPLETED', updated_at = NOW()
          WHERE id = ${game.id} AND status = 'RUNNING' AND round_started_at = ${game.round_started_at}
        `;
        continue;
      }

      // Fetan, Special, and live Weekend rounds draw automatically once running.
      // Compare the old draw array and due time in SQL so overlapping polls
      // can commit at most one ball per interval.
      if ((isFetan || isSpecial || (isWeekend && weekendRoundIsLive)) &&
          game.status === 'RUNNING' && drawn.length < 75 && winners.length === 0) {
        const drawIntervalMs = isSpecial
          ? SPECIAL_BALL_INTERVAL_MS
          : isFetan
            ? FETAN_BALL_INTERVAL_MS
            : isWeekend
              ? WEEKEND_BALL_INTERVAL_MS
              : Math.max(1, Number.parseInt(game.draw_interval || '3', 10)) * 1000;
        const lastDrawAt = game.last_ball_drawn_at ? new Date(game.last_ball_drawn_at).getTime() : 0;
        const roundStartedAt = game.round_started_at ? new Date(game.round_started_at).getTime() : 0;
        const nextSpecialDrawAt = roundStartedAt + drawn.length * SPECIAL_BALL_INTERVAL_MS;
        const drawIsDue = isSpecial
          ? roundStartedAt > 0 && Date.now() >= nextSpecialDrawAt
          : isFetan
            ? roundStartedAt > 0 && Date.now() >= roundStartedAt + drawn.length * FETAN_BALL_INTERVAL_MS
          : isWeekend
            ? !lastDrawAt || Date.now() >= lastDrawAt + drawIntervalMs
            : !lastDrawAt || Date.now() >= lastDrawAt + drawIntervalMs;
        if (drawIsDue) {
          const drawnSet = new Set(drawn);
          const remaining: number[] = [];
          for (let ball = 1; ball <= 75; ball++) if (!drawnSet.has(ball)) remaining.push(ball);
          const dueDrawCount = isSpecial
            ? Math.max(1, Math.floor((Date.now() - roundStartedAt) / SPECIAL_BALL_INTERVAL_MS) + 1 - drawn.length)
            : isFetan
              ? Math.max(1, Math.floor((Date.now() - roundStartedAt) / FETAN_BALL_INTERVAL_MS) + 1 - drawn.length)
              : 1;
          const ballsToDraw = Math.min(remaining.length, dueDrawCount);
          for (let i = 0; i < ballsToDraw; i++) {
            const swapIndex = i + Math.floor(Math.random() * (remaining.length - i));
            [remaining[i], remaining[swapIndex]] = [remaining[swapIndex], remaining[i]];
          }
          const newlyDrawn = remaining.slice(0, ballsToDraw);
          if (newlyDrawn.length > 0) {
            const nextBall = newlyDrawn[newlyDrawn.length - 1];
            const nextDrawn = [...drawn, ...newlyDrawn];
            await sql`
              UPDATE games
              SET drawn_numbers = ${`{${nextDrawn.join(',')}}`}::int4[],
                  current_ball = ${nextBall}, last_ball_drawn_at = NOW(),
                  round_started_at = COALESCE(round_started_at, NOW()),
                  status = ${nextDrawn.length >= 75 && !isFetan && !isWeekend ? 'COMPLETED' : 'RUNNING'}, updated_at = NOW()
              WHERE id = ${game.id} AND status = 'RUNNING'
                AND drawn_numbers = ${`{${drawn.join(',')}}`}::int4[]
                AND (${isSpecial || isFetan} OR last_ball_drawn_at IS NULL OR last_ball_drawn_at <= NOW() - (${drawIntervalMs} * INTERVAL '1 millisecond'))
            `;

            // Most of the time, bot player wins the game if no human has won yet.
            // When human players are in the room use forceImmediate so a bot wins
            // before the human could potentially complete a bingo pattern.
            let humanPresentInGame = false;
            try {
              const hRows = await sql`SELECT COUNT(*)::int AS count FROM game_cards WHERE game_id = ${game.id} AND user_id NOT LIKE 'bot_%'`;
              humanPresentInGame = (hRows[0]?.count ?? 0) > 0;
            } catch {}
            const shouldForce = humanPresentInGame && nextDrawn.length >= (isFetan ? 12 : isSpecial ? 16 : 22);
            const botWinner = await checkAndTriggerBotWin(sql, game, nextDrawn, nextBall, shouldForce);
            if (botWinner && isWeekend) {
              await notifyUsersTelegram(
                `🏆 WEEKEND BINGO WINNER! ${botWinner.username || 'A player'} won Card #${botWinner.cardNumber} and ${botWinner.prizeWon} ETB. Open the Weekend game page to view the full result.`,
              );
            }
          }
        }
      }

      // Check bot win on ongoing running round (also force when humans are present at safe threshold)
      if (game.status === 'RUNNING' && drawn.length >= 12 && winners.length === 0 && game.current_ball) {
        let humanInOngoing = false;
        try {
          const hRows2 = await sql`SELECT COUNT(*)::int AS count FROM game_cards WHERE game_id = ${game.id} AND user_id NOT LIKE 'bot_%'`;
          humanInOngoing = (hRows2[0]?.count ?? 0) > 0;
        } catch {}
        const forceOngoing = humanInOngoing && drawn.length >= (isFetan ? 12 : isSpecial ? 16 : 22);
        const botWinner = await checkAndTriggerBotWin(sql, game, drawn, Number(game.current_ball), forceOngoing);
        if (botWinner && isWeekend) {
          await notifyUsersTelegram(
            `🏆 WEEKEND BINGO WINNER! ${botWinner.username || 'A player'} won Card #${botWinner.cardNumber} and ${botWinner.prizeWon} ETB. Open the Weekend game page to view the full result.`,
          );
        }
      }
    }
    await sql`
      UPDATE games
      SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + ${SPECIAL_PICK_SECONDS * 1000}
      WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
        AND status = 'OPEN'
        AND drawn_numbers = '{}'
        AND next_round_starts_at IS NULL
    `;
    // Keep the Special entry price tied to the active rule, including rows
    // that existed before the 10 / 20 ETB rotation was introduced.
    await sql`
      UPDATE games
      SET entry_price = CASE MOD(MOD(active_special_rule_index, 2) + 2, 2)
        WHEN 0 THEN 10
        ELSE 20
      END
      WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
        AND entry_price <> CASE MOD(MOD(active_special_rule_index, 2) + 2, 2)
          WHEN 0 THEN 10
          ELSE 20
        END
    `;

    let rows = await sql`
      SELECT
        id,
        category,
        game_type,
        status,
        drawn_numbers,
        current_ball,
        round_started_at,
        current_players,
        winners,
        blocked_cards,
        blocked_players,
        active_special_rule_index,
        next_round_starts_at,
        weekend_round_key,
        entry_price,
        prize_pool,
        draw_interval,
        updated_at
      FROM games
      ORDER BY created_at ASC
    `;
    const activeWeekendIds = new Set(INITIAL_GAMES
      .filter((candidate) => candidate.category === 'HYPER_WEEKEND' || candidate.gameType === 'WEEKEND_LOTTERY')
      .map((candidate) => candidate.id));
    rows = rows.filter((row: any) =>
      (row.category !== 'HYPER_WEEKEND' && row.game_type !== 'WEEKEND_LOTTERY') || activeWeekendIds.has(row.id)
    );

    if (!rows || rows.length === 0) {
      // Auto-seed INITIAL_GAMES so DB is populated
      for (const g of INITIAL_GAMES) {
        await sql`
          INSERT INTO games (
            id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
            drawn_numbers, current_ball, current_players, winners, blocked_cards,
            active_special_rule_index, draw_interval, created_at, updated_at
          ) VALUES (
            ${g.id}, ${g.name}, ${g.gameType}, ${g.category}, ${g.winningRule}, ${g.entryPrice},
            ${g.prizePool}, 'OPEN', '{}', NULL, 0, '[]'::jsonb, '{}',
            ${g.activeSpecialRuleIndex ?? 0}, ${g.drawInterval ?? 3}, NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
      rows = await sql`
        SELECT
          id,
          category,
          game_type,
          status,
          drawn_numbers,
          current_ball,
          round_started_at,
          current_players,
          winners,
          blocked_cards,
          blocked_players,
          active_special_rule_index,
          next_round_starts_at,
          weekend_round_key,
          entry_price,
          prize_pool,
          draw_interval,
          updated_at
        FROM games
        ORDER BY created_at ASC
      `;

      // The rows above are inserted after the first deadline-initialization
      // pass. Initialize Special's first shared pick window before returning
      // this first snapshot as well.
      await sql`
        UPDATE games
        SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + ${SPECIAL_PICK_SECONDS * 1000}
        WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
          AND status = 'OPEN'
          AND drawn_numbers = '{}'
          AND next_round_starts_at IS NULL
      `;
      rows = await sql`
        SELECT
          id,
          category,
          game_type,
          status,
          drawn_numbers,
          current_ball,
          round_started_at,
          current_players,
          winners,
          blocked_cards,
          blocked_players,
          active_special_rule_index,
          next_round_starts_at,
          weekend_round_key,
          entry_price,
          prize_pool,
          draw_interval,
          updated_at
        FROM games
        ORDER BY created_at ASC
      `;
    }

    // Reapply after the seed path too, so retired database draws never show in the mini app.
    rows = rows.filter((row: any) =>
      (row.category !== 'HYPER_WEEKEND' && row.game_type !== 'WEEKEND_LOTTERY') || activeWeekendIds.has(row.id)
    );

    // Fetch human sold cards by game so clients can show live sold cards & left cards on the board
    const humanSoldCardsByGame: Record<string, number[]> = {};
    const humanPaidCardCountsByGame: Record<string, number> = {};
    try {
      const soldRows = await sql`
        SELECT game_id, card_number, user_id, is_paid FROM game_cards
      `;
      for (const row of soldRows) {
        const isBot = String(row.user_id || '').startsWith('bot_');
        if (!isBot) {
          if (!humanSoldCardsByGame[row.game_id]) {
            humanSoldCardsByGame[row.game_id] = [];
          }
          const num = parseInt(row.card_number, 10);
          if (!Number.isNaN(num)) {
            humanSoldCardsByGame[row.game_id].push(num);
          }
          if (row.is_paid !== false) {
            humanPaidCardCountsByGame[row.game_id] = (humanPaidCardCountsByGame[row.game_id] || 0) + 1;
          }
        }
      }
    } catch {
      // Gracefully ignore if table empty or not yet migrated
    }

    const games = rows.map((r: any) => {
      const id = String(r.id);
      const isFetan = id.includes('fetan');
      const isSpecial = id.includes('special');
      const isWeekend = id.includes('weekend');
      const targetBotCount = getBotCountForGame(
        r.id,
        r.category || r.game_type,
        r.round_started_at ? new Date(r.round_started_at).getTime() : undefined
      );
      const allBotCards = getInitialBotSoldCardNumbers(r.id, r.category || r.game_type);

      // Realistic progressive bot participation during the card-picking / selling window
      let visibleBotCount = targetBotCount;
      if (r.status === 'OPEN') {
        if (isFetan) {
          const pickDeadline = r.next_round_starts_at ? Number(r.next_round_starts_at) : 0;
          if (pickDeadline > Date.now()) {
            const timeLeftMs = Math.max(0, pickDeadline - Date.now());
            const progress = Math.min(1, Math.max(0, (FETAN_PICK_SECONDS * 1000 - timeLeftMs) / (FETAN_PICK_SECONDS * 1000)));
            visibleBotCount = Math.floor(targetBotCount * (0.08 + 0.92 * progress));
          }
        } else if (isSpecial) {
          const pickDeadline = r.next_round_starts_at ? Number(r.next_round_starts_at) : 0;
          if (pickDeadline > Date.now()) {
            const timeLeftMs = Math.max(0, pickDeadline - Date.now());
            const progress = Math.min(1, Math.max(0, (SPECIAL_PICK_SECONDS * 1000 - timeLeftMs) / (SPECIAL_PICK_SECONDS * 1000)));
            visibleBotCount = Math.floor(targetBotCount * (0.08 + 0.92 * progress));
          }
        } else if (isWeekend) {
          const initGame = INITIAL_GAMES.find((g) => g.id === r.id);
          const drawAt = initGame ? getNextWeekendDrawAt(initGame) : 0;
          if (drawAt > 0) {
            const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
            const progress = Math.min(1, Math.max(0, (Date.now() - (drawAt - WEEK_MS)) / WEEK_MS));
            visibleBotCount = Math.floor(targetBotCount * progress);
          }
        }
      }

      const visibleBotCards = allBotCards.slice(0, Math.min(visibleBotCount, allBotCards.length));
      const humanCount = humanPaidCardCountsByGame[r.id] || 0;
      const currentPlayers = humanCount + visibleBotCount;

      return {
        id: r.id,
        status: r.status,
        drawnNumbers: parseIntegerArray(r.drawn_numbers),
        currentBall: r.current_ball == null ? null : Number(r.current_ball),
        roundStartedAt: r.round_started_at ? new Date(r.round_started_at).getTime() : undefined,
        currentPlayers,
        winners: (Array.isArray(r.winners) ? r.winners : (typeof r.winners === 'string' ? JSON.parse(r.winners) : [])).map((w: any) => sanitizeWinnerForDisplay({
          ...w,
          userId: formatDisplayPlayerId(w.userId),
        })),
        blockedCards: Array.isArray(r.blocked_cards) ? r.blocked_cards : [],
        blockedPlayers: Array.isArray(r.blocked_players) ? r.blocked_players : [],
        activeSpecialRuleIndex: parseInt(r.active_special_rule_index ?? '0', 10),
        nextRoundStartsAt: r.next_round_starts_at ? Number(r.next_round_starts_at) : undefined,
        weekendRoundKey: r.weekend_round_key || undefined,
        entryPrice: parseFloat(r.entry_price),
        prizePool: parseFloat(r.prize_pool),
        drawInterval: parseInt(r.draw_interval ?? '3', 10),
        soldCards: Array.from(new Set([
          ...(humanSoldCardsByGame[r.id] || []),
          ...visibleBotCards,
        ])),
        updatedAt: r.updated_at,
      };
    });

    return NextResponse.json({ success: true, data: games }, {
      headers: {
        // This endpoint also advances scheduled games and returns the called ball.
        // CDN caching could delay the exact start or leave players on an old ball.
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
