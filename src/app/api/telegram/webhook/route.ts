import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

// Keep the function alive for up to 30 seconds on Vercel
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const update = await req.json();

    if (update.message) {
      const { chat, from, text } = update.message;
      const chatId = chat.id;
      const userId = from?.id;
      const userName = from?.first_name || 'Player';
      const isAdmin = isAdminTelegramId(userId);

      const sendMessage = async (payload: any) => {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      };

      // ── Persistent bottom keyboard (ReplyKeyboardMarkup) ────────────────────
      // This keyboard pins itself permanently above the text input — no /start needed.
      // Players see these buttons the moment they open the bot.
      const buildPersistentKeyboard = (admin: boolean) => ({
        keyboard: [
          // Row 1 — Game buttons (each has a web_app to open directly)
          [
            { text: '⚡ Hyper Fetan', web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` } },
            { text: '🎲 Hyper Special', web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` } },
          ],
          // Row 2 — Weekend + Play
          [
            { text: '🌟 Hyper Weekend', web_app: { url: `${appUrl}?tab=lottery` } },
            { text: '🎮 Play Hyper Bingo', web_app: { url: appUrl } },
          ],
          // Row 3 — Wallet (+ Admin if applicable)
          admin
            ? [
                { text: '💳 Wallet', web_app: { url: `${appUrl}?tab=wallet` } },
                { text: '🛡️ Admin', web_app: { url: `${appUrl}?tab=admin` } },
              ]
            : [
                { text: '💳 Wallet', web_app: { url: `${appUrl}?tab=wallet` } },
              ],
        ],
        resize_keyboard: true,   // shrinks to fit buttons tightly
        is_persistent: true,     // ← KEY: stays pinned even when user doesn't interact
        input_field_placeholder: '🎮 Choose a game above or type a message…',
      });

      // ── /admin command ──────────────────────────────────────────────────────
      if (text && text.startsWith('/admin')) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⛔ <b>Access Restricted</b>\nYour Telegram ID <code>${userId}</code> is not an admin.\nContact the system owner to get access.`,
            reply_markup: buildPersistentKeyboard(false),
          });
          return NextResponse.json({ ok: true });
        }

        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            `👑 <b>Hyper Bingo Admin Center</b>\n` +
            `Welcome <b>${userName}</b>! ID: <code>${userId}</code>\n\n` +
            `Use the Admin button below or tap 🛡️ Admin in the keyboard.`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /start, /games, /play, /help, /menu ────────────────────────────────
      if (
        !text ||
        text.startsWith('/start') ||
        text.startsWith('/games') ||
        text.startsWith('/play') ||
        text.startsWith('/help') ||
        text.startsWith('/menu')
      ) {
        const welcomeText =
          `🎮 <b>Hyper Bingo Ethiopia</b>\n` +
          `#1 Live 75-Ball Bingo · Telebirr &amp; CBE Birr\n` +
          `80% Prize Pool · 20% House${isAdmin ? ` · <i>Admin ✅</i>` : ''}\n\n` +
          `<b>👇 Tap a game button below to start playing!</b>`;

        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: welcomeText,
          reply_markup: buildPersistentKeyboard(isAdmin),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /wallet command ─────────────────────────────────────────────────────
      if (text.startsWith('/wallet')) {
        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `💳 <b>Hyper Bingo Wallet</b>\nDeposit or check your balance:`,
          reply_markup: buildPersistentKeyboard(isAdmin),
        });
        return NextResponse.json({ ok: true });
      }

      // ── Default fallback — show the keyboard for any other text ────────────
      await sendMessage({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🎮 <b>Hyper Bingo</b> — Tap a game below to play! ⬇️`,
        reply_markup: buildPersistentKeyboard(isAdmin),
      });
    }

    // ── callback_query — always acknowledge ────────────────────────────────
    if (update.callback_query) {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: update.callback_query.id,
          text: '✅ Opening Hyper Bingo…',
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── GET — check or register webhook ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  if (action === 'set') {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const data = await res.json();
      return NextResponse.json({ action: 'setWebhook', webhookUrl, result: data });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json({ webhookUrl, webhookInfo: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
