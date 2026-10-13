import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';
import { HYPER_SPECIAL_RULES } from '@/lib/bingoUtils';

const SPECIAL_PRICE_CYCLE = [10, 20, 25];

/**
 * POST /api/games/reset
 * Admin-only: resets a game round (clears drawn_numbers, winners, blocked_cards).
 * For Hyper Special: rotates the winning rule and sets a 5-minute intermission.
 * Deletes all game_cards for the game (1-round card rule).
 * 
 * Body: { gameId, telegramId? }
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { gameId, telegramId } = body as { gameId: string; telegramId?: string };

    if (!gameId) {
      return NextResponse.json({ success: false, error: 'gameId required' }, { status: 400 });
    }

    // Admin check
    if (telegramId && !isAdminTelegramId(telegramId)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Fetch current game info
    const [game] = await sql`
      SELECT id, game_type, category, active_special_rule_index, entry_price
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL';
    const currentRuleIndex = parseInt(game.active_special_rule_index ?? '0', 10);
    const nextSpecialIndex = isSpecial
      ? (currentRuleIndex + 1) % HYPER_SPECIAL_RULES.length
      : currentRuleIndex;
    const nextPrice = isSpecial
      ? SPECIAL_PRICE_CYCLE[nextSpecialIndex % SPECIAL_PRICE_CYCLE.length]
      : parseFloat(game.entry_price);
    const nextRoundStartsAt = isSpecial ? Date.now() + 5 * 60 * 1000 : null;

    // Reset the game row
    await sql`
      UPDATE games
      SET
        drawn_numbers = '{}',
        current_ball = NULL,
        current_players = 0,
        winners = '[]'::jsonb,
        blocked_cards = '{}',
        status = 'OPEN',
        active_special_rule_index = ${nextSpecialIndex},
        entry_price = ${nextPrice},
        next_round_starts_at = ${nextRoundStartsAt},
        updated_at = NOW()
      WHERE id = ${gameId}
    `;

    // Delete all game_cards for this game (1-round card rule)
    await sql`DELETE FROM game_cards WHERE game_id = ${gameId}`;

    return NextResponse.json({
      success: true,
      data: {
        nextSpecialIndex,
        nextPrice,
        nextRoundStartsAt,
        isSpecial,
      },
    });
  } catch (err: any) {
    console.error('[reset]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
