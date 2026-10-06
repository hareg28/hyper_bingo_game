/**
 * POST /api/payments/webhook/arifpay
 *
 * ArifPay sends a webhook POST after every payment state change.
 * This handler:
 *   1. Verifies the HMAC-SHA256 signature (x-arifpay-signature header)
 *   2. Double-verifies the session status directly with ArifPay API
 *   3. Credits the player wallet ONLY on confirmed SUCCESS
 *   4. Is idempotent — duplicate webhooks for the same txRef are ignored
 *
 * GET is also handled so ArifPay's health-check ping doesn't 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyArifPayWebhook, arifPayVerifySession } from '@/lib/payments/arifpay';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get('x-arifpay-signature') ?? '';

  // ── 1. Verify webhook signature ─────────────────────────────────────────
  if (!verifyArifPayWebhook(rawBody, signature)) {
    console.warn('[Webhook/ArifPay] Invalid signature — request rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { event?: string; sessionId?: string; nonce?: string; status?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── 2. Only process success events ──────────────────────────────────────
  const isSuccess =
    payload.event === 'PAYMENT_SUCCESS' ||
    payload.status?.toUpperCase() === 'COMPLETED' ||
    payload.status?.toUpperCase() === 'PAID';

  if (!isSuccess) {
    console.log('[Webhook/ArifPay] Non-success event ignored:', payload.event, payload.status);
    return NextResponse.json({ received: true });
  }

  // ── 3. Double-verify with ArifPay API ────────────────────────────────────
  const sessionId = payload.sessionId;
  if (!sessionId) {
    console.error('[Webhook/ArifPay] Missing sessionId in payload');
    return NextResponse.json({ received: true });
  }

  const verify = await arifPayVerifySession(sessionId);
  if (verify.status !== 'COMPLETED') {
    console.warn('[Webhook/ArifPay] Verification mismatch — status:', verify.status);
    return NextResponse.json({ received: true });
  }

  // ── 4. Extract userId from nonce (format: HBINGO_{userId}_{timestamp}) ──
  const nonce = payload.nonce ?? verify.nonce ?? '';
  const parts = nonce.split('_');
  // nonce = "HBINGO_usr_xxx_1234567890"  →  parts[1..n-1] = userId segments
  const userId = parts.length >= 3 ? parts.slice(1, -1).join('_') : parts[1];
  if (!userId) {
    console.error('[Webhook/ArifPay] Cannot parse userId from nonce:', nonce);
    return NextResponse.json({ received: true });
  }

  const amount = verify.amount;
  if (!amount || amount <= 0) {
    console.error('[Webhook/ArifPay] Invalid amount in verification response:', amount);
    return NextResponse.json({ received: true });
  }

  // ── 5. Credit wallet (idempotent — duplicate txRef is rejected by DB) ───
  try {
    await db.creditDeposit(userId, amount, nonce, 'ArifPay');
    console.log(`[Webhook/ArifPay] ✅ Credited ${amount} ETB to user ${userId} (nonce: ${nonce})`);
    return NextResponse.json({ received: true, credited: amount });
  } catch (err) {
    console.error('[Webhook/ArifPay] creditDeposit error:', err);
    return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ArifPay webhook endpoint is active' });
}
