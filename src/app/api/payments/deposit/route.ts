/**
 * POST /api/payments/deposit
 *
 * Deposit Flow:
 *   1. Validate request
 *   2. Create a PENDING transaction in the DB
 *   3. Initialize ArifPay hosted checkout session
 *   4. Return the checkoutUrl — player is redirected there to pay
 *   5. Wallet is credited ONLY after ArifPay confirms via webhook
 *      → /api/payments/webhook/arifpay
 *
 * Required env: ARIFPAY_API_KEY, ARIFPAY_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, DepositInitResponse } from '@/lib/types';
import { arifPayInitCheckout } from '@/lib/payments/arifpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, email, phone, firstName, lastName } = body as {
      userId: string;
      amount: number;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    };

    // ── Validation ──────────────────────────────────────────────────────────
    if (!userId || !amount || amount < 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and amount (minimum 10 ETB) are required',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Your account is suspended. Please contact support.',
      }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3000';
    // txRef format: HBINGO_{userId}_{timestamp}
    // The webhook parser splits on '_' and slices [1..-1] to recover userId
    const txRef = `HBINGO_${userId}_${Date.now()}`;

    // ── Create PENDING transaction (wallet NOT credited yet) ────────────────
    await db.createPendingDeposit({
      userId,
      amount,
      provider: 'ArifPay',
      reference: txRef,
      description: `Deposit via ArifPay — awaiting payment confirmation`,
    });

    // ── Initialize ArifPay checkout ─────────────────────────────────────────
    const playerEmail = email     ?? `${user.username ?? userId}@hyperbingo.et`;
    const playerPhone = phone     ?? user.phone ?? '';
    const first       = firstName ?? (user.name?.split(' ')[0]            ?? 'Player');
    const last        = lastName  ?? (user.name?.split(' ').slice(1).join(' ') ?? '');

    const successUrl = `${appUrl}/app?deposit=success&txRef=${txRef}`;
    const cancelUrl  = `${appUrl}/app?deposit=cancelled&txRef=${txRef}`;
    const notifyUrl  = `${appUrl}/api/payments/webhook/arifpay`;

    const checkout = await arifPayInitCheckout({
      nonce:      txRef,
      email:      playerEmail,
      phone:      playerPhone,
      amount,
      items:      [{ name: 'Hyper Bingo Deposit', quantity: 1, price: amount }],
      successUrl,
      cancelUrl,
      notifyUrl,
    });

    if (!checkout.success || !checkout.paymentUrl) {
      // Mark pending tx as failed so it doesn't linger
      await db.rejectPendingDeposit(
        (await db.createPendingDeposit({ userId, amount, provider: 'ArifPay', reference: txRef + '_err', description: '' })).id
      ).catch(() => {});

      console.error('[Deposit] ArifPay checkout init failed:', checkout.message);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: checkout.message ?? 'Payment gateway is unavailable. Please try again later.',
      }, { status: 503 });
    }

    console.log(`[Deposit] ArifPay session created — txRef: ${txRef}, sessionId: ${checkout.sessionId}`);

    return NextResponse.json<ApiResponse<DepositInitResponse>>({
      success: true,
      data: {
        checkoutUrl: checkout.paymentUrl,
        txRef,
        amount,
        currency: 'ETB',
      },
      message: `Redirecting to ArifPay — please complete your ${amount} ETB payment.`,
    });

  } catch (err) {
    console.error('[Deposit API] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to initialize deposit. Please try again.',
    }, { status: 500 });
  }
}
