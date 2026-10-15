import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';

/**
 * POST /api/games/start
 * Starts a game round (e.g. when 5-min intermission in Hyper Special ends).
 * Sets status to 'RUNNING' and clears next_round_starts_at.
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: true, localOnly: true });
  }

  try {
    const body = await req.json();
    const { gameId } = body as { gameId: string };

    if (!gameId) {
      return NextResponse.json({ success: false, error: 'gameId required' }, { status: 400 });
    }

    // Ensure game exists
    const [existing] = await sql`SELECT id FROM games WHERE id = ${gameId}`;
    if (!existing) {
      const initial = INITIAL_GAMES.find((g) => g.id === gameId);
      if (initial) {
        await sql`
          INSERT INTO games (
            id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
            drawn_numbers, current_ball, current_players, winners, blocked_cards,
            active_special_rule_index, draw_interval, created_at, updated_at
          ) VALUES (
            ${initial.id}, ${initial.name}, ${initial.gameType}, ${initial.category},
            ${initial.winningRule}, ${initial.entryPrice}, ${initial.prizePool}, 'RUNNING',
            '{}', NULL, 0, '[]'::jsonb, '{}', ${initial.activeSpecialRuleIndex ?? 0},
            ${initial.drawInterval ?? 3}, NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    await sql`
      UPDATE games
      SET
        status = 'RUNNING',
        next_round_starts_at = NULL,
        updated_at = NOW()
      WHERE id = ${gameId}
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[start]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
