import { NextRequest, NextResponse } from 'next/server';
import { ensureBlockedPlayersColumn, ensureGameDrawTimestampColumn, getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';
import { HYPER_SPECIAL_PRICE_CYCLE, HYPER_SPECIAL_RULES } from '@/lib/bingoUtils';
import { INITIAL_GAMES } from '@/lib/store';

/**
 * POST /api/games/reset
 * Resets a game round (clears drawn_numbers, winners, blocked_cards).
 * For Hyper Special: rotates the winning rule and sets a 5-minute intermission.
 * Deletes one-round game cards, including Weekend reservations when that
 * scheduled game ends, so the master board is available for its next sale.
 * 
 * Body: { gameId, telegramId?, nextSpecialIndex?, nextPrice? }
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    await ensureGameDrawTimestampColumn(sql);
    await ensureBlockedPlayersColumn(sql);
    const body = await req.json();
    const { gameId, telegramId } = body as {
      gameId: string;
      telegramId?: string;
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
      SELECT id, game_type, category, active_special_rule_index, entry_price, status, drawn_numbers
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
          SELECT id, game_type, category, active_special_rule_index, entry_price, status, drawn_numbers
          FROM games WHERE id = ${gameId}
        `;
      }
    }

    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const isSpecial = game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL' || gameId === 'gm_special';
    const isFetan = game.category === 'HYPER_FETAN' || game.game_type === 'HYPER_FETAN' || gameId.includes('fetan');
    const isWeekend = game.category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY' || gameId.includes('weekend');
    const currentRuleIndex = parseInt(game.active_special_rule_index ?? '0', 10);
    // Advance rule and price together from the authoritative DB value. Ignore
    // client-supplied rotation values so stale clients cannot pick the wrong
    // rule or price for the next shared round.
    const nextSpecialIndex = isSpecial
      ? (currentRuleIndex + 1) % HYPER_SPECIAL_RULES.length
      : currentRuleIndex;
    const nextPrice = isSpecial
      ? HYPER_SPECIAL_PRICE_CYCLE[nextSpecialIndex % HYPER_SPECIAL_PRICE_CYCLE.length]
      : parseFloat(game.entry_price || '10');
    const nextRoundStartsAt = isSpecial
      ? Date.now() + 5 * 60 * 1000
      : isFetan
        ? Date.now() + 30 * 1000
        : null;

    // Reset the game and clear its one-round cards atomically. This prevents
    // clients from seeing stale sold numbers between the round reset and delete.
    const resetRows = await sql`
      WITH reset_game AS (
        UPDATE games
        SET
          drawn_numbers = '{}',
          current_ball = NULL,
          last_ball_drawn_at = NULL,
          current_players = 0,
          winners = '[]'::jsonb,
          blocked_cards = '{}',
          blocked_players = '{}',
          status = 'OPEN',
          active_special_rule_index = ${nextSpecialIndex},
          entry_price = ${nextPrice},
          next_round_starts_at = ${nextRoundStartsAt},
          updated_at = NOW()
        WHERE id = ${gameId}
          AND (status = 'COMPLETED' OR drawn_numbers <> '{}')
        RETURNING id
      ), deleted_cards AS (
        DELETE FROM game_cards
        WHERE game_id IN (SELECT id FROM reset_game)
        RETURNING id
      )
      SELECT id FROM reset_game
    `;

    // Multiple players can reach the end of a round together. Only the first
    // reset clears that round; later requests must not rotate rules or prices.
    if (resetRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Round has already been reset.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: {
        nextSpecialIndex,
        nextPrice,
        nextRoundStartsAt,
        isSpecial,
        isFetan,
        isWeekend,
      },
    });
  } catch (err: any) {
    console.error('[reset]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
