import { NextRequest, NextResponse } from 'next/server';
import { ensureBlockedPlayersColumn, getNeonSql } from '@/lib/neon';

/** Persist a false-Bingo penalty against its player for the current round. */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    await ensureBlockedPlayersColumn(sql);
    const { gameId, userId, cardNumber } = await req.json() as {
      gameId?: string;
      userId?: string;
      cardNumber?: string;
    };
    if (!gameId || !userId || !cardNumber) {
      return NextResponse.json({ success: false, error: 'gameId, userId and cardNumber are required' }, { status: 400 });
    }

    const [ownedCard] = await sql`
      SELECT id FROM game_cards
      WHERE game_id = ${gameId} AND user_id = ${userId} AND card_number = ${cardNumber}
      LIMIT 1
    `;
    if (!ownedCard) {
      return NextResponse.json({ success: false, error: 'Card is not owned by this player.' }, { status: 403 });
    }

    const [game] = await sql`
      UPDATE games
      SET blocked_cards = CASE
            WHEN ${cardNumber} = ANY(COALESCE(blocked_cards, '{}')) THEN COALESCE(blocked_cards, '{}')
            ELSE array_append(COALESCE(blocked_cards, '{}'), ${cardNumber})
          END,
          blocked_players = CASE
            WHEN ${userId} = ANY(COALESCE(blocked_players, '{}')) THEN COALESCE(blocked_players, '{}')
            ELSE array_append(COALESCE(blocked_players, '{}'), ${userId})
          END,
          updated_at = NOW()
      WHERE id = ${gameId} AND status = 'RUNNING'
      RETURNING blocked_cards, blocked_players
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'This game round is no longer active.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: {
        blockedCards: Array.isArray(game.blocked_cards) ? game.blocked_cards : [],
        blockedPlayers: Array.isArray(game.blocked_players) ? game.blocked_players : [],
      },
    });
  } catch (error: unknown) {
    console.error('[games/block]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Could not block player.' }, { status: 500 });
  }
}
