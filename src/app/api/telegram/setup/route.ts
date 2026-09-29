/**
 * /api/telegram/setup
 *
 * POST  → Force-registers the Telegram webhook + sets bot commands.
 *          Called automatically by Vercel deploy hooks (see vercel.json).
 *          Also callable manually: POST /api/telegram/setup?secret=<WEBHOOK_SECRET>
 *
 * GET   → Returns current webhook status (no auth required for diagnostics).
 */
import { NextRequest, NextResponse } from 'next/server';

// Exported so Vercel keeps this as a long-running function (up to 60 s)
export const maxDuration = 30;

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://bingo-game-rho-five.vercel.app';

const WEBHOOK_URL = `${APP_URL}/api/telegram/webhook`;

// Optional secret to protect the POST endpoint
const SETUP_SECRET = process.env.WEBHOOK_SETUP_SECRET || 'hyper-bingo-setup-2025';

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const data = await res.json();
    return NextResponse.json({
      currentWebhookUrl: WEBHOOK_URL,
      telegramWebhookInfo: data,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Verify secret (from Vercel deploy hook header or query param)
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret') || req.headers.get('x-webhook-secret');
  if (secret !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Delete any stale webhook first
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`
    );

    // 2. Set fresh webhook
    const setRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query', 'inline_query'],
          drop_pending_updates: false,
          max_connections: 100,
        }),
      }
    );
    results.setWebhook = await setRes.json();

    // 3. Verify it stuck
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    results.webhookInfo = await infoRes.json();

    // 4. Set bot commands menu
    const cmdRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start',  description: '🎮 Start / ጀምር' },
            { command: 'games',  description: '📋 Game list / ጨዋታዎች' },
            { command: 'play',   description: '⚡ Play now / አሁን ጫወት' },
            { command: 'wallet', description: '💳 Wallet / ሒሳብ' },
            { command: 'admin',  description: '🛡️ Admin panel' },
            { command: 'help',   description: '❓ Help / እርዳታ' },
          ],
        }),
      }
    );
    results.setCommands = await cmdRes.json();

    // 5. Set bot description + name
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description:
          'ሃይፐር ቢንጎ — ኢትዮጵያ #1 ፈጣን 75-ቁጥር ቢንጎ 🎮\n' +
          'Hyper Bingo — Ethiopia\'s fastest live 75-ball Bingo.\n' +
          '• 80% Prize Pool · 20% House\n' +
          '• Telebirr & CBE Birr instant payments',
      }),
    }).catch(() => {});

    // 6. Set Chat Menu button to always open the Web App
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🎮 Play Hyper Bingo',
          web_app: { url: APP_URL },
        },
      }),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      webhookUrl: WEBHOOK_URL,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results }, { status: 500 });
  }
}
