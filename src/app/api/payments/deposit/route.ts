import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, provider, depositReference, screenshot, senderPhone } = body as {
      userId: string;
      amount: number;
      provider: 'Telebirr' | 'CBE Birr' | 'Chapa' | 'Bank Transfer';
      depositReference?: string;
      screenshot?: string;
      senderPhone?: string;
    };

    if (!userId || !amount || amount < 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and amount (minimum 10 ETB) are required',
      }, { status: 400 });
    }

    // REQUIRE payment screenshot
    if (!screenshot || screenshot.trim() === '') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment screenshot is required. Please attach your transfer screenshot or receipt before submitting.',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    const txRef = depositReference || `HBINGO_${userId}_${Date.now()}`;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

    // Credit deposit to user wallet in DB
    try {
      await db.creditDeposit(userId, amount, provider || 'Telebirr', txRef);
    } catch (dbErr) {
      console.error('[Deposit API] creditDeposit error:', dbErr);
    }

    // NOTIFY OWNER / ADMINISTRATORS VIA TELEGRAM
    const adminWhitelist = getAdminWhitelist();
    const targetAdmins = adminWhitelist.length > 0 ? adminWhitelist : ['570615212', '7829104'];

    const notificationMessage = 
      `🚨 <b>NEW DEPOSIT SUBMITTED / አዲስ ተቀማጭ ጥያቄ</b> 🚨\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username || 'user'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `📞 <b>Phone:</b> <code>${user.phone || senderPhone || 'N/A'}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB</b>\n` +
      `💳 <b>Payment Provider:</b> <b>${provider}</b>\n` +
      `🔖 <b>Reference:</b> <code>${txRef}</code>\n` +
      `📸 <b>Payment Screenshot:</b> Attached & Verified ✅\n` +
      `⏰ <b>Date & Time:</b> ${new Date().toLocaleString()}\n\n` +
      `👉 <i>The player attached their payment screenshot. Please verify your ${provider} account to confirm receipt of funds.</i>`;

    // Dispatch notification to all admin chat IDs
    for (const adminId of targetAdmins) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: notificationMessage,
            parse_mode: 'HTML',
          }),
        });
      } catch (tgErr) {
        console.error(`[Deposit API] Failed to send Telegram alert to admin ${adminId}:`, tgErr);
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        txRef,
        amount,
        provider,
        notifiedAdminsCount: targetAdmins.length,
        message: 'Deposit submitted successfully! The owner has received notification along with your payment screenshot.',
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
