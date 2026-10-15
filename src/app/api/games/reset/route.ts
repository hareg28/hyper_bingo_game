import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';
import { HYPER_SPECIAL_RULES } from '@/lib/bingoUtils';
import { INITIAL_GAMES } from '@/lib/store';

const SPECIAL_PRICE_CYCLE = [10, 20, 25];

/**
 * POST /api/games/reset
 * Resets a game round (clears drawn_numbers, winners, blocked_cards).
 * For Hyper Special: rotates the winning rule and sets a 5-minute intermission.
 * Deletes all game_cards for the game (1-round card rule).
 * 
 * Body: { gameId, telegramId?, nextSpecialIndex?, nextPrice? }
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { gameId, telegramId, nextSpecialIndex: reqNextIndex, nextPrice: reqNextPrice } = body as {
      gameId: string;
      telegramId?: string;
      nextSpecialIndex?: number;
      nextPrice?: number;
    };

    if (!gameId) {
      return NextResponse.json({ success: false, error: 'gameId required' }, { status: 400 });
    }

    // Admin check (only if telegramId is explicitly provided)
    if (telegramId && !isAdminTelegramId(telegramId)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Fetch current game info
    let [game] = await sql`
      SELECT id, game_type, category, active_special_rule_index, entry_price
      FROM games WHERE id = ${gameId}
    `;

    if (!game) {
      const initial = INITIAL_GAMES.find((g) => g.id === gameId);
      if (initial) {
        await sql`
          INSERT INTO games (
            id, name, game_type, category, winning_rule, entry_price, prize_pool, status,
            drawn_numbers, current_ball, current_players, winners, blocked_cards,
            active_special_rule_index, draw_interval, created_at, updated_at
          ) VALUES (
            ${initial.id}, ${initial.name}, ${initial.gameType}, ${initial.category},
            ${initial.winningRule}, ${initial.entryPrice}, ${initial.prizePool}, 'OPEN',
            '{}', NULL, 0, '[]'::jsonb, '{}', ${initial.activeSpecialRuleIndex ?? 0},
            ${initial.drawInterval ?? 3}, NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
        [game] = await sql`
          SELECT id, game_type, category, active_special_rule_index, entry_price
          FROM games WHERE id = ${gameId}
        `;
      }
    }

    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL' || gameId === 'gm_special';
    const currentRuleIndex = parseInt(game.active_special_rule_index ?? '0', 10);
    const nextSpecialIndex = typeof reqNextIndex === 'number'
      ? reqNextIndex
      : (isSpecial ? (currentRuleIndex + 1) % HYPER_SPECIAL_RULES.length : currentRuleIndex);
    const nextPrice = typeof reqNextPrice === 'number'
      ? reqNextPrice
      : (isSpecial ? SPECIAL_PRICE_CYCLE[nextSpecialIndex % SPECIAL_PRICE_CYCLE.length] : parseFloat(game.entry_price || '10'));
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
