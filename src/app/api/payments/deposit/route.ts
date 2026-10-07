/**
 * POST /api/payments/deposit
 *
 * Manual Telebirr / CBE deposit only (no payment gateway).
 * Wallet is credited ONLY after an admin verifies the transfer in the admin panel.
 * If the player attaches a screenshot, it is forwarded to all admin Telegram chats as a photo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, PaymentProvider } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

/** Format a date in Ethiopian local time (UTC+3) */
function formatEthTime(date: Date): string {
  return date.toLocaleString('en-ET', {
    timeZone: 'Africa/Addis_Ababa',
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

/**
 * Send the screenshot to a Telegram chat.
 * The screenshot can be a base64 data-URI (data:image/...;base64,...) or a raw base64 string.
 * We use sendPhoto with multipart/form-data so the image appears inline (not as a file link).
 */
async function sendScreenshotToTelegram(
  botToken: string,
  chatId: string,
  screenshotBase64: string,
  caption: string,
  replyMarkup?: any,
): Promise<void> {
  try {
    // Strip the data-URI prefix if present
    const base64Data = screenshotBase64.includes(',')
      ? screenshotBase64.split(',')[1]
      : screenshotBase64;

    // Detect mime type from header (default to jpeg)
    const mimeMatch = screenshotBase64.match(/^data:(image\/[a-z+]+);base64,/);
    const mimeType  = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext       = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';

    const binaryData = Buffer.from(base64Data, 'base64');
    const blob       = new Blob([binaryData], { type: mimeType });

    const form = new FormData();
    form.append('chat_id',    chatId);
    form.append('caption',    caption);
    form.append('parse_mode', 'HTML');
    form.append('photo',      blob, `receipt.${ext}`);
    if (replyMarkup) {
      form.append('reply_markup', JSON.stringify(replyMarkup));
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body:   form,
    });
  } catch {
    // Non-critical — ignore failures
  }
}

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

    // ── Anti-Spam: Limit maximum pending deposits per user ──────────────────
    const pendingCount = await db.getPendingDepositsCountForUser(userId);
    if (pendingCount >= 2) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'You already have pending deposit requests under admin review. Please wait for them to be verified before submitting another.',
      }, { status: 429 });
    }

    // ── Manual Telebirr / CBE deposit (admin-reviewed) ───────────────────────
    const rawCode       = (transactionCode ?? '').trim();
    const cleanCode     = rawCode.toUpperCase().replace(/[\s-_]/g, '');
    const hasCode       = cleanCode.length >= 3;
    const hasScreenshot = Boolean(screenshot && screenshot.trim().length > 0);

    if (!hasCode && !hasScreenshot) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Please enter your Transaction Reference Code / FT number, or attach a payment receipt screenshot.',
      }, { status: 400 });
    }

    // ── Strict format validation to prevent fake/random codes ────────────────
    const provStr = (provider ?? 'Telebirr').toString().toLowerCase();
    if (hasCode) {
      // Reject repetitive or sequential junk
      if (/^(.)\1+$/.test(cleanCode) || cleanCode === '1234567890' || cleanCode === '0123456789') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid transaction code format. Repeated or sequential numbers are not accepted.',
        }, { status: 400 });
      }

      if (provStr.includes('telebirr')) {
        // Telebirr transaction codes are 10 alphanumeric characters (e.g. DJ74JCZJNJ)
        const telebirrPattern = /^[A-Z0-9]{10}$/;
        if (!telebirrPattern.test(cleanCode)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Invalid Telebirr transaction code. Telebirr codes are exactly 10 alphanumeric characters (e.g. DJ74JCZJNJ).',
          }, { status: 400 });
        }
      } else if (provStr.includes('cbe')) {
        // CBE transfer references start with FT followed by 8-14 alphanumeric chars
        const cbePattern = /^FT[0-9A-Z]{8,14}$/;
        if (!cbePattern.test(cleanCode)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Invalid CBE transaction reference. CBE transfer codes start with FT (e.g. FT24281XXXXX).',
          }, { status: 400 });
        }
      }
    }

    const txRef = cleanCode || `HBINGO_${userId}_${Date.now()}`;

    if (hasCode && (await db.isDepositReferenceAlreadyUsed(cleanCode))) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error:
          'This transaction reference was already submitted or approved. Each transfer code can only be used once.',
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

    // ── Notify admins via Telegram (non-blocking) ────────────────────────────
    const botToken     = DEFAULT_BOT_TOKEN;
    const adminIds     = getAdminWhitelist();
    const targetAdmins = adminIds.length > 0 ? adminIds : ['570615212', '7829104'];

    const adminMsg =
      `💰 <b>DEPOSIT REQUEST — ADMIN REVIEW REQUIRED</b>\n\n` +
      `👤 <b>Player:</b> ${user.name} (@${user.username ?? 'N/A'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `📞 <b>Phone:</b> <code>${user.phone ?? senderPhone ?? 'N/A'}</code>\n` +
      `💰 <b>Amount:</b> <b>${amount} ETB</b>\n` +
      `💳 <b>Provider:</b> ${provider ?? 'Telebirr'}\n` +
      (hasCode       ? `🔖 <b>Transaction Code / FT:</b> <code>${code}</code>\n` : '') +
      (hasScreenshot ? `📸 <b>Receipt/Screenshot:</b> See photo below\n`         : '') +
      `🔖 <b>Reference:</b> <code>${txRef}</code>\n` +
      `📋 <b>Tx ID:</b> <code>${pendingTx.id}</code>\n` +
      `⏰ <b>Time:</b> ${formatEthTime(new Date())}\n\n` +
      `⚠️ <i>Wallet NOT credited yet. Please verify payment and approve in the admin panel.</i>\n` +
      `🔗 <a href="${appUrl}/admin">Open Admin Panel</a>`;

    const inlineApprovalKeyboard = {
      inline_keyboard: [
        [
          { text: `✅ Approve ${amount} ETB`, callback_data: `appr_dep:${pendingTx.id}` },
          { text: `❌ Reject`, callback_data: `rejc_dep:${pendingTx.id}` },
        ],
        [
          { text: `⚡ 1-Click Web Approve`, url: `${appUrl}/api/admin/quick-approve?action=approve&txId=${pendingTx.id}` },
          { text: `🛡️ Admin Panel`, url: `${appUrl}?tab=admin` },
        ],
      ],
    };

    if (hasScreenshot) {
      // Send the screenshot as a photo with the full caption + 1-Click approval buttons
      Promise.allSettled(
        targetAdmins.map((id) =>
          sendScreenshotToTelegram(botToken, id, screenshot!, adminMsg, inlineApprovalKeyboard)
        )
      ).catch(() => {});
    } else {
      // No screenshot — send text message with 1-Click approval buttons
      Promise.allSettled(
        targetAdmins.map((id) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: id,
              text: adminMsg,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: inlineApprovalKeyboard,
            }),
          })
        )
      ).catch(() => {});
    }

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
