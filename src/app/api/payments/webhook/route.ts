import { NextRequest, NextResponse } from 'next/server';
import { verifyChapaWebhook, chapaVerifyTransaction } from '@/lib/payments/chapa';
import { db } from '@/lib/db';
import { PaymentProvider } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-chapa-signature') ?? '';

    // Verify webhook authenticity
    if (!verifyChapaWebhook(rawBody, signature)) {
      console.warn('[Webhook] Invalid Chapa signature rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      tx_ref: string;
      status: string;
    };

    // Only process completed deposits
    if (payload.event !== 'charge.success' && payload.status !== 'success') {
      return NextResponse.json({ received: true });
    }

    // Double-verify with Chapa API
    const verify = await chapaVerifyTransaction(payload.tx_ref);
    if (verify.data?.status !== 'success') {
      console.warn('[Webhook] Chapa verification mismatch for', payload.tx_ref);
      return NextResponse.json({ received: true });
    }

    // Extract userId from txRef format: HBINGO_{userId}_{timestamp}
    const parts = payload.tx_ref.split('_');
    const userId = parts[1];
    if (!userId) {
      console.error('[Webhook] Could not parse userId from txRef:', payload.tx_ref);
      return NextResponse.json({ received: true });
    }

    const amount = verify.data.amount;

    // Determine payment provider from tx_ref or default to Chapa
    const provider: PaymentProvider = 'Chapa';

    // Credit user wallet
    await db.creditDeposit(userId, amount, payload.tx_ref, provider);

    console.log(`[Webhook] Credited ${amount} ETB to user ${userId} via ${provider}`);
    return NextResponse.json({ received: true, credited: amount });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Chapa also sends GET requests for validation during setup
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint is active' });
}
