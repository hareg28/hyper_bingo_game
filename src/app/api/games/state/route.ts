import { NextRequest, NextResponse } from 'next/server';
import { ensureBlockedPlayersColumn, ensureBuiltinGameRows, ensureGameDrawTimestampColumn, ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';
import { getWeekendRoundKey } from '@/lib/bingoUtils';

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
export async function GET(_req: NextRequest) {
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

    // Start each scheduled Weekend slot once. Cards stay reserved across
    // weekly runs; only the draw state is reset for the new occurrence.
    for (const weekendGame of INITIAL_GAMES.filter((game) => game.category === 'HYPER_WEEKEND' || game.gameType === 'WEEKEND_LOTTERY')) {
      const weekendRoundKey = getWeekendRoundKey(weekendGame);
      if (!weekendRoundKey) continue;
      await sql`
        UPDATE games
        SET status = 'RUNNING',
            drawn_numbers = '{}',
            current_ball = NULL,
            last_ball_drawn_at = NULL,
            winners = '[]'::jsonb,
            blocked_cards = '{}',
            blocked_players = '{}',
            current_players = (SELECT COUNT(DISTINCT user_id)::integer FROM game_cards WHERE game_id = ${weekendGame.id}),
            weekend_round_key = ${weekendRoundKey},
            updated_at = NOW()
        WHERE id = ${weekendGame.id}
          AND weekend_round_key IS DISTINCT FROM ${weekendRoundKey}
      `;
    }

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
    const playerIdsByGame: Record<string, Set<string>> = {};
    try {
      const soldRows = await sql`
        SELECT game_id, card_number, user_id FROM game_cards
      `;
      for (const row of soldRows) {
        if (!soldCardsByGame[row.game_id]) {
          soldCardsByGame[row.game_id] = [];
        }
        if (!playerIdsByGame[row.game_id]) playerIdsByGame[row.game_id] = new Set<string>();
        playerIdsByGame[row.game_id].add(String(row.user_id));
        const num = parseInt(row.card_number, 10);
        if (!Number.isNaN(num)) {
          soldCardsByGame[row.game_id].push(num);
        }
      }
    } catch {
      // Gracefully ignore if table empty or not yet migrated
    }

    const games = rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      drawnNumbers: parseIntegerArray(r.drawn_numbers),
      currentBall: r.current_ball == null ? null : Number(r.current_ball),
      currentPlayers: playerIdsByGame[r.id]?.size ?? 0,
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

    return NextResponse.json({ success: true, data: games }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=2',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
