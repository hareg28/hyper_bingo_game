/**
 * POST /api/payments/withdraw
 *
 * Withdrawal Flow (correct architecture):
 *   1. Validate request + check balance
 *   2. Reserve the amount (deduct from wallet immediately → PENDING)
 *   3. Create PENDING withdrawal_request + PENDING transaction in DB
 *   4. Notify admins via Telegram — they must approve/reject in the admin panel
 *   5. On admin approval → admin route calls disburse() → gateway sends money
 *   6. On gateway confirmation → withdrawal marked COMPLETED
 *   7. On admin rejection → balance refunded, withdrawal marked FAILED
 *
 * Key principle: the player's Bingo balance is debited right away (reservation)
 * so they cannot double-spend while the request is pending admin review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, WithdrawResponse, PaymentProvider } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, accountNumber, accountName, paymentMethod } = body as {
      userId: string;
      amount: number;
      /** Player's Telebirr phone, CBE account, or bank account number */
      accountNumber: string;
      /** Full legal name registered on the account */
      accountName: string;
      paymentMethod: PaymentProvider;
    };

    // ── Validation ──────────────────────────────────────────────────────────
    if (!userId || !amount || !accountNumber || !accountName || !paymentMethod) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'All fields are required: userId, amount, accountNumber, accountName, paymentMethod',
      }, { status: 400 });
    }

    if (amount < 50) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Minimum withdrawal amount is 50 ETB',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    // ── Withdraw rules: suspended accounts cannot withdraw ──────────────────
    if (user.status === 'suspended') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Your account is suspended. Please contact support.',
      }, { status: 403 });
    }

    // ── Reserve balance + create PENDING withdrawal ─────────────────────────
    // createPendingWithdrawal deducts the amount from the wallet immediately
    // so the player cannot double-spend while the admin reviews the request.
    const { withdrawal, transaction } = await db.createPendingWithdrawal({
      userId,
      amount,
      paymentMethod,
      accountNumber,
      accountName,
    });

    // ── Notify admins via Telegram (non-blocking, fire-and-forget) ──────────
    const botToken     = DEFAULT_BOT_TOKEN;
    const adminIds     = getAdminWhitelist();
    const targetAdmins = adminIds.length > 0 ? adminIds : ['570615212', '7829104'];

    const adminMessage =
      `🔔 <b>NEW WITHDRAWAL REQUEST — ACTION REQUIRED</b> 🔔\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username || 'N/A'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB</b>\n` +
      `💳 <b>Payment Method:</b> <b>${paymentMethod}</b>\n` +
      `📞 <b>Account Number:</b> <code>${accountNumber}</code>\n` +
      `👤 <b>Account Name:</b> ${accountName}\n` +
      `🔖 <b>Withdrawal ID:</b> <code>${withdrawal.id}</code>\n` +
      `📋 <b>Transaction ID:</b> <code>${transaction.id}</code>\n` +
      `⏰ <b>Requested At:</b> ${new Date().toLocaleString()}\n\n` +
      `⏳ <i>Status: PENDING — Balance has been reserved. Visit the admin panel to Approve or Reject.</i>\n\n` +
      `🔗 <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin">Open Admin Panel</a>`;

    Promise.allSettled(
      targetAdmins.map((adminId) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: adminMessage,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        })
      )
    ).catch((err) => console.error('[Withdraw API] Telegram notify error:', err));

    // ── Respond to player ───────────────────────────────────────────────────
    return NextResponse.json<ApiResponse<WithdrawResponse>>({
      success: true,
      data: {
        withdrawalId: withdrawal.id,
        status: 'PENDING',
        estimatedProcessingTime: 'Up to 24 hours (subject to admin review)',
      },
      message:
        `✅ Withdrawal request of ${amount} ETB submitted successfully!\n` +
        `Your balance has been reserved. The funds will be sent to ${accountNumber} ` +
        `(${paymentMethod}) once approved — usually within a few hours.`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Withdraw API] Error:', err);

    // Surface balance errors clearly to the player
    if (message === 'Insufficient withdrawable balance') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient balance. You can only withdraw from your winning or available balance (bonus balance is excluded).',
      }, { status: 422 });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
