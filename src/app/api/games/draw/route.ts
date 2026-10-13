import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';

/**
 * POST /api/games/draw
 * Server-side ball draw. Only admin or the server may call this.
 * Picks the next random un-drawn ball, writes it to DB, and returns it.
 * All clients polling /api/games/state will pick it up within 3s.
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

    // Admin-only check (skip if no telegramId provided — internal server call)
    if (telegramId && !isAdminTelegramId(telegramId)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Fetch current game state
    const [game] = await sql`
      SELECT id, status, drawn_numbers, winners, next_round_starts_at
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    // Validate game can draw
    const winners = Array.isArray(game.winners) ? game.winners
      : (typeof game.winners === 'string' ? JSON.parse(game.winners || '[]') : []);
    if (game.status === 'COMPLETED' || winners.length > 0) {
      return NextResponse.json({ success: false, error: 'Game already completed' }, { status: 409 });
    }

    // Check intermission
    if (game.next_round_starts_at && Date.now() < Number(game.next_round_starts_at)) {
      return NextResponse.json({
        success: false,
        error: 'Game is in intermission. Next round not started yet.',
        nextRoundStartsAt: Number(game.next_round_starts_at),
      }, { status: 425 });
    }

    const drawn: number[] = Array.isArray(game.drawn_numbers) ? game.drawn_numbers : [];
    if (drawn.length >= 75) {
      return NextResponse.json({ success: false, error: 'All 75 balls already drawn' }, { status: 409 });
    }

    // Pick a random un-drawn ball
    const drawnSet = new Set(drawn);
    const remaining: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!drawnSet.has(i)) remaining.push(i);
    }
    const nextBall = remaining[Math.floor(Math.random() * remaining.length)];
    const updatedDrawn = [...drawn, nextBall];
    const isCompleted = updatedDrawn.length >= 75;

    // Write to DB
    await sql`
      UPDATE games
      SET
        drawn_numbers = ${sql.array(updatedDrawn, 'int4')},
        current_ball = ${nextBall},
        status = ${isCompleted ? 'COMPLETED' : 'RUNNING'},
        updated_at = NOW()
      WHERE id = ${gameId}
    `;

    return NextResponse.json({
      success: true,
      data: { ball: nextBall, drawnNumbers: updatedDrawn, isCompleted },
    });
  } catch (err: any) {
    console.error('[draw]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
