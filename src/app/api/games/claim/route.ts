import { NextRequest, NextResponse } from 'next/server';
import { ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';
import { getWeekendRoundKey } from '@/lib/bingoUtils';

/**
 * POST /api/games/claim
 * Records a verified bingo win to the DB and credits the winner's wallet.
 * The client has already validated the win pattern locally before calling this.
 * 
 * Body: { gameId, userId, cardNumber, pattern, prizeWon, winningBall }
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    await ensureWeekendRoundKeyColumn(sql);
    const body = await req.json();
    const { gameId, userId, username, cardNumber, pattern, prizeWon, winningBall } = body as {
      gameId: string;
      userId: string;
      username: string;
      cardNumber: string;
      pattern: string;
      prizeWon: number;
      winningBall: number;
    };

    if (!gameId || !userId || !cardNumber || !pattern) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch current game state
    const [game] = await sql`
      SELECT id, category, game_type, weekend_round_key, status, winners, current_players, entry_price, prize_pool, blocked_cards
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }
    if (game.category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY') {
      const scheduledGame = INITIAL_GAMES.find((candidate) => candidate.id === gameId);
      const activeScheduleKey = scheduledGame ? getWeekendRoundKey(scheduledGame) : null;
      if (!activeScheduleKey || game.weekend_round_key !== activeScheduleKey || game.status !== 'RUNNING') {
        return NextResponse.json({ success: false, error: 'Weekend winner claims are accepted only during the scheduled live draw.' }, { status: 409 });
      }
    }

    // 2. Check if card is blocked
    const blocked: string[] = Array.isArray(game.blocked_cards) ? game.blocked_cards : [];
    if (blocked.includes(cardNumber)) {
      return NextResponse.json({ success: false, error: `Card #${cardNumber} is blocked` }, { status: 409 });
    }

    // 3. Check if already completed
    const currentWinners = Array.isArray(game.winners) ? game.winners
      : (typeof game.winners === 'string' ? JSON.parse(game.winners || '[]') : []);
    if (game.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Game already completed' }, { status: 409 });
    }

    // 4. Check this card isn't already a winner
    if (currentWinners.some((w: any) => w.cardNumber === cardNumber)) {
      return NextResponse.json({ success: false, error: 'Card already won' }, { status: 409 });
    }

    // 5. Build winner record
    const winRecord = {
      userId,
      username,
      cardNumber,
      winningBall,
      pattern,
      prizeWon,
      claimedAt: new Date().toISOString(),
    };
    const updatedWinners = [...currentWinners, winRecord];

    // 6. Update game status → COMPLETED and append winner
    await sql`
      UPDATE games
      SET
        status = 'COMPLETED',
        winners = ${JSON.stringify(updatedWinners)}::jsonb,
        updated_at = NOW()
      WHERE id = ${gameId}
    `;

    // 7. Credit winner's wallet (winning balance + available)
    await sql`
      UPDATE wallets
      SET
        winning_balance = winning_balance + ${prizeWon},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // 8. Record win transaction
    const [walletRow] = await sql`SELECT available_balance FROM wallets WHERE user_id = ${userId}`;
    const txId = `TX_WIN_${Date.now().toString(36).slice(-6)}`;
    await sql`
      INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
      VALUES (
        ${txId}, ${userId}, ${username}, 'GAME_WIN', ${prizeWon},
        ${parseFloat(walletRow?.available_balance ?? '0')},
        'System', 'COMPLETED',
        ${'WIN-' + gameId},
        ${'BINGO! ' + pattern + ' with Card #' + cardNumber}
      )
    `;

    return NextResponse.json({ success: true, data: { winRecord, prizeWon } });
  } catch (err: any) {
    console.error('[claim]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
