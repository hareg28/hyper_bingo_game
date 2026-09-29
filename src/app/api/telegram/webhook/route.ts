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

    // ── Helper to send a Telegram message ──────────────────────────────────────
    const sendMessage = async (payload: any) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    };

    // ── Persistent bottom keyboard (ReplyKeyboardMarkup) ───────────────────────
    // `is_persistent: true` pins the keyboard permanently above the input bar —
    // exactly like the "Play" button — no /start needed once the bot has sent it once.
    const buildPersistentKeyboard = (admin: boolean) => ({
      keyboard: [
        // Row 1 — Three game categories
        [
          { text: '⚡ Hyper Fetan', web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` } },
          { text: '🎲 Hyper Special', web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` } },
          { text: '🌟 Hyper Weekend', web_app: { url: `${appUrl}?tab=lottery` } },
        ],
        // Row 2 — Play + Wallet (+ Admin if applicable)
        admin
          ? [
              { text: '🎮 Play Hyper Bingo', web_app: { url: appUrl } },
              { text: '💳 Wallet', web_app: { url: `${appUrl}?tab=wallet` } },
              { text: '🛡️ Admin', web_app: { url: `${appUrl}?tab=admin` } },
            ]
          : [
              { text: '🎮 Play Hyper Bingo', web_app: { url: appUrl } },
              { text: '💳 Wallet', web_app: { url: `${appUrl}?tab=wallet` } },
            ],
      ],
      resize_keyboard: true,   // compact — no wasted vertical space
      is_persistent: true,     // stays pinned even when user isn't typing
      input_field_placeholder: 'Tap a game button above ⬆️',
    });

    // ── my_chat_member — fires the INSTANT a user starts / unblocks the bot ───
    // This is what makes the keyboard appear WITHOUT needing /start.
    // When Telegram delivers this event the user has already pressed "Start" in
    // the bot's welcome screen, so we immediately send the game keyboard.
    if (update.my_chat_member) {
      const member = update.my_chat_member;
      const chatId = member.chat?.id;
      const userId = member.from?.id;
      const newStatus = member.new_chat_member?.status;

      // Only handle private chats where the user just started the bot
      if (chatId && (newStatus === 'member' || newStatus === 'administrator')) {
        const isAdmin = isAdminTelegramId(userId);
        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            `🎮 <b>Hyper Bingo Ethiopia</b>\n` +
            `#1 Live 75-Ball Bingo · Telebirr &amp; CBE Birr\n` +
            `80% Prize Pool · 20% House\n\n` +
            `<b>👇 Tap any game to start playing instantly!</b>`,
          reply_markup: buildPersistentKeyboard(isAdmin),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ── Regular message updates ─────────────────────────────────────────────────
    if (update.message) {
      const { chat, from, text } = update.message;
      const chatId = chat.id;
      const userId = from?.id;
      const userName = from?.first_name || 'Player';
      const isAdmin = isAdminTelegramId(userId);

      // ── /admin command ────────────────────────────────────────────────────────
      if (text && text.startsWith('/admin')) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⛔ <b>Access Restricted</b>\nYour Telegram ID <code>${userId}</code> is not an admin.`,
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
            `Use the 🛡️ Admin button in the keyboard below.`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /start, /games, /play, /help, /menu — OR any first message ──────────
      // We show the keyboard on EVERY response so it's always activated
      const welcomeText =
        `🎮 <b>Hyper Bingo Ethiopia</b>\n` +
        `#1 Live 75-Ball Bingo · Telebirr &amp; CBE Birr\n` +
        `80% Prize Pool · 20% House${isAdmin ? ` · <i>Admin ✅</i>` : ''}\n\n` +
        `<b>👇 Tap a game to start playing!</b>`;

      await sendMessage({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: welcomeText,
        reply_markup: buildPersistentKeyboard(isAdmin),
      });
    }

    // ── callback_query — always acknowledge ─────────────────────────────────────
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

// ── GET — check or register webhook ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  if (action === 'set') {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            // Include my_chat_member so bot detects when users press Start
            allowed_updates: ['message', 'callback_query', 'my_chat_member', 'inline_query'],
            drop_pending_updates: false,
            max_connections: 100,
          }),
        }
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
