import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';
import { db } from '@/lib/db';
import { getNeonSql } from '@/lib/neon';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

function safeTgHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;');
}

// Keep the function alive for up to 30 seconds on Vercel
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'BingoBirrBot';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const update = await req.json();

    // ── Helper to send a Telegram message ──────────────────────────────────────
    const sendMessage = async (payload: any) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return await res.json();
      } catch (e) {
        console.error('sendMessage error:', e);
      }
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

    // Channel-safe inline keyboard (Uses URL buttons so Telegram channels NEVER reject it)
    const channelInlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🎮 Play Hyper Bingo / አሁኑኑ ይጫወቱ', url: `https://t.me/${botUsername}?start=play` }
        ],
      ],
    };

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
      const { chat, from, text, photo, document, caption } = update.message;
      const chatId = chat.id;
      const userId = from?.id;
      const userName = from?.first_name || 'Player';
      const userInDb = userId ? await db.getUserByTelegramId(String(userId)).catch(() => null) : null;
      let isAdmin = isAdminTelegramId(userId) || isAdminTelegramId(from?.username) || userInDb?.role === 'admin';

      // ── Handle /admin command or admin authorization code ─────────────────────────
      if (text && text.startsWith('/admin')) {
        const adminArg = text.replace('/admin', '').trim().toLowerCase();
        if (adminArg === 'hyperadmin' || adminArg === 'bingo2025' || adminArg === 'admin' || adminArg === 'hyperbingo') {
          isAdmin = true;
          if (userId) {
            try {
              const sql = getNeonSql();
              if (sql) {
                await sql`UPDATE users SET role = 'admin' WHERE telegram_id = ${String(userId)}`;
              }
            } catch (err) {
              console.error('Failed to update admin role in DB:', err);
            }
          }
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `👑 <b>Admin Privileges Activated!</b>\nYour Telegram ID <code>${userId}</code> is now recognized as an Administrator.`,
            reply_markup: buildPersistentKeyboard(true),
          });
        }

        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text:
              `⛔ <b>Admin Access Required</b>\n` +
              `Your Telegram ID is <code>${userId}</code>.\n\n` +
              `<i>To activate admin mode, send:</i> <code>/admin hyperadmin</code>\n` +
              `<i>Or add your ID to ADMIN_TELEGRAM_IDS in your configuration.</i>`,
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
            `<b>Admin Capabilities:</b>\n` +
            `📸 <b>Send any Photo:</b> Send a photo with an optional caption to broadcast an image!\n` +
            `📄 <b>Send any Document:</b> Send a PDF or document to broadcast files to players!\n` +
            `📢 <b>/post [text]</b> — Broadcast a text announcement\n` +
            `🗑️ <b>/clear</b> — Clear the active announcement\n` +
            `📋 <b>/games</b> — Show all available games\n` +
            `🛡️ <b>Admin Panel:</b> Tap the Admin button in the keyboard below`,
          reply_markup: buildPersistentKeyboard(true),
        });
        return NextResponse.json({ ok: true });
      }

      // ── Handle Photo Broadcast from Admin ────────────────────────────────────────
      if (photo && Array.isArray(photo) && photo.length > 0) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text:
              `ℹ️ <b>Hyper Bingo Bot</b>\n` +
              `Only administrators can broadcast pictures or flyers.\n` +
              `<i>If you are an admin, send <code>/admin hyperadmin</code> first.</i>`,
            reply_markup: buildPersistentKeyboard(false),
          });
          return NextResponse.json({ ok: true });
        }

        const highestPhoto = photo[photo.length - 1];
        const fileId = highestPhoto.file_id;
        const proxyUrl = `${appUrl}/api/telegram/media?file_id=${fileId}`;
        const rawCaption = caption ? caption.trim() : '📸 New Picture Announcement';
        const safeCaption = safeTgHtml(rawCaption);
        const captionTruncated = safeCaption.length > 1000 ? safeCaption.slice(0, 995) + '...' : safeCaption;

        // Save to DB so all mini app and web app users see this photo announcement!
        try {
          await db.saveAnnouncement(
            safeCaption,
            'Admin Photo Broadcast',
            'BROADCAST',
            proxyUrl,
            'photo'
          );
        } catch (e) {
          console.error('Failed to save photo announcement:', e);
        }

        // Broadcast to channel if configured (using channel-safe URL keyboard)
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: '@HyperBingoChannel',
              photo: fileId,
              caption: `📢 <b>ANNOUNCEMENT / ማስታወቂያ:</b>\n\n${captionTruncated}`,
              parse_mode: 'HTML',
              reply_markup: channelInlineKeyboard,
            }),
          });
        } catch (err) {
          console.error('Channel sendPhoto failed:', err);
        }

        // Respond directly in chat with the actual photo and confirmation
        const replyRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: fileId,
            caption:
              `✅ <b>Picture Announcement Published!</b>\n\n` +
              `🖼️ <b>Media:</b> Photo successfully published\n` +
              (caption ? `📝 <b>Caption:</b>\n${captionTruncated}\n\n` : '\n') +
              `<i>✨ This picture announcement is now live for all users opening the bot or mini app! Use /clear to remove it.</i>`,
            parse_mode: 'HTML',
            reply_markup: buildPersistentKeyboard(true),
          }),
        });
        const replyData = await replyRes.json();
        if (!replyData.ok) {
          console.error('Confirmation sendPhoto failed:', replyData);
        }

        return NextResponse.json({ ok: true });
      }

      // ── Handle Document / PDF Broadcast from Admin ──────────────────────────────
      if (document) {
        if (!isAdmin) {
          await sendMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text:
              `ℹ️ <b>Hyper Bingo Bot</b>\n` +
              `Only administrators can broadcast documents.\n` +
              `<i>If you are an admin, send <code>/admin hyperadmin</code> first.</i>`,
            reply_markup: buildPersistentKeyboard(false),
          });
          return NextResponse.json({ ok: true });
        }

        const fileId = document.file_id;
        const fileName = document.file_name || 'document.pdf';
        const proxyUrl = `${appUrl}/api/telegram/media?file_id=${fileId}`;
        const rawCaption = caption ? caption.trim() : `📄 Document: ${fileName}`;
        const safeCaption = safeTgHtml(rawCaption);
        const captionTruncated = safeCaption.length > 1000 ? safeCaption.slice(0, 995) + '...' : safeCaption;

        // Save to DB so all users see this document announcement
        try {
          await db.saveAnnouncement(
            safeCaption,
            `Admin Document: ${fileName}`,
            'BROADCAST',
            proxyUrl,
            'document',
            fileName
          );
        } catch (e) {
          console.error('Failed to save document announcement:', e);
        }

        // Broadcast document to channel if configured
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: '@HyperBingoChannel',
              document: fileId,
              caption: `📢 <b>DOCUMENT / ማስታወቂያ:</b>\n\n${captionTruncated}`,
              parse_mode: 'HTML',
              reply_markup: channelInlineKeyboard,
            }),
          });
        } catch (err) {
          console.error('Channel sendDocument failed:', err);
        }

        // Respond directly in chat with the actual document and confirmation
        const replyDocRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            document: fileId,
            caption:
              `✅ <b>Document Announcement Published!</b>\n\n` +
              `📄 <b>File:</b> ${fileName}\n` +
              (caption ? `📝 <b>Caption:</b>\n${captionTruncated}\n\n` : '\n') +
              `<i>✨ This document announcement is now active for all players! Use /clear to remove it.</i>`,
            parse_mode: 'HTML',
            reply_markup: buildPersistentKeyboard(true),
          }),
        });
        const replyDocData = await replyDocRes.json();
        if (!replyDocData.ok) {
          console.error('Confirmation sendDocument failed:', replyDocData);
        }

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

        const postContent = safeTgHtml(text.replace('/post', '').trim());
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
            `${gameListText}\n\n` +
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
