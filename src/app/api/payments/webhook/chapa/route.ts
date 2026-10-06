/**
 * POST /api/payments/webhook/chapa
 *
 * Chapa sends a webhook POST after payment events.
 * This handler:
 *   1. Verifies the HMAC-SHA256 signature (x-chapa-signature header)
 *   2. Double-verifies the transaction status with Chapa API
 *   3. Credits the player wallet ONLY on confirmed SUCCESS
 *   4. Is idempotent — duplicate webhooks for the same tx_ref are ignored
 *
 * GET handled for Chapa's validation ping during setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyChapaWebhook, chapaVerifyTransaction } from '@/lib/payments/chapa';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const signature = req.headers.get('x-chapa-signature') ?? '';

  // ── 1. Verify webhook signature ─────────────────────────────────────────
  if (!verifyChapaWebhook(rawBody, signature)) {
    console.warn('[Webhook/Chapa] Invalid signature — request rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { event?: string; tx_ref?: string; status?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── 2. Only process success events ──────────────────────────────────────
  const isSuccess =
    payload.event === 'charge.success' ||
    (payload.status ?? '').toLowerCase() === 'success';

  if (!isSuccess) {
    console.log('[Webhook/Chapa] Non-success event ignored:', payload.event, payload.status);
    return NextResponse.json({ received: true });
  }

  // ── 3. Double-verify with Chapa API ─────────────────────────────────────
  const txRef = payload.tx_ref;
  if (!txRef) {
    console.error('[Webhook/Chapa] Missing tx_ref in payload');
    return NextResponse.json({ received: true });
  }

  const verify = await chapaVerifyTransaction(txRef);
  if (verify.data?.status !== 'success') {
    console.warn('[Webhook/Chapa] Verification mismatch for', txRef, '— status:', verify.data?.status);
    return NextResponse.json({ received: true });
  }

  // ── 4. Extract userId from txRef (format: HBINGO_{userId}_{timestamp}) ──
  const parts  = txRef.split('_');
  const userId = parts.length >= 3 ? parts.slice(1, -1).join('_') : parts[1];
  if (!userId) {
    console.error('[Webhook/Chapa] Cannot parse userId from txRef:', txRef);
    return NextResponse.json({ received: true });
  }

  const amount = verify.data.amount;
  if (!amount || amount <= 0) {
    console.error('[Webhook/Chapa] Invalid amount in verification:', amount);
    return NextResponse.json({ received: true });
  }

  // ── 5. Credit wallet (idempotent) ───────────────────────────────────────
  try {
    await db.creditDeposit(userId, amount, txRef, 'Chapa');
    console.log(`[Webhook/Chapa] ✅ Credited ${amount} ETB to user ${userId} (txRef: ${txRef})`);
    return NextResponse.json({ received: true, credited: amount });
  } catch (err) {
    console.error('[Webhook/Chapa] creditDeposit error:', err);
    return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Chapa webhook endpoint is active' });
}
