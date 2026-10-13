import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';

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
