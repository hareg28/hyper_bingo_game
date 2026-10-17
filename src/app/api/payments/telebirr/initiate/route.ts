import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTelebirrCheckout } from '@/lib/payments/telebirr';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, error: 'Deposits are temporarily unavailable.' }, { status: 503 });
    }

    const { userId, amount } = await req.json() as { userId?: string; amount?: number };
    const parsedAmount = Number(amount);
    if (!userId || !Number.isFinite(parsedAmount) || parsedAmount < 10 || parsedAmount > 100_000) {
      return NextResponse.json({ success: false, error: 'Enter a deposit amount between 10 and 100,000 ETB.' }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    if (user.status === 'suspended') {
      return NextResponse.json({ success: false, error: 'Your account is suspended. Please contact support.' }, { status: 403 });
    }

    const merchantOrderId = `HB${Date.now()}${randomBytes(5).toString('hex').toUpperCase()}`;
    const checkoutUrl = await createTelebirrCheckout({ merchantOrderId, amount: parsedAmount });

    const pending = await db.createTelebirrPendingDeposit({
      userId,
      amount: parsedAmount,
      reference: merchantOrderId,
    });
    if (!pending || pending.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Could not save the pending payment. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: { checkoutUrl, merchantOrderId, amount: parsedAmount },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Could not start Telebirr checkout. Check the Telebirr credentials and try again.';
    console.error('[Telebirr initiate] Checkout setup failed:', msg);
    return NextResponse.json({
      success: false,
      error: msg,
    }, { status: 503 });
  }
}
