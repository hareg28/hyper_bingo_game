/**
 * Admin Withdrawal Management API
 *
 * GET  /api/admin/withdrawals         — list all PENDING withdrawal requests
 * POST /api/admin/withdrawals         — approve (→ disburse) or reject (→ refund)
 *
 * Approval flow:
 *   1. Admin calls POST { withdrawalId, action: 'APPROVE' }
 *   2. Backend calls db.approveWithdrawal() → marks COMPLETED in DB
 *   3. Backend calls disburse() → gateway sends money to player's account
 *   4. If disbursement fails, withdrawal is rolled back to FAILED and balance refunded
 *   5. Admin + player notified via Telegram
 *
 * Rejection flow:
 *   1. Admin calls POST { withdrawalId, action: 'REJECT', reason? }
 *   2. Backend calls db.rejectWithdrawal() → refunds reserved balance, marks FAILED
 *   3. Admin + player notified via Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { getAdminWhitelist } from '@/lib/authUtils';
import { disburse } from '@/lib/payments/disbursement';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

// ── GET — list pending withdrawals ─────────────────────────────────────────

export async function GET() {
  try {
    const pending = await db.getPendingWithdrawals();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: pending,
    });
  } catch (err) {
    console.error('[Admin/Withdrawals GET] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch pending withdrawals',
    }, { status: 500 });
  }
}

// ── POST — approve or reject a withdrawal ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { withdrawalId, action, reason, bankCode } = body as {
      withdrawalId: string;
      action: 'APPROVE' | 'REJECT';
      /** Optional rejection reason shown to the player */
      reason?: string;
      /** Bank code required for bank-transfer disbursements */
      bankCode?: string;
    };

    if (!withdrawalId || !action) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'withdrawalId and action (APPROVE | REJECT) are required',
      }, { status: 400 });
    }

    const botToken     = DEFAULT_BOT_TOKEN;
    const adminIds     = getAdminWhitelist();
    const targetAdmins = adminIds.length > 0 ? adminIds : ['570615212', '7829104'];

    // ── APPROVE ─────────────────────────────────────────────────────────────
    if (action === 'APPROVE') {
      // Mark the withdrawal as approved in DB first
      const wr = await db.approveWithdrawal(withdrawalId);
      if (!wr) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Withdrawal not found or already processed',
        }, { status: 404 });
      }

      // Disburse via payment gateway
      const disbursement = await disburse({
        withdrawalId: wr.id,
        accountName:  wr.accountName,
        accountNumber: wr.accountNumber,
        amount:       wr.amount,
        paymentMethod: wr.paymentMethod,
        bankCode,
      });

      if (!disbursement.success) {
        // Disbursement failed — roll back: refund balance and mark FAILED
        await db.rejectWithdrawal(withdrawalId).catch(() => {});
        console.error('[Admin/Withdrawals] Disbursement failed after approval — rolled back:', disbursement.message);

        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Withdrawal approved but disbursement failed: ${disbursement.message}. Balance has been refunded to the player. Please retry or process manually.`,
        }, { status: 502 });
      }

      // Notify admins + player
      const successMsg =
        `✅ <b>WITHDRAWAL DISBURSED!</b>\n\n` +
        `🔖 <b>Withdrawal ID:</b> <code>${wr.id}</code>\n` +
        `👤 <b>Player:</b> ${wr.username}\n` +
        `💰 <b>Amount:</b> ${wr.amount} ETB\n` +
        `💳 <b>Method:</b> ${wr.paymentMethod}\n` +
        `📞 <b>Account:</b> <code>${wr.accountNumber}</code>\n` +
        `🏦 <b>Gateway:</b> ${disbursement.gatewayUsed}\n` +
        `🔑 <b>Gateway TxID:</b> <code>${disbursement.gatewayTxId ?? 'N/A'}</code>\n` +
        `⏰ <b>Processed At:</b> ${new Date().toLocaleString()}`;

      Promise.allSettled(
        targetAdmins.map((id) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: id, text: successMsg, parse_mode: 'HTML' }),
          })
        )
      ).catch(() => {});

      // Also notify the player
      const user = await db.getUserById(wr.userId).catch(() => null);
      if (user?.telegramId && !user.telegramId.startsWith('web_')) {
        const playerMsg =
          `✅ <b>Withdrawal Approved!</b>\n\n` +
          `💸 <b>${wr.amount} ETB</b> has been sent to your <b>${wr.paymentMethod}</b> account (<code>${wr.accountNumber}</code>).\n` +
          `🔖 Reference: <code>${wr.id}</code>\n\n` +
          `Funds should arrive within minutes. Thank you for playing Hyper Bingo! 🎉`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegramId, text: playerMsg, parse_mode: 'HTML' }),
        }).catch(() => {});
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { withdrawal: wr, disbursement },
        message: `Withdrawal of ${wr.amount} ETB approved and disbursed via ${disbursement.gatewayUsed}.`,
      });
    }

    // ── REJECT ──────────────────────────────────────────────────────────────
    if (action === 'REJECT') {
      const wr = await db.rejectWithdrawal(withdrawalId);
      if (!wr) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Withdrawal not found or already processed',
        }, { status: 404 });
      }

      const rejectionReason = reason?.trim() || 'Request did not meet withdrawal requirements.';

      // Notify admins
      const rejectAdminMsg =
        `❌ <b>WITHDRAWAL REJECTED</b>\n\n` +
        `🔖 <b>Withdrawal ID:</b> <code>${wr.id}</code>\n` +
        `👤 <b>Player:</b> ${wr.username}\n` +
        `💰 <b>Amount:</b> ${wr.amount} ETB (refunded to wallet)\n` +
        `📝 <b>Reason:</b> ${rejectionReason}\n` +
        `⏰ <b>At:</b> ${new Date().toLocaleString()}`;

      Promise.allSettled(
        targetAdmins.map((id) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: id, text: rejectAdminMsg, parse_mode: 'HTML' }),
          })
        )
      ).catch(() => {});

      // Notify the player
      const user = await db.getUserById(wr.userId).catch(() => null);
      if (user?.telegramId && !user.telegramId.startsWith('web_')) {
        const playerMsg =
          `❌ <b>Withdrawal Request Rejected</b>\n\n` +
          `Your withdrawal request of <b>${wr.amount} ETB</b> was not approved.\n` +
          `📝 <b>Reason:</b> ${rejectionReason}\n\n` +
          `✅ Your <b>${wr.amount} ETB</b> has been refunded back to your Hyper Bingo wallet.\n` +
          `Please contact support if you have any questions.`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegramId, text: playerMsg, parse_mode: 'HTML' }),
        }).catch(() => {});
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { withdrawal: wr },
        message: `Withdrawal of ${wr.amount} ETB rejected. Balance has been refunded to the player's wallet.`,
      });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Invalid action. Must be APPROVE or REJECT.',
    }, { status: 400 });

  } catch (err) {
    console.error('[Admin/Withdrawals POST] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
