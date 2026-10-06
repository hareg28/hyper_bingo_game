/**
 * POST /api/payments/webhook/addispay
 *
 * AddisPay sends a callback POST after payment state changes.
 * This handler:
 *   1. Verifies the HMAC-SHA256 signature (x-addispay-signature header)
 *   2. Double-verifies the payment status directly with AddisPay API
 *   3. Credits the player wallet ONLY on confirmed SUCCESS
 *   4. Is idempotent — duplicate callbacks for the same orderId are ignored
 *
 * GET is handled for the AddisPay endpoint health-check ping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAddisPayWebhook, addisPayCheckStatus } from '@/lib/payments/addispay';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const signature = req.headers.get('x-addispay-signature') ?? '';

  // ── 1. Verify webhook signature ─────────────────────────────────────────
  if (!verifyAddisPayWebhook(rawBody, signature)) {
    console.warn('[Webhook/AddisPay] Invalid signature — request rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { status?: string; orderId?: string; amount?: number; currency?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── 2. Only process success events ──────────────────────────────────────
  const rawStatus = (payload.status ?? '').toUpperCase();
  const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' || rawStatus === 'PAID';

  if (!isSuccess) {
    console.log('[Webhook/AddisPay] Non-success event ignored:', payload.status);
    return NextResponse.json({ received: true });
  }

  // ── 3. Double-verify with AddisPay API ───────────────────────────────────
  const orderId = payload.orderId;
  if (!orderId) {
    console.error('[Webhook/AddisPay] Missing orderId in payload');
    return NextResponse.json({ received: true });
  }

  const verify = await addisPayCheckStatus(orderId);
  if (verify.status !== 'COMPLETED') {
    console.warn('[Webhook/AddisPay] Verification mismatch — status:', verify.status);
    return NextResponse.json({ received: true });
  }

  // ── 4. Extract userId from orderId (format: HBINGO_{userId}_{timestamp}) ─
  const parts  = orderId.split('_');
  const userId = parts.length >= 3 ? parts.slice(1, -1).join('_') : parts[1];
  if (!userId) {
    console.error('[Webhook/AddisPay] Cannot parse userId from orderId:', orderId);
    return NextResponse.json({ received: true });
  }

  const amount = verify.amount ?? payload.amount;
  if (!amount || amount <= 0) {
    console.error('[Webhook/AddisPay] Invalid amount in verification response:', amount);
    return NextResponse.json({ received: true });
  }

  // ── 5. Credit wallet (idempotent — duplicate orderId is rejected by DB) ──
  try {
    await db.creditDeposit(userId, amount, orderId, 'AddisPay');
    console.log(`[Webhook/AddisPay] ✅ Credited ${amount} ETB to user ${userId} (orderId: ${orderId})`);
    return NextResponse.json({ received: true, credited: amount });
  } catch (err) {
    console.error('[Webhook/AddisPay] creditDeposit error:', err);
    return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'AddisPay webhook endpoint is active' });
}
