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
    const [existing] = await sql`
      SELECT id, category, game_type, status, drawn_numbers, next_round_starts_at
      FROM games WHERE id = ${gameId}
    `;
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

    const [game] = await sql`
      SELECT id, category, game_type, status, drawn_numbers, next_round_starts_at
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL';
    const drawnNumbers = Array.isArray(game.drawn_numbers)
      ? game.drawn_numbers
      : typeof game.drawn_numbers === 'string'
        ? game.drawn_numbers.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
        : [];
    if (isSpecial && game.status !== 'RUNNING' && drawnNumbers.length === 0) {
      const deadline = Number(game.next_round_starts_at || 0);
      if (!deadline) {
        return NextResponse.json({ success: false, error: 'Special pick-window deadline is not initialized.' }, { status: 425 });
      }
      if (Date.now() < deadline) {
        return NextResponse.json({
          success: false,
          error: 'Special card-pick window is still open.',
          nextRoundStartsAt: deadline,
        }, { status: 425 });
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
