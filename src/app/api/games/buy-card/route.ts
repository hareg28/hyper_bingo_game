import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';

/**
 * POST /api/games/buy-card
 * Server-side card purchase. Guarantees uniqueness via DB UNIQUE(game_id, card_number).
 * Deducts wallet balance on the server and records the transaction.
 * 
 * Body: { gameId, cardNumbers: string[], userId, cost: number }
 */
export async function POST(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { gameId, cardNumbers, userId, cost } = body as {
      gameId: string;
      cardNumbers: string[];
      userId: string;
      cost: number; // total cost for all cards
    };

    if (!gameId || !cardNumbers?.length || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch game to validate it's still OPEN
    const [game] = await sql`SELECT id, status, entry_price FROM games WHERE id = ${gameId}`;
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }
    if (game.status === 'COMPLETED' || game.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Game is no longer open for card purchases' }, { status: 409 });
    }

    // 2. Fetch user wallet — check balance
    const [wallet] = await sql`SELECT available_balance, bonus_balance FROM wallets WHERE user_id = ${userId}`;
    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 });
    }
    const available = parseFloat(wallet.available_balance);
    const bonus = parseFloat(wallet.bonus_balance);
    const playable = available + bonus;

    if (playable < cost) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Need ${cost} ETB, have ${playable.toFixed(2)} ETB.`,
      }, { status: 402 });
    }

    // 3. Fetch user info for logging
    const [userRow] = await sql`SELECT username FROM users WHERE id = ${userId}`;
    const username = userRow?.username || userId;
    const [existingPlayer] = await sql`
      SELECT COUNT(*) AS cnt FROM game_cards WHERE game_id = ${gameId} AND user_id = ${userId}
    `;
    const isNewPlayer = parseInt(existingPlayer?.cnt ?? '0', 10) === 0;

    // 4. Try inserting each card — ON CONFLICT DO NOTHING means already-sold cards are skipped
    const purchased: string[] = [];
    const alreadySold: string[] = [];
    const pricePerCard = parseFloat(game.entry_price);

    for (const cardNumber of cardNumbers) {
      const cardId = `gc_${gameId}_${cardNumber}`;
      const rows = await sql`
        INSERT INTO game_cards (id, game_id, card_number, user_id, username, cost)
        VALUES (${cardId}, ${gameId}, ${cardNumber}, ${userId}, ${username}, ${pricePerCard})
        ON CONFLICT (game_id, card_number) DO NOTHING
        RETURNING card_number
      `;
      if (rows.length > 0) {
        purchased.push(cardNumber);
      } else {
        alreadySold.push(cardNumber);
      }
    }

    if (purchased.length === 0) {
      return NextResponse.json({
        success: false,
        error: `All selected cards are already sold: ${alreadySold.join(', ')}`,
        alreadySold,
      }, { status: 409 });
    }

    // 5. Deduct wallet — bonus first, then available
    const actualCost = pricePerCard * purchased.length;
    let remCost = actualCost;
    let newBonus = bonus;
    let newAvailable = available;
    if (newBonus >= remCost) {
      newBonus -= remCost;
    } else {
      remCost -= newBonus;
      newBonus = 0;
      newAvailable = Math.max(0, newAvailable - remCost);
    }

    await sql`
      UPDATE wallets
      SET available_balance = ${newAvailable}, bonus_balance = ${newBonus}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // 6. Increment player count only if this is a new player.
    if (isNewPlayer) {
      await sql`
        UPDATE games
        SET current_players = current_players + 1, updated_at = NOW()
        WHERE id = ${gameId}
      `;
    } else {
      await sql`UPDATE games SET updated_at = NOW() WHERE id = ${gameId}`;
    }

    // 7. Record transaction
    const txId = `TX_ENTRY_${Date.now().toString(36).slice(-6)}`;
    const balanceAfter = newAvailable;
    await sql`
      INSERT INTO transactions (id, user_id, username, type, amount, balance_after, provider, status, reference, description)
      VALUES (
        ${txId}, ${userId}, ${username}, 'GAME_ENTRY', ${-actualCost}, ${balanceAfter},
        'System', 'COMPLETED', ${'GM-' + gameId},
        ${'Entry: ' + purchased.length + ' card(s) in game ' + gameId}
      )
    `;

    return NextResponse.json({
      success: true,
      data: {
        purchased,
        alreadySold,
        walletAfter: { availableBalance: newAvailable, bonusBalance: newBonus },
        cost: actualCost,
      },
    });
  } catch (err: any) {
    console.error('[buy-card]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/games/buy-card?gameId=...&userId=...
 * Returns all card numbers sold for a game (for the sold-map display).
 */
export async function GET(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  const userId = searchParams.get('userId');

  if (!gameId) return NextResponse.json({ success: false, error: 'gameId required' }, { status: 400 });

  try {
    const rows = await sql`
      SELECT card_number, user_id, is_registered FROM game_cards WHERE game_id = ${gameId}
    `;
    const allSold = rows.map((r: any) => parseInt(r.card_number, 10)).filter((n: number) => !isNaN(n));
    const myCards = userId
      ? rows.filter((r: any) => r.user_id === userId).map((r: any) => ({
          cardNumber: r.card_number,
          isRegistered: r.is_registered,
        }))
      : [];

    return NextResponse.json({ success: true, data: { allSold, myCards } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** DELETE /api/games/buy-card — release a card that its owner unselected. */
export async function DELETE(req: NextRequest) {
  const sql = getNeonSql();
  if (!sql) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 503 });

  try {
    const { gameId, userId, cardNumber } = await req.json() as {
      gameId: string;
      userId: string;
      cardNumber: string;
    };
    if (!gameId || !userId || !cardNumber) {
      return NextResponse.json({ success: false, error: 'gameId, userId and cardNumber required' }, { status: 400 });
    }

    const [ownedCard] = await sql`
      SELECT gc.cost, g.category, g.game_type
      FROM game_cards gc
      JOIN games g ON g.id = gc.game_id
      WHERE gc.game_id = ${gameId} AND gc.card_number = ${cardNumber} AND gc.user_id = ${userId}
    `;
    if (!ownedCard) return NextResponse.json({ success: false, error: 'Owned card not found' }, { status: 404 });

    await sql`DELETE FROM game_cards WHERE game_id = ${gameId} AND card_number = ${cardNumber} AND user_id = ${userId}`;

    const isSpecial = ownedCard.category === 'HYPER_SPECIAL' || ownedCard.game_type === 'HYPER_SPECIAL';
    let walletAfter;
    if (!isSpecial) {
      const refund = parseFloat(ownedCard.cost ?? '0');
      const [wallet] = await sql`SELECT available_balance, bonus_balance FROM wallets WHERE user_id = ${userId}`;
      if (wallet) {
        const availableBalance = parseFloat(wallet.available_balance) + refund;
        await sql`
          UPDATE wallets SET available_balance = ${availableBalance}, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        walletAfter = { availableBalance, bonusBalance: parseFloat(wallet.bonus_balance) };
      }
    }

    return NextResponse.json({ success: true, data: { walletAfter } });
  } catch (err: any) {
    console.error('[buy-card DELETE]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
