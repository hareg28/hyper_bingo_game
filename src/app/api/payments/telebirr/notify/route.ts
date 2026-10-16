import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryTelebirrOrder } from '@/lib/payments/telebirr';

export const runtime = 'nodejs';

function readMerchantOrderId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : record;
  const content = data.biz_content && typeof data.biz_content === 'object'
    ? data.biz_content as Record<string, unknown>
    : data;
  const value = content.merch_order_id ?? content.merchOrderId;
  return typeof value === 'string' && /^[A-Za-z0-9]{8,64}$/.test(value) ? value : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const merchantOrderId = readMerchantOrderId(body);
    if (!merchantOrderId) {
      return NextResponse.json({ success: false, error: 'Invalid Telebirr notification.' }, { status: 400 });
    }

    const pending = await db.findDepositByReference(merchantOrderId);
    if (!pending || pending.paymentProvider !== 'Telebirr') {
      return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 });
    }
    if (pending.status === 'COMPLETED') {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }
    if (pending.status !== 'PENDING') {
      return NextResponse.json({ success: true, ignored: true });
    }

    // The callback is only a signal. Confirm the order with Telebirr's API before crediting.
    const verified = await queryTelebirrOrder(merchantOrderId);
    const isPaid = ['PAY_SUCCESS', 'SUCCESS', 'TRADE_SUCCESS'].includes(verified.status);
    if (
      verified.merchantOrderId !== merchantOrderId ||
      !isPaid ||
      verified.currency !== 'ETB' ||
      !Number.isFinite(verified.amount) ||
      Math.abs(verified.amount - pending.amount) > 0.001
    ) {
      return NextResponse.json({ success: true, pending: true });
    }

    const completed = await db.completeTelebirrDeposit(merchantOrderId, pending.amount);
    if (!completed || completed.status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Payment could not be recorded. Retry the notification.' }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Telebirr notify] Could not verify notification:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Could not verify payment yet. Retry the notification.' }, { status: 503 });
  }
}
