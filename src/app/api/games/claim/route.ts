import { NextRequest, NextResponse } from 'next/server';
import { ensureWeekendRoundKeyColumn, getNeonSql } from '@/lib/neon';
import { INITIAL_GAMES } from '@/lib/store';
import { computeWeekendPrizePool, getWeekendRoundKey } from '@/lib/bingoUtils';
import { notifyUsersTelegram } from '@/lib/adminNotifications';

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
      SELECT id, name, category, game_type, weekend_round_key, status, winners, current_players, entry_price, prize_pool, blocked_cards
      FROM games WHERE id = ${gameId}
    `;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }
    const isWeekend = game.category === 'HYPER_WEEKEND' || game.game_type === 'WEEKEND_LOTTERY';
    let awardedPrize = Math.max(0, Number(prizeWon) || 0);
    if (isWeekend) {
      const scheduledGame = INITIAL_GAMES.find((candidate) => candidate.id === gameId);
      const activeScheduleKey = scheduledGame ? getWeekendRoundKey(scheduledGame) : null;
      if (!activeScheduleKey || game.weekend_round_key !== activeScheduleKey || game.status !== 'RUNNING') {
        return NextResponse.json({ success: false, error: 'Weekend winner claims are accepted only during the scheduled live draw.' }, { status: 409 });
      }
      const [playerCountRow] = await sql`
        SELECT COUNT(*)::integer AS player_count
        FROM game_cards
        WHERE game_id = ${gameId} AND is_paid IS DISTINCT FROM FALSE
      `;
      awardedPrize = computeWeekendPrizePool(
        Number(game.entry_price || 0),
        Number(playerCountRow?.player_count || 0)
      );
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
      prizeWon: awardedPrize,
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

    // 7. Credit winner's wallet, creating it if this account has no row yet.
    const [walletRow] = await sql`
      INSERT INTO wallets (user_id, available_balance, bonus_balance, winning_balance, total_deposited, total_withdrawn)
      VALUES (${userId}, 0, 0, ${awardedPrize}, 0, 0)
      ON CONFLICT (user_id) DO UPDATE SET
        winning_balance = wallets.winning_balance + EXCLUDED.winning_balance,
        updated_at = NOW()
      RETURNING available_balance, winning_balance
    `;

    // 8. Record win transaction
    const txId = `TX_WIN_${Date.now().toString(36).slice(-6)}`;
    await sql`
      INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
      VALUES (
        ${txId}, ${userId}, ${username}, 'GAME_WIN', ${awardedPrize},
        ${parseFloat(walletRow?.winning_balance ?? '0')},
        'System', 'COMPLETED',
        ${'WIN-' + gameId},
        ${`${game.name}: Bingo prize for ${pattern} with Card #${cardNumber}`}
      )
    `;

    if (isWeekend) {
      await notifyUsersTelegram(
        `🏆 WEEKEND BINGO WINNER! ${username || 'A player'} won Card #${cardNumber} and ${awardedPrize} ETB. Open the Weekend game page to view the full result.`,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        winRecord,
        prizeWon: awardedPrize,
        wallet: {
          availableBalance: parseFloat(walletRow?.available_balance ?? '0'),
          winningBalance: parseFloat(walletRow?.winning_balance ?? '0'),
        },
      },
    });
  } catch (err: any) {
    console.error('[claim]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
