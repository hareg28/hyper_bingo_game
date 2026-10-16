import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryTelebirrOrder } from '@/lib/payments/telebirr';

export const runtime = 'nodejs';

function walletRedirect(result: 'success' | 'pending' | 'failed') {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';
  const url = new URL('/', appUrl);
  url.searchParams.set('tab', 'wallet');
  url.searchParams.set('payment', result);
  return NextResponse.redirect(url, 303);
}

export async function GET(req: NextRequest) {
  const merchantOrderId = req.nextUrl.searchParams.get('merch_order_id')
    ?? req.nextUrl.searchParams.get('merchOrderId');
  if (!merchantOrderId || !/^[A-Za-z0-9]{8,64}$/.test(merchantOrderId)) {
    return walletRedirect('failed');
  }

  try {
    const pending = await db.findDepositByReference(merchantOrderId);
    if (!pending || pending.paymentProvider !== 'Telebirr') return walletRedirect('failed');
    if (pending.status === 'COMPLETED') return walletRedirect('success');
    if (pending.status !== 'PENDING') return walletRedirect('failed');

    const verified = await queryTelebirrOrder(merchantOrderId);
    const isPaid = ['PAY_SUCCESS', 'SUCCESS', 'TRADE_SUCCESS'].includes(verified.status);
    if (
      verified.merchantOrderId !== merchantOrderId ||
      !isPaid ||
      verified.currency !== 'ETB' ||
      Math.abs(verified.amount - pending.amount) > 0.001
    ) return walletRedirect('pending');

    const completed = await db.completeTelebirrDeposit(merchantOrderId, pending.amount);
    return walletRedirect(completed?.status === 'COMPLETED' ? 'success' : 'pending');
  } catch (error) {
    console.error('[Telebirr return] Could not verify returned order:', error instanceof Error ? error.message : 'unknown error');
    return walletRedirect('pending');
  }
}
