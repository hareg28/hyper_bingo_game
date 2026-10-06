/**
 * POST /api/payments/deposit
 *
 * Unified Deposit Route — two modes:
 *
 * MODE A — Chapa Hosted Checkout (recommended, automatic):
 *   Body: { userId, amount, mode: 'chapa' }
 *   → Creates PENDING tx → Returns Chapa checkout URL
 *   → Wallet credited ONLY after Chapa confirms via webhook at /api/payments/webhook/chapa
 *
 * MODE B — Manual / Screenshot deposit (admin-reviewed):
 *   Body: { userId, amount, provider, transactionCode?, screenshot?, senderPhone? }
 *   → Creates PENDING tx → Admin approves/rejects in admin panel
 *   → Wallet credited ONLY after admin approves
 *
 * Required env (Mode A): CHAPA_SECRET_KEY, CHAPA_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, DepositInitResponse, PaymentProvider } from '@/lib/types';
import { chapaInitializeDeposit } from '@/lib/payments/chapa';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, mode, provider, transactionCode, screenshot, senderPhone } = body as {
      userId: string;
      amount: number;
      /** 'chapa' for hosted checkout | 'manual' (or absent) for screenshot/code deposit */
      mode?: 'chapa' | 'manual';
      provider?: PaymentProvider;
      transactionCode?: string;
      screenshot?: string;
      senderPhone?: string;
    };

    // ── Common validation ────────────────────────────────────────────────────
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

    // ── MODE A: Chapa Hosted Checkout ────────────────────────────────────────
    if (mode === 'chapa') {
      if (!process.env.CHAPA_SECRET_KEY) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Online payment gateway is not configured. Please use manual deposit.',
        }, { status: 503 });
      }

      // txRef format: HBINGO_{userId}_{timestamp}  — webhook parser extracts userId
      const txRef = `HBINGO_${userId}_${Date.now()}`;

      // Create PENDING transaction — wallet NOT credited yet
      await db.createPendingDeposit({
        userId,
        amount,
        provider: 'Chapa',
        reference: txRef,
        description: 'Deposit via Chapa — awaiting payment confirmation',
      });

      const nameParts  = (user.name ?? 'Hyper Bingo Player').split(' ');
      const firstName  = nameParts[0] ?? 'Player';
      const lastName   = nameParts.slice(1).join(' ') || 'User';
      const email      = `${user.username ?? userId}@hyperbingo.et`;
      const phone      = user.phone ?? senderPhone ?? '';

      const checkout = await chapaInitializeDeposit({
        amount,
        currency:     'ETB',
        email,
        first_name:   firstName,
        last_name:    lastName,
        phone_number: phone,
        tx_ref:       txRef,
        return_url:   `${appUrl}/app?deposit=success&txRef=${txRef}`,
        callback_url: `${appUrl}/api/payments/webhook/chapa`,
        customization: {
          title:       'Hyper Bingo Deposit',
          description: `Deposit ${amount} ETB to Hyper Bingo wallet`,
        },
      });

      if (checkout.status !== 'success' || !checkout.data?.checkout_url) {
        // Roll back the pending tx
        await db.rejectPendingDeposit(txRef).catch(() => {});
        console.error('[Deposit/Chapa] Checkout init failed:', checkout.message);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: checkout.message ?? 'Failed to initialize Chapa checkout. Please try manual deposit.',
        }, { status: 503 });
      }

      console.log(`[Deposit/Chapa] Checkout created — txRef: ${txRef}`);
      return NextResponse.json<ApiResponse<DepositInitResponse>>({
        success: true,
        data: {
          checkoutUrl: checkout.data.checkout_url,
          txRef,
          amount,
          currency: 'ETB',
        },
        message: `Redirecting to Chapa — please complete your ${amount} ETB payment.`,
      });
    }

    // ── MODE B: Manual / Screenshot Deposit (admin-reviewed) ─────────────────
    const code        = (transactionCode ?? '').trim();
    const hasCode      = code.length >= 3;
    const hasScreenshot = Boolean(screenshot && screenshot.trim().length > 0);

    if (!hasCode && !hasScreenshot) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Please enter your Transaction Reference Code / FT number, or attach a payment receipt screenshot.',
      }, { status: 400 });
    }

    const txRef = code || `HBINGO_${userId}_${Date.now()}`;

    // Create PENDING transaction — admin must approve before wallet is credited
    const pendingTx = await db.createPendingDeposit({
      userId,
      amount,
      provider: (provider ?? 'Telebirr') as PaymentProvider,
      reference: txRef,
      description: `Manual deposit via ${provider ?? 'Telebirr'} — pending admin review`,
    });

    // Notify admins via Telegram (non-blocking)
    const botToken     = DEFAULT_BOT_TOKEN;
    const adminIds     = getAdminWhitelist();
    const targetAdmins = adminIds.length > 0 ? adminIds : ['570615212', '7829104'];

    const proofDescription = [
      hasCode       ? `🔖 <b>Transaction Code / FT:</b> <code>${code}</code>` : '',
      hasScreenshot ? `📸 <b>Receipt/Screenshot:</b> Attached` : '',
    ].filter(Boolean).join('\n');

    const adminMsg =
      `💰 <b>DEPOSIT REQUEST — ADMIN REVIEW REQUIRED</b>\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username ?? 'N/A'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `📞 <b>Phone:</b> <code>${user.phone ?? senderPhone ?? 'N/A'}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB</b>\n` +
      `💳 <b>Provider:</b> ${provider ?? 'Telebirr'}\n` +
      `${proofDescription}\n` +
      `🔖 <b>Reference:</b> <code>${txRef}</code>\n` +
      `📋 <b>Tx ID:</b> <code>${pendingTx.id}</code>\n` +
      `⏰ <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
      `⚠️ <i>Wallet NOT credited yet. Please verify payment and approve in the admin panel.</i>\n` +
      `🔗 <a href="${appUrl}/admin">Open Admin Panel</a>`;

    Promise.allSettled(
      targetAdmins.map((id) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: id, text: adminMsg, parse_mode: 'HTML', disable_web_page_preview: true }),
        })
      )
    ).catch(() => {});

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        txId:    pendingTx.id,
        txRef,
        amount,
        status:  'PENDING',
        message: `Deposit request of ${amount} ETB submitted for review. Your balance will be credited once an admin verifies your payment — usually within a few hours.`,
      },
    });

  } catch (err) {
    console.error('[Deposit API] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to process deposit. Please try again.',
    }, { status: 500 });
  }
}
