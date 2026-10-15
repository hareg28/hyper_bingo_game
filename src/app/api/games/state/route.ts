import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';

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
    // Fetan uses a shared 90-second server cycle (60s live, 30s pick).
    // Clear the previous round once when the pick window opens so all clients
    // see the same fresh board, while purchases made during this window remain
    // reserved for the next live round. next_round_starts_at is otherwise only
    // used by Hyper Special and serves as the idempotent Fetan cycle marker.
    await sql`
      WITH clock AS (
        SELECT
          FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 90)::bigint AS cycle_id,
          MOD(FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint, 90) AS cycle_second
      ), reset_fetan AS (
        UPDATE games AS g
        SET
          drawn_numbers = '{}',
          current_ball = NULL,
          last_ball_drawn_at = NULL,
          current_players = 0,
          winners = '[]'::jsonb,
          blocked_cards = '{}',
          status = 'OPEN',
          next_round_starts_at = clock.cycle_id,
          updated_at = NOW()
        FROM clock
        WHERE (g.category = 'HYPER_FETAN' OR g.game_type = 'HYPER_FETAN')
          AND clock.cycle_second >= 60
          AND g.next_round_starts_at IS DISTINCT FROM clock.cycle_id
        RETURNING g.id
      ), deleted_cards AS (
        DELETE FROM game_cards
        WHERE game_id IN (SELECT id FROM reset_fetan)
        RETURNING id
      )
      SELECT id FROM reset_fetan
    `;

    // Ensure Special exists even in databases that already contain some, but
    // not all, of the built-in games.
    const initialSpecial = INITIAL_GAMES.find((game) => game.category === 'HYPER_SPECIAL' || game.gameType === 'HYPER_SPECIAL');
    if (initialSpecial) {
      await sql`
        INSERT INTO games (
          id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
          drawn_numbers, current_ball, current_players, winners, blocked_cards,
          active_special_rule_index, draw_interval, created_at, updated_at
        ) VALUES (
          ${initialSpecial.id}, ${initialSpecial.name}, ${initialSpecial.gameType}, ${initialSpecial.category},
          ${initialSpecial.winningRule}, ${initialSpecial.entryPrice}, ${initialSpecial.prizePool}, 'OPEN',
          '{}', NULL, 0, '[]'::jsonb, '{}', ${initialSpecial.activeSpecialRuleIndex ?? 0},
          ${initialSpecial.drawInterval ?? 3}, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // A brand-new Hyper Special round always has the same shared five-minute
    // registration window. The NULL guard makes initialization safe under load.
    await sql`
      UPDATE games
      SET next_round_starts_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint + 300000
      WHERE (category = 'HYPER_SPECIAL' OR game_type = 'HYPER_SPECIAL')
        AND status = 'OPEN'
        AND drawn_numbers = '{}'
        AND next_round_starts_at IS NULL
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
        active_special_rule_index,
        next_round_starts_at,
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
          active_special_rule_index,
          next_round_starts_at,
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
          active_special_rule_index,
          next_round_starts_at,
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
        SELECT game_id, card_number FROM game_cards
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

    const games = rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      drawnNumbers: parseIntegerArray(r.drawn_numbers),
      currentBall: r.current_ball == null ? null : Number(r.current_ball),
      currentPlayers: parseInt(r.current_players ?? '0', 10),
      winners: Array.isArray(r.winners) ? r.winners : (typeof r.winners === 'string' ? JSON.parse(r.winners) : []),
      blockedCards: Array.isArray(r.blocked_cards) ? r.blocked_cards : [],
      activeSpecialRuleIndex: parseInt(r.active_special_rule_index ?? '0', 10),
      nextRoundStartsAt: r.next_round_starts_at ? Number(r.next_round_starts_at) : undefined,
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
