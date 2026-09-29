/**
 * /api/telegram/keepalive
 *
 * Called by Vercel Cron every 5 minutes.
 * Checks the Telegram webhook status and auto-re-registers if it's missing
 * or pointing to the wrong URL.
 *
 * This guarantees the bot works 24/7 regardless of:
 *  - Vercel cold starts
 *  - Accidental webhook deletion
 *  - Bot token rotation
 *  - URL changes
 */
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://bingo-game-rho-five.vercel.app';

const WEBHOOK_URL = `${APP_URL}/api/telegram/webhook`;

export async function GET(_req: NextRequest) {
  const log: string[] = [];
  const timestamp = new Date().toISOString();

  try {
    // 1. Check current webhook
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const info = await infoRes.json();
    const currentUrl: string = info?.result?.url || '';
    const pendingCount: number = info?.result?.pending_update_count || 0;
    const lastError: string = info?.result?.last_error_message || '';

    log.push(`[${timestamp}] Current webhook: "${currentUrl}"`);
    log.push(`[${timestamp}] Pending updates: ${pendingCount}`);

    if (lastError) {
      log.push(`[${timestamp}] ⚠️ Last error: ${lastError}`);
    }

    // 2. Re-register if URL is wrong or missing
    const needsRegistration = currentUrl !== WEBHOOK_URL;
    if (needsRegistration) {
      log.push(`[${timestamp}] 🔄 Webhook mismatch! Re-registering...`);

      const setRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            allowed_updates: ['message', 'callback_query', 'my_chat_member', 'inline_query'],
            drop_pending_updates: false,
            max_connections: 100,
          }),
        }
      );
      const setResult = await setRes.json();
      log.push(
        `[${timestamp}] setWebhook result: ${JSON.stringify(setResult)}`
      );
    } else {
      log.push(`[${timestamp}] ✅ Webhook OK — no action needed`);
    }

    // 3. Log everything for Vercel dashboard visibility
    console.log(log.join('\n'));

    return NextResponse.json({
      ok: true,
      timestamp,
      webhookUrl: WEBHOOK_URL,
      wasReregistered: needsRegistration,
      pendingUpdates: pendingCount,
      lastError: lastError || null,
      log,
    });
  } catch (err: any) {
    console.error('[Keepalive] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message, timestamp },
      { status: 500 }
    );
  }
}
