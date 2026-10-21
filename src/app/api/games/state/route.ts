import { NextRequest, NextResponse } from 'next/server';
import { ensureBlockedPlayersColumn, ensureBuiltinGameRows, ensureGameDrawTimestampColumn, ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';
import { FETAN_PICK_SECONDS, getExpiredWeekendRoundKey, getWeekendRoundKey, HYPER_SPECIAL_PRICE_CYCLE, HYPER_SPECIAL_RULES, SPECIAL_PICK_SECONDS } from '@/lib/bingoUtils';

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
export async function GET(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    await ensureGameDrawTimestampColumn(sql);
    await ensureWeekendRoundKeyColumn(sql);
    await ensureBlockedPlayersColumn(sql);
    await ensureBuiltinGameRows(sql);

    // First Hyper rounds get a shared, server-timed card-pick window. Fetan
    // opens for 30 seconds after a winner; Special opens for five minutes.
    await sql`
      UPDATE games
      SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + 30000
      WHERE (category = 'HYPER_FETAN' OR game_type = 'HYPER_FETAN')
        AND status = 'OPEN'
        AND drawn_numbers = '{}'
        AND next_round_starts_at IS NULL
    `;

    // Apply scheduled Weekend transitions before the server draw pass so a
    // cron invocation at the slot boundary can start the round immediately.
    for (const weekendGame of INITIAL_GAMES.filter((game) => game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY')) {
      const expiredRoundKey = getExpiredWeekendRoundKey(weekendGame);
      if (expiredRoundKey) {
        await sql`
          WITH expired_cards AS (
            DELETE FROM game_cards
            WHERE game_id = ${weekendGame.id}
              AND EXISTS (
                SELECT 1 FROM games
                WHERE id = ${weekendGame.id} AND weekend_round_key = ${expiredRoundKey}
              )
            RETURNING id
          )
          UPDATE games
          SET status = 'OPEN', drawn_numbers = '{}', current_ball = NULL,
              last_ball_drawn_at = NULL, winners = '[]'::jsonb,
              blocked_cards = '{}', blocked_players = '{}', current_players = 0,
              weekend_round_key = NULL, updated_at = NOW()
          WHERE id = ${weekendGame.id} AND weekend_round_key = ${expiredRoundKey}
        `;
      }
      const weekendRoundKey = getWeekendRoundKey(weekendGame);
      if (!weekendRoundKey) continue;
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
        SET status = 'RUNNING', drawn_numbers = '{}', current_ball = NULL,
            last_ball_drawn_at = NULL, winners = '[]'::jsonb,
            blocked_cards = '{}', blocked_players = '{}',
            current_players = (SELECT COUNT(DISTINCT user_id)::integer FROM game_cards WHERE game_id = ${weekendGame.id}),
            weekend_round_key = ${weekendRoundKey}, updated_at = NOW()
        WHERE id = ${weekendGame.id} AND weekend_round_key IS DISTINCT FROM ${weekendRoundKey}
      `;
    }

    // Keep Hyper and scheduled Weekend rounds moving on the server. The app polls this shared state
    // endpoint from the lobby as well as the game room, so a player leaving the
    // room does not pause the draw or strand the next pick window.
    const hyperRows = await sql`
      SELECT id, category, game_type, status, drawn_numbers, current_ball, winners,
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
      const fullRoundEnded = game.status === 'COMPLETED' && drawn.length >= 75 && completionAt > 0 && Date.now() >= completionAt + 10_000;
      const claimedRoundEnded = winners.length > 0 && latestClaimAt > 0 && Date.now() >= latestClaimAt + 10_000;
      const scheduledGame = isWeekend ? INITIAL_GAMES.find((candidate) => candidate.id === game.id) : null;
      const activeWeekendKey = scheduledGame ? getWeekendRoundKey(scheduledGame) : null;
      const weekendRoundIsLive = isWeekend && Boolean(activeWeekendKey && game.weekend_round_key === activeWeekendKey);

      if ((fullRoundEnded || claimedRoundEnded) && (!isWeekend || weekendRoundIsLive)) {
        const resetRows = await sql`
          WITH reset_game AS (
            UPDATE games
            SET status = 'OPEN', drawn_numbers = '{}', current_ball = NULL,
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
        if (resetRows.length > 0) continue;
      }

      if (isWeekend && !weekendRoundIsLive) continue;

      // Start the shared round as soon as its pick deadline expires.
      if (!isWeekend && game.status === 'OPEN' && drawn.length === 0 && game.next_round_starts_at &&
          Date.now() >= Number(game.next_round_starts_at)) {
        await sql`
          UPDATE games SET status = 'RUNNING', next_round_starts_at = NULL, updated_at = NOW()
          WHERE id = ${game.id} AND status = 'OPEN' AND drawn_numbers = '{}'
            AND next_round_starts_at = ${game.next_round_starts_at}
            AND next_round_starts_at <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
        `;
      }

      if (game.status !== 'RUNNING' || winners.length > 0 || drawn.length >= 75) continue;
      const intervalMs = Math.max(1, Number(game.draw_interval || 3)) * 1000;
      const lastDrawAt = game.last_ball_drawn_at ? new Date(game.last_ball_drawn_at).getTime() : 0;
      if (lastDrawAt && Date.now() < lastDrawAt + intervalMs) continue;
      const drawnSet = new Set(drawn);
      const remaining = Array.from({ length: 75 }, (_, index) => index + 1).filter((ball) => !drawnSet.has(ball));
      if (remaining.length === 0) continue;
      const nextBall = remaining[Math.floor(Math.random() * remaining.length)];
      const updatedDrawn = [...drawn, nextBall];
      await sql`
        UPDATE games
        SET drawn_numbers = ${`{${updatedDrawn.join(',')}}`}::int4[], current_ball = ${nextBall},
            last_ball_drawn_at = NOW(), status = ${updatedDrawn.length >= 75 ? 'COMPLETED' : 'RUNNING'}, updated_at = NOW()
        WHERE id = ${game.id} AND status = 'RUNNING'
          AND drawn_numbers = ${`{${drawn.join(',')}}`}::int4[]
          AND winners = '[]'::jsonb
          AND (last_ball_drawn_at IS NULL OR last_ball_drawn_at <= NOW() - (${intervalMs} * INTERVAL '1 millisecond'))
      `;
    }
    await sql`
      UPDATE games
      SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + 300000
      WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
        AND status = 'OPEN'
        AND drawn_numbers = '{}'
        AND next_round_starts_at IS NULL
    `;
    // Keep the Special entry price tied to the active rule, including rows
    // that existed before the 10 / 20 / 25 ETB rotation was introduced.
    await sql`
      UPDATE games
      SET entry_price = CASE MOD(MOD(active_special_rule_index, 3) + 3, 3)
        WHEN 0 THEN 10
        WHEN 1 THEN 20
        ELSE 25
      END
      WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
        AND entry_price <> CASE MOD(MOD(active_special_rule_index, 3) + 3, 3)
          WHEN 0 THEN 10
          WHEN 1 THEN 20
          ELSE 25
        END
    `;

    let rows = await sql`
      SELECT
        id,
        status,
        drawn_numbers,
        current_ball,
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
          status,
          drawn_numbers,
          current_ball,
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
        SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + 300000
        WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
          AND status = 'OPEN'
          AND drawn_numbers = '{}'
          AND next_round_starts_at IS NULL
      `;
      rows = await sql`
        SELECT
          id,
          status,
          drawn_numbers,
          current_ball,
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

    // Fetch sold cards by game so clients can show live sold cards & left cards on the board
    const soldCardsByGame: Record<string, number[]> = {};
    try {
      const soldRows = await sql`
        SELECT game_id, card_number, user_id FROM game_cards
      `;
      for (const row of soldRows) {
        if (!soldCardsByGame[row.game_id]) {
          soldCardsByGame[row.game_id] = [];
        }
        const num = parseInt(row.card_number, 10);
        if (!Number.isNaN(num)) {
          soldCardsByGame[row.game_id].push(num);
        }
      }
    } catch {
      // Gracefully ignore if table empty or not yet migrated
    }

    const activePlayerIdsByGame: Record<string, Set<string>> = {};
    try {
      const activeRows = await sql`
        SELECT game_id, user_id FROM game_presence
        WHERE last_seen_at > NOW() - INTERVAL '45 seconds'
      `;
      for (const row of activeRows) {
        if (!activePlayerIdsByGame[row.game_id]) activePlayerIdsByGame[row.game_id] = new Set<string>();
        activePlayerIdsByGame[row.game_id].add(String(row.user_id));
      }
    } catch {
      // Presence tracking is initialized when the first game room is opened.
    }

    const games = rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      drawnNumbers: parseIntegerArray(r.drawn_numbers),
      currentBall: r.current_ball == null ? null : Number(r.current_ball),
      currentPlayers: activePlayerIdsByGame[r.id]?.size ?? 0,
      winners: Array.isArray(r.winners) ? r.winners : (typeof r.winners === 'string' ? JSON.parse(r.winners) : []),
      blockedCards: Array.isArray(r.blocked_cards) ? r.blocked_cards : [],
      blockedPlayers: Array.isArray(r.blocked_players) ? r.blocked_players : [],
      activeSpecialRuleIndex: parseInt(r.active_special_rule_index ?? '0', 10),
      nextRoundStartsAt: r.next_round_starts_at ? Number(r.next_round_starts_at) : undefined,
      weekendRoundKey: r.weekend_round_key || undefined,
      entryPrice: parseFloat(r.entry_price),
      prizePool: parseFloat(r.prize_pool),
      drawInterval: parseInt(r.draw_interval ?? '3', 10),
      soldCards: soldCardsByGame[r.id] || [],
      updatedAt: r.updated_at,
    }));

    const isScheduledCron = req.headers.get('user-agent')?.includes('vercel-cron/1.0') ?? false;
    return NextResponse.json({ success: true, data: games }, {
      headers: {
        'Cache-Control': isScheduledCron ? 'no-store, max-age=0' : 'public, s-maxage=1, stale-while-revalidate=2',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
