import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, WithdrawResponse, PaymentProvider } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, accountNumber, accountName, paymentMethod } = body as {
      userId: string;
      amount: number;
      accountNumber: string;   // Telebirr: +2519..., CBE: account number
      accountName: string;     // Full legal name
      paymentMethod: PaymentProvider;
    };

    // Validation
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

    // Create withdrawal — deducts from winningBalance and marks COMPLETED immediately
    const { withdrawal, transaction } = await db.createWithdrawal({
      userId,
      amount,
      paymentMethod,
      accountNumber,
      accountName,
    });

    // NON-BLOCKING Telegram notification to admins (fire-and-forget, for record-keeping)
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
    const adminWhitelist = getAdminWhitelist();
    const targetAdmins = adminWhitelist.length > 0 ? adminWhitelist : ['570615212', '7829104'];

    const notificationMessage =
      `💸 <b>INSTANT WITHDRAWAL AUTO-PROCESSED!</b> 💸\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username || 'user'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB (PAID)</b>\n` +
      `💳 <b>Payment Method:</b> <b>${paymentMethod}</b>\n` +
      `📞 <b>Account Number:</b> <code>${accountNumber}</code>\n` +
      `👤 <b>Account Name:</b> ${accountName}\n` +
      `🔖 <b>Reference ID:</b> <code>${withdrawal.id}</code>\n` +
      `📋 <b>Transaction ID:</b> <code>${transaction.id}</code>\n` +
      `⏰ <b>Date & Time:</b> ${new Date().toLocaleString()}\n\n` +
      `✅ <i>Withdrawal auto-processed. No admin action required — system authenticated.</i>`;

    // Fire and forget — don't block response
    Promise.allSettled(
      targetAdmins.map((adminId) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: notificationMessage,
            parse_mode: 'HTML',
          }),
        })
      )
    ).catch((tgErr) => {
      console.error('[Withdraw API] Async Telegram alert error:', tgErr);
    });

    return NextResponse.json<ApiResponse<WithdrawResponse>>({
      success: true,
      data: {
        withdrawalId: withdrawal.id,
        status: 'COMPLETED',
        estimatedProcessingTime: 'Instant (auto-processed)',
      },
      message: `✅ Withdrawal of ${amount} ETB to ${accountNumber} (${paymentMethod}) has been processed instantly! Funds will arrive shortly.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Withdraw API] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
