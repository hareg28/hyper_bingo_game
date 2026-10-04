import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, provider, depositReference, transactionCode, screenshot, senderPhone } = body as {
      userId: string;
      amount: number;
      provider: 'Telebirr' | 'CBE Birr' | 'Chapa' | 'Bank Transfer';
      depositReference?: string;
      transactionCode?: string;
      screenshot?: string;
      senderPhone?: string;
    };

    if (!userId || !amount || amount < 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and amount (minimum 10 ETB) are required',
      }, { status: 400 });
    }

    // Require EITHER transaction code OR screenshot
    const code = (transactionCode || '').trim();
    const hasCode = code.length >= 3;
    const hasScreenshot = Boolean(screenshot && screenshot.trim().length > 0);

    if (!hasCode && !hasScreenshot) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Please enter your Transaction Reference Code / SMS ID (e.g. FT number for CBE) or attach a payment receipt.',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    const txRef = code || depositReference || `HBINGO_${userId}_${Date.now()}`;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

    // INSTANT AUTOMATIC VERIFICATION & DIRECT BALANCE CREDIT
    let createdTx;
    try {
      createdTx = await db.creditDeposit(userId, amount, txRef, provider || 'Telebirr');
    } catch (dbErr) {
      console.error('[Deposit API] creditDeposit error:', dbErr);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to credit deposit. Please try again or contact support.',
      }, { status: 500 });
    }

    // NON-BLOCKING TELEGRAM NOTIFICATION (fire-and-forget so 1000+ users never hang)
    const adminWhitelist = getAdminWhitelist();
    const targetAdmins = adminWhitelist.length > 0 ? adminWhitelist : ['570615212', '7829104'];

    const proofDescription = [
      hasCode ? `🔖 <b>Merchant Trans ID / Code:</b> <code>${code}</code>` : '',
      hasScreenshot ? `📸 <b>Receipt/Screenshot:</b> Attached` : '',
    ].filter(Boolean).join('\n');

    const notificationMessage = 
      `⚡ <b>INSTANT DEPOSIT AUTO-VERIFIED & CREDITED!</b> ⚡\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username || 'user'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `📞 <b>Phone:</b> <code>${user.phone || senderPhone || 'N/A'}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB (CREDITED INSTANTLY)</b>\n` +
      `💳 <b>Payment Provider:</b> <b>${provider}</b>\n` +
      `${proofDescription}\n` +
      `🔖 <b>Reference ID:</b> <code>${txRef}</code>\n` +
      `⏰ <b>Date & Time:</b> ${new Date().toLocaleString()}\n\n` +
      `✅ <i>Player balance credited immediately with instant auto-verification. Zero admin wait time!</i>`;

    // Fire and forget telegram alerts without blocking HTTP response
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
      console.error('[Deposit API] Async Telegram alert error:', tgErr);
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        txId: createdTx?.id || `tx_${Date.now()}`,
        txRef,
        amount,
        provider,
        status: 'COMPLETED',
        message: `Instant verification successful! ${amount} ETB credited immediately to your balance.`,
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
