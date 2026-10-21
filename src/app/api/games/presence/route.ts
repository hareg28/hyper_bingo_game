import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';

/** Records that a player is currently viewing a game room. */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });

  try {
    const { gameId, userId } = await req.json() as { gameId?: string; userId?: string };
    if (!gameId || !userId || userId === 'usr_guest') {
      return NextResponse.json({ success: false, error: 'gameId and registered userId are required' }, { status: 400 });
    }
    const [registeredUser] = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (!registeredUser) return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    const [ownedCard] = await sql`SELECT id FROM game_cards WHERE game_id = ${gameId} AND user_id = ${userId} LIMIT 1`;
    if (!ownedCard) return NextResponse.json({ success: true, active: false });

    await sql`
      CREATE TABLE IF NOT EXISTS game_presence (
        game_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (game_id, user_id)
      )
    `;
    await sql`
      INSERT INTO game_presence (game_id, user_id, last_seen_at)
      VALUES (${gameId}, ${userId}, NOW())
      ON CONFLICT (game_id, user_id) DO UPDATE SET last_seen_at = NOW()
    `;
    await sql`DELETE FROM game_presence WHERE last_seen_at < NOW() - INTERVAL '2 minutes'`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[game presence]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
