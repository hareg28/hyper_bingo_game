import { NextRequest, NextResponse } from 'next/server';
import { ensureGameDrawTimestampColumn, ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';
import { INITIAL_GAMES } from '@/lib/store';
import { getWeekendRoundKey } from '@/lib/bingoUtils';
import { SPECIAL_ROUND_SECONDS } from '@/lib/bingoUtils';

function parseIntegerArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== 'string') return [];
  const contents = value.trim().replace(/^\{|\}$/g, '');
  if (!contents) return [];
  return contents.split(',').map((part) => Number(part.trim())).filter(Number.isFinite);
}

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
    await ensureGameDrawTimestampColumn(sql);
    await ensureWeekendRoundKeyColumn(sql);
    const body = await req.json();
    const { gameId, telegramId, expectedDrawnCount } = body as {
      gameId: string;
      telegramId?: string;
      expectedDrawnCount?: number;
    };

    if (!gameId) {
      return NextResponse.json({ success: false, error: 'gameId required' }, { status: 400 });
    }

    // Admin-only check (skip if no telegramId provided — internal server call)
    if (telegramId && !isAdminTelegramId(telegramId)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Fetch current game state
    const [game] = await sql`
      SELECT id, category, game_type, status, drawn_numbers, winners, round_started_at, next_round_starts_at, weekend_round_key, draw_interval, last_ball_drawn_at
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const isFetan = game.category === 'HYPER_FETAN' || game.game_type === 'HYPER_FETAN' || gameId.includes('fetan');
    const isWeekend = game.category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY' || gameId.includes('weekend');
    if (isWeekend) {
      const scheduledGame = INITIAL_GAMES.find((candidate) => candidate.id === gameId);
      const activeScheduleKey = scheduledGame ? getWeekendRoundKey(scheduledGame) : null;
      if (!activeScheduleKey || game.weekend_round_key !== activeScheduleKey || game.status !== 'RUNNING') {
        return NextResponse.json({ success: false, error: 'This Weekend draw is outside its scheduled live time.' }, { status: 425 });
      }
    }

    // Validate game can draw
    const winners = Array.isArray(game.winners) ? game.winners
      : (typeof game.winners === 'string' ? JSON.parse(game.winners || '[]') : []);
    if (game.status === 'COMPLETED' || winners.length > 0) {
      return NextResponse.json({ success: false, error: 'Game already completed' }, { status: 409 });
    }
    if ((game.category === 'HYPER_SPECIAL' || game.game_type === 'HYPER_SPECIAL') && game.round_started_at &&
        Date.now() >= new Date(game.round_started_at).getTime() + SPECIAL_ROUND_SECONDS * 1000) {
      return NextResponse.json({ success: false, error: 'The 12-minute Special round has ended.' }, { status: 409 });
    }

    // Fetan draws only after the shared server-side pick deadline has elapsed
    // and the round has been transitioned to RUNNING by /start.
    if (isFetan && game.status !== 'RUNNING') {
      const deadline = Number(game.next_round_starts_at || 0);
      if (deadline && Date.now() < deadline) {
        return NextResponse.json({ success: false, error: 'Fetan card-pick window is still open.', nextRoundStartsAt: deadline }, { status: 425 });
      }
      return NextResponse.json({ success: false, error: 'Fetan round has not started yet.' }, { status: 425 });
    }

    // Check intermission
    if (game.next_round_starts_at && Date.now() < Number(game.next_round_starts_at)) {
      return NextResponse.json({
        success: false,
        error: 'Game is in intermission. Next round not started yet.',
        nextRoundStartsAt: Number(game.next_round_starts_at),
      }, { status: 425 });
    }

    const drawn = parseIntegerArray(game.drawn_numbers);
    const drawIntervalMs = Math.max(1, parseInt(game.draw_interval ?? '3', 10)) * 1000;
    if (game.last_ball_drawn_at) {
      const nextAllowedAt = new Date(game.last_ball_drawn_at).getTime() + drawIntervalMs;
      if (Date.now() < nextAllowedAt) {
        return NextResponse.json({ success: false, error: 'The next ball is not due yet.', nextAllowedAt }, { status: 425 });
      }
    }
    if (typeof expectedDrawnCount === 'number' && drawn.length !== expectedDrawnCount) {
      return NextResponse.json({
        success: false,
        error: 'Game state changed; sync before drawing again.',
        data: { drawnNumbers: drawn, currentBall: game.current_ball ?? null },
      }, { status: 409 });
    }
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
    const updatedRows = await sql`
      UPDATE games
      SET
        drawn_numbers = ${`{${updatedDrawn.join(',')}}`}::int4[],
        current_ball = ${nextBall},
        round_started_at = COALESCE(round_started_at, NOW()),
        last_ball_drawn_at = NOW(),
        status = ${isCompleted ? 'COMPLETED' : 'RUNNING'},
        updated_at = NOW()
      WHERE id = ${gameId}
        AND drawn_numbers = ${`{${drawn.join(',')}}`}::int4[]
      RETURNING id
    `;

    // The row may have advanced after our initial read. Never return an
    // uncommitted draw in that case; let polling deliver the winning update.
    if (updatedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Game state changed; sync before drawing again.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: { ball: nextBall, drawnNumbers: updatedDrawn, isCompleted },
    });
  } catch (err: any) {
    console.error('[draw]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
