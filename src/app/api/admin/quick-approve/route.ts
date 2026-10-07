import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

function htmlPage(title: string, icon: string, header: string, message: string, detailsHtml: string, isSuccess: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid ${isSuccess ? '#10b981' : '#f43f5e'};
      border-radius: 1.25rem;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      color: ${isSuccess ? '#34d399' : '#fb7185'};
      margin-bottom: 0.5rem;
    }
    p {
      color: #cbd5e1;
      font-size: 0.95rem;
      margin-bottom: 1.25rem;
      line-height: 1.4;
    }
    .details {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1rem;
      text-align: left;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
      font-family: monospace;
      color: #e2e8f0;
    }
    .details div {
      margin-bottom: 0.4rem;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 0.85rem;
      background: #f59e0b;
      color: #0f172a;
      text-decoration: none;
      font-weight: 800;
      font-size: 0.95rem;
      border-radius: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: background 0.2s;
    }
    .btn:hover { background: #d97706; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${header}</h1>
    <p>${message}</p>
    ${detailsHtml ? `<div class="details">${detailsHtml}</div>` : ''}
    <a href="/?tab=admin" class="btn">🛡️ Open Admin Panel</a>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'approve';
  const txId = searchParams.get('txId');

  if (!txId) {
    return new NextResponse(
      htmlPage('Error', '⚠️', 'Missing Transaction ID', 'No transaction ID was provided.', '', false),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    if (action === 'approve') {
      const approvedTx = await db.approvePendingDeposit(txId, 'Telegram-1Click');
      if (!approvedTx) {
        return new NextResponse(
          htmlPage('Already Processed', 'ℹ️', 'Deposit Already Handled', 'This deposit has already been approved, rejected, or does not exist.', '', true),
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Notify player on Telegram if their ID is known
      try {
        const player = await db.getUserById(approvedTx.userId);
        if (player?.telegramId && !player.telegramId.startsWith('web_')) {
          await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: player.telegramId,
              parse_mode: 'HTML',
              text:
                `🎉 <b>DEPOSIT CONFIRMED &amp; CREDITED!</b>\n\n` +
                `💰 Amount: <b>+${approvedTx.amount} ETB</b>\n` +
                `💳 Provider: <b>${approvedTx.provider || 'Telebirr'}</b>\n` +
                `🔖 Reference: <code>${approvedTx.reference}</code>\n\n` +
                `✨ Your wallet balance has been credited. Good luck playing Hyper Bingo!`,
            }),
          });
        }
      } catch (notifyErr) {
        console.error('Failed to notify player:', notifyErr);
      }

      const details = `
        <div><strong>Tx ID:</strong> ${approvedTx.id}</div>
        <div><strong>Amount:</strong> +${approvedTx.amount} ETB</div>
        <div><strong>Player ID:</strong> ${approvedTx.userId}</div>
        <div><strong>Reference:</strong> ${approvedTx.reference}</div>
        <div><strong>Status:</strong> COMPLETED</div>
      `;

      return new NextResponse(
        htmlPage('Deposit Approved', '✅', 'Deposit Approved & Credited!', `Wallet of player successfully credited with ${approvedTx.amount} ETB.`, details, true),
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    } else {
      // Reject
      await db.rejectPendingDeposit(txId);
      return new NextResponse(
        htmlPage('Deposit Rejected', '❌', 'Deposit Request Rejected', `Transaction ${txId} has been rejected.`, '', false),
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  } catch (err: any) {
    return new NextResponse(
      htmlPage('Error', '⚠️', 'Error Processing Request', err?.message || 'Server error occurred.', '', false),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
