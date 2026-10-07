/**
 * Admin Deposit Management API
 *
 * GET  /api/admin/deposits  — list all deposits from the last 7 days (any status)
 * POST /api/admin/deposits  — approve or reject a pending deposit
 *
 * Approval flow:
 *   1. Admin clicks Approve → POST { transactionId, action: 'APPROVE', adminName }
 *   2. Backend credits wallet, marks tx COMPLETED, notifies player via Telegram
 *
 * Rejection flow:
 *   1. Admin clicks Reject  → POST { transactionId, action: 'REJECT',  adminName }
 *   2. Backend marks tx FAILED, notifies player via Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
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

// ── GET — list all recent deposits (any status) ─────────────────────────────
export async function GET() {
  try {
    const deposits = await db.getRecentDeposits();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: deposits,
    });
  } catch (err: unknown) {
    console.error('Error fetching deposits:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch deposits',
    }, { status: 500 });
  }
}

// ── POST — approve or reject a pending deposit ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, action, adminName } = body as {
      transactionId: string;
      action: 'APPROVE' | 'REJECT';
      adminName?: string;
    };

    if (!transactionId || !action) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'transactionId and action (APPROVE/REJECT) are required',
      }, { status: 400 });
    }

    const botToken     = DEFAULT_BOT_TOKEN;
    const adminIds     = getAdminWhitelist();
    const targetAdmins = adminIds.length > 0 ? adminIds : ['570615212', '7829104'];
    const now          = formatEthTime(new Date());

    // ── APPROVE ──────────────────────────────────────────────────────────────
    if (action === 'APPROVE') {
      const tx = await db.approvePendingDeposit(transactionId, adminName);
      if (!tx) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Deposit transaction not found or already processed',
        }, { status: 404 });
      }

      // Notify admins
      const adminMsg =
        `✅ <b>DEPOSIT APPROVED</b>\n\n` +
        `📋 <b>Tx ID:</b> <code>${tx.id}</code>\n` +
        `👤 <b>Player:</b> @${tx.username}\n` +
        `💰 <b>Amount:</b> <b>${tx.amount} ETB</b>\n` +
        `💳 <b>Provider:</b> ${tx.paymentProvider}\n` +
        `🔖 <b>Reference:</b> <code>${tx.reference ?? 'N/A'}</code>\n` +
        `👮 <b>Approved by:</b> ${adminName ?? 'admin'}\n` +
        `⏰ <b>At:</b> ${now}`;

      Promise.allSettled(
        targetAdmins.map((id) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: id, text: adminMsg, parse_mode: 'HTML' }),
          })
        )
      ).catch(() => {});

      // Notify player
      const user = await db.getUserById(tx.userId).catch(() => null);
      if (user?.telegramId && !user.telegramId.startsWith('web_')) {
        const playerMsg =
          `✅ <b>Deposit Approved!</b>\n\n` +
          `Your deposit of <b>${tx.amount} ETB</b> via <b>${tx.paymentProvider}</b> has been verified and credited to your Hyper Bingo wallet.\n\n` +
          `🎉 Enjoy your game!`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegramId, text: playerMsg, parse_mode: 'HTML' }),
        }).catch(() => {});
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: tx,
        message: `Deposit of ${tx.amount} ETB approved and credited successfully.`,
      });
    }

    // ── REJECT ───────────────────────────────────────────────────────────────
    if (action === 'REJECT') {
      const tx = await db.rejectPendingDeposit(transactionId);
      if (!tx) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Deposit transaction not found',
        }, { status: 404 });
      }

      // Notify admins
      const adminMsg =
        `❌ <b>DEPOSIT REJECTED</b>\n\n` +
        `📋 <b>Tx ID:</b> <code>${tx.id}</code>\n` +
        `👤 <b>Player:</b> @${tx.username}\n` +
        `💰 <b>Amount:</b> ${tx.amount} ETB\n` +
        `🔖 <b>Reference:</b> <code>${tx.reference ?? 'N/A'}</code>\n` +
        `👮 <b>Rejected by:</b> ${adminName ?? 'admin'}\n` +
        `⏰ <b>At:</b> ${now}`;

      Promise.allSettled(
        targetAdmins.map((id) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: id, text: adminMsg, parse_mode: 'HTML' }),
          })
        )
      ).catch(() => {});

      // Notify player
      const user = await db.getUserById(tx.userId).catch(() => null);
      if (user?.telegramId && !user.telegramId.startsWith('web_')) {
        const playerMsg =
          `❌ <b>Deposit Request Rejected</b>\n\n` +
          `Your deposit of <b>${tx.amount} ETB</b> via <b>${tx.paymentProvider}</b> could not be verified.\n\n` +
          `Please contact support with your transaction reference <code>${tx.reference ?? 'N/A'}</code> if you believe this is an error.`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegramId, text: playerMsg, parse_mode: 'HTML' }),
        }).catch(() => {});
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: tx,
        message: 'Deposit rejected.',
      });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Invalid action. Must be APPROVE or REJECT.',
    }, { status: 400 });

  } catch (err: unknown) {
    console.error('Error processing deposit action:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
