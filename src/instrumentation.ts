/**
 * Next.js Instrumentation Hook
 * Runs once when the server first starts (production cold start OR dev start).
 * We use it to auto-register the Telegram webhook so the bot always works,
 * even after Vercel re-deploys or spins up a new instance.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Skip in local dev unless you explicitly set REGISTER_WEBHOOK=true
  if (process.env.NODE_ENV !== 'production' && process.env.REGISTER_WEBHOOK !== 'true') return;

  const BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN ||
    '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://bingo-game-rho-five.vercel.app';

  const WEBHOOK_URL = `${APP_URL}/api/telegram/webhook`;

  try {
    // 1. Check current webhook registration
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const info = await infoRes.json();
    const currentUrl: string = info?.result?.url || '';

    if (currentUrl === WEBHOOK_URL) {
      console.log('[Telegram] ✅ Webhook already registered:', WEBHOOK_URL);
      return;
    }

    // 2. Register the correct webhook URL
    console.log('[Telegram] 🔄 Registering webhook:', WEBHOOK_URL);
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
    const setResult = await setRes.json();

    if (setResult.ok) {
      console.log('[Telegram] ✅ Webhook registered successfully:', WEBHOOK_URL);
    } else {
      console.error('[Telegram] ❌ Webhook registration failed:', JSON.stringify(setResult));
    }

    // 3. Also configure the bot's commands menu (idempotent)
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
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
    }).catch(() => {});

  } catch (err) {
    // Non-fatal: log and continue — app still works, webhook might already be set
    console.error('[Telegram] ⚠️ Webhook setup error (non-fatal):', err);
  }
}
