import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';
import { db } from '@/lib/db';

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

    // ── Check for active admin announcement ────────────────────────────────────
    const activeAnnouncement = await db.getActiveAnnouncement().catch(() => null);
    const announcementHeader = activeAnnouncement?.text
      ? `📢 <b>ማስታወቂያ / ANNOUNCEMENT:</b>\n${activeAnnouncement.text}\n━━━━━━━━━━━━━━━━━━━━━\n\n`
      : '';

    // ── Game list for welcome messages ─────────────────────────────────────────
    const gameListText =
      `🎮 <b>Available Games / የተዘጋጁ ጨዋታዎች:</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Hyper Fetan</b> (ሃይፐር ፈጣን)\n` +
      `   └ 5, 10, 30, 50 ETB · 1 ደቂቃ ዙር · 500 ካርዶች\n` +
      `   └ አሸናፊ ሕግ: 1 መስመር ወይም 4 ማዕዘናት\n\n` +
      `🎲 <b>Hyper Special</b> (ሃይፐር ስፔሻል)\n` +
      `   └ 10, 20, 30 ETB · ቀጥታ ክፍል\n` +
      `   └ ልዩ ሕግ ዙር በዙር ይለዋወጣል\n\n` +
      `🌟 <b>Hyper Weekend</b> (ሃይፐር ዊክኤንድ)\n` +
      `   └ 30, 50, 100 ETB · 30,000–100,000 ETB ጃክፖት\n` +
      `   └ አሸናፊ ሕግ: ሙሉ ቤት (Full House) ብቻ\n` +
      `   └ ዕለቶች: አርብ · ቅዳሜ · እሑድ 2:00, 5:00 & 7:00 PM\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎁 <i>አካውንት ሲፈጥሩ 20 ETB ቦነስ ወዲያው ይጨምርልዎታል! (ለጨዋታ ብቻ)</i>`;

    // ── Persistent bottom keyboard (ReplyKeyboardMarkup) ───────────────────────
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
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: 'Tap a game button above ⬆️',
    });

    // ── my_chat_member — fires the INSTANT a user starts / unblocks the bot ───
    if (update.my_chat_member) {
      const member = update.my_chat_member;
      const chatId = member.chat?.id;
      const userId = member.from?.id;
      const newStatus = member.new_chat_member?.status;

      if (chatId && (newStatus === 'member' || newStatus === 'administrator')) {
        const isAdmin = isAdminTelegramId(userId);
        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            `${announcementHeader}🎮 <b>Hyper Bingo Ethiopia</b>\n` +
            `#1 Live 75-Ball Bingo · Telebirr &amp; CBE Birr\n` +
            `80% Prize Pool · 20% House\n\n` +
            `${gameListText}\n\n` +
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
            `<b>Admin Commands:</b>\n` +
            `🛡️ Use the Admin button in the keyboard below\n` +
            `📢 /post [message] — Broadcast a message to all users\n` +
            `🗑️ /clear — Clear the active announcement\n` +
            `📋 /games — Show all available games`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /post [message] — Admin posts a message visible to everyone ───────────
      if (text && text.startsWith('/post')) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⛔ <b>Access Restricted</b>\nOnly admins can use /post.`,
            reply_markup: buildPersistentKeyboard(false),
          });
          return NextResponse.json({ ok: true });
        }

        const postContent = text.replace('/post', '').trim();
        if (!postContent) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text:
              `📢 <b>How to use /post:</b>\n\n` +
              `<code>/post Your announcement message here</code>\n\n` +
              `<i>This will be saved as an active announcement and shown to all users who open the bot or the mini app.</i>`,
            reply_markup: buildPersistentKeyboard(true),
          });
          return NextResponse.json({ ok: true });
        }

        // Save announcement to DB
        try {
          await db.saveAnnouncement(postContent, 'Admin Broadcast', 'BROADCAST');
        } catch (e) {
          console.error('Failed to save announcement:', e);
        }

        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            `✅ <b>Announcement Posted!</b>\n\n` +
            `📢 <b>Your message:</b>\n${postContent}\n\n` +
            `<i>This announcement is now visible to all users who open the bot or mini app. Use /clear to remove it.</i>`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /clear — Admin clears the active announcement ─────────────────────────
      if (text && text.startsWith('/clear')) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⛔ <b>Access Restricted</b>\nOnly admins can use /clear.`,
            reply_markup: buildPersistentKeyboard(false),
          });
          return NextResponse.json({ ok: true });
        }

        try {
          const current = await db.getActiveAnnouncement();
          if (current) {
            await db.clearActiveAnnouncement(current.id);
          }
        } catch (e) {
          console.error('Failed to clear announcement:', e);
        }

        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `✅ <b>Announcement cleared!</b>\nUsers will no longer see the announcement banner.`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /games — Show list of all available games ──────────────────────────────
      if (text && (text.startsWith('/games') || text.startsWith('/play') || text.startsWith('/menu'))) {
        await sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            `${announcementHeader}${gameListText}\n\n` +
            `<b>👇 Tap a game button below to start playing!</b>`,
          reply_markup: buildPersistentKeyboard(isAdmin),
        });
        return NextResponse.json({ ok: true });
      }

      // ── /start, /help — OR any first message ─────────────────────────────────
      const welcomeText =
        `${announcementHeader}🎮 <b>Hyper Bingo Ethiopia</b>\n` +
        `#1 Live 75-Ball Bingo · Telebirr &amp; CBE Birr\n` +
        `80% Prize Pool · 20% House${isAdmin ? ` · <i>Admin ✅</i>` : ''}\n\n` +
        `${gameListText}\n\n` +
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
