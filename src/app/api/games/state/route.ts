import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';

/**
 * GET /api/games/state
 * Returns live game state for all games from the DB.
 * Called every 3 seconds by every connected client for real-time multiplayer sync.
 * Lightweight: only fetches fields that change during gameplay.
 */
export async function GET(_req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    const rows = await sql`
      SELECT
        id,
        status,
        drawn_numbers,
        current_ball,
        current_players,
        winners,
        blocked_cards,
        active_special_rule_index,
        next_round_starts_at,
        entry_price,
        prize_pool,
        draw_interval,
        updated_at
      FROM games
      ORDER BY created_at ASC
    `;

    const games = rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      drawnNumbers: Array.isArray(r.drawn_numbers) ? r.drawn_numbers : [],
      currentBall: r.current_ball ?? null,
      currentPlayers: parseInt(r.current_players ?? '0', 10),
      winners: Array.isArray(r.winners) ? r.winners : (typeof r.winners === 'string' ? JSON.parse(r.winners) : []),
      blockedCards: Array.isArray(r.blocked_cards) ? r.blocked_cards : [],
      activeSpecialRuleIndex: parseInt(r.active_special_rule_index ?? '0', 10),
      nextRoundStartsAt: r.next_round_starts_at ? Number(r.next_round_starts_at) : undefined,
      entryPrice: parseFloat(r.entry_price),
      prizePool: parseFloat(r.prize_pool),
      drawInterval: parseInt(r.draw_interval ?? '3', 10),
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ success: true, data: games }, {
      headers: {
        // Allow browsers/CDN to cache for 1s, revalidate immediately
        'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
