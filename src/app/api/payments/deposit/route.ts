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
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

    // Create PENDING deposit in DB (Owner must review & approve!)
    let createdTx;
    try {
      createdTx = await db.createPendingDeposit({
        id: txId,
        userId,
        amount,
        provider: provider || 'Telebirr',
        reference: txRef,
        description: `Deposit via ${provider} (Code: ${txRef})`,
      });
    } catch (dbErr) {
      console.error('[Deposit API] createPendingDeposit error:', dbErr);
    }

    // NOTIFY OWNER / ADMINISTRATORS VIA TELEGRAM WITH VERIFICATION CODE
    const adminWhitelist = getAdminWhitelist();
    const targetAdmins = adminWhitelist.length > 0 ? adminWhitelist : ['570615212', '7829104'];

    const proofDescription = [
      hasCode ? `🔖 <b>Transaction ID / Code:</b> <code>${code}</code>` : '',
      hasScreenshot ? `📸 <b>Screenshot:</b> Attached` : (provider === 'CBE Birr' ? `ℹ️ <i>CBE App blocks screenshot on Android. Code provided above.</i>` : ''),
    ].filter(Boolean).join('\n');

    const notificationMessage = 
      `🚨 <b>NEW DEPOSIT SUBMITTED (PENDING APPROVAL)</b> 🚨\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username || 'user'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `📞 <b>Phone:</b> <code>${user.phone || senderPhone || 'N/A'}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB</b>\n` +
      `💳 <b>Payment Provider:</b> <b>${provider}</b>\n` +
      `${proofDescription}\n` +
      `🔖 <b>System Ref:</b> <code>${txRef}</code>\n` +
      `⏰ <b>Date & Time:</b> ${new Date().toLocaleString()}\n\n` +
      `👉 <b>ACTION:</b> Verify receipt in your ${provider} account / SMS using code: <code>${txRef}</code>.\n` +
      `Then open <b>Admin Panel → Finance → Pending Deposits</b> to Approve or Reject.`;

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
        txId: createdTx?.id || txId,
        txRef,
        amount,
        provider,
        status: 'PENDING',
        message: `Deposit request of ${amount} ETB submitted! Status: PENDING review. The owner will verify the transaction code and approve your balance shortly.`,
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
