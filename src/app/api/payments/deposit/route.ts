/**
 * POST /api/payments/deposit
 *
 * Manual Telebirr / CBE deposit only (no payment gateway).
 * Wallet is credited ONLY after an admin verifies the transfer in the admin panel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, PaymentProvider } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, mode, provider, transactionCode, screenshot, senderPhone } = body as {
      userId: string;
      amount: number;
      /** 'arifpay' | 'online' for hosted checkout | 'manual' (or absent) for screenshot/code deposit */
      mode?: 'arifpay' | 'online' | 'manual';
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

    if (mode === 'arifpay' || mode === 'online') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment gateway is disabled. Transfer via Telebirr or CBE, then submit your transaction ID for admin verification.',
      }, { status: 503 });
    }

    // ── Manual Telebirr / CBE deposit (admin-reviewed) ───────────────────────
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

    if (hasCode && (await db.isDepositReferenceAlreadyUsed(code))) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error:
          'This transaction reference was already submitted or approved. If you believe this is an error, contact support.',
      }, { status: 409 });
    }

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
