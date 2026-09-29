import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const body = await req.json();
    const { adminTelegramId, weekendGames, chatId, customText } = body;

    // Verify caller is admin
    if (!isAdminTelegramId(adminTelegramId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let announcementText = '';
    if (customText && typeof customText === 'string' && customText.trim().length > 0) {
      announcementText = customText.trim();
    } else {
      if (!weekendGames || weekendGames.length === 0) {
        return NextResponse.json({ error: 'No announcement message or games provided' }, { status: 400 });
      }

      const gameLines = weekendGames
        .map((g: any, i: number) =>
          `${i + 1}. 🌟 <b>${g.name}</b>\n` +
          `   💵 Entry: <b>${g.entryPrice} ETB</b> | 🏆 Prize Pool: <b>${g.prizePool.toLocaleString()} ETB</b>\n` +
          `   👥 Players: <b>${g.currentPlayers}/${g.maxPlayers}</b> | ⏱ Draw every ${g.drawInterval}s`
        )
        .join('\n\n');

      announcementText =
        `🎉🌟 <b>WEEKEND HYPER BINGO — Special Lottery Games!</b> 🌟🎉\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🇪🇹 <b>የሳምንቱ መጨረሻ ልዩ ቢንጎ ጨዋታዎች!</b>\n` +
        `⏰ የጨዋታ ሰዓቶች፡ <b>2:00 PM | 5:00 PM | 7:00 PM</b>\n\n` +
        `${gameLines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ <b>Win big ETB prizes this weekend!</b>\n` +
        `📲 Open the app and join now — seats fill up fast!\n\n` +
        `💰 ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር\n` +
        `🔥 100% ደህንነቱ የተጠበቀ ጨዋታ`;
    }

    const targetChatId = chatId || adminTelegramId;

    // Inline keyboard: works in channels, groups, AND private chats
    const announcementKeyboard = {
      inline_keyboard: [
        [
          { text: '⚡ Hyper Fetan', web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` } },
          { text: '🎲 Hyper Special', web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` } },
        ],
        [
          { text: '🌟 Hyper Weekend', web_app: { url: `${appUrl}?tab=lottery` } },
          { text: '🎮 Play Hyper Bingo', web_app: { url: appUrl } },
        ],
      ],
    };

    // Persistent bottom keyboard: only works in private chats
    // Activates the permanent game list keyboard above the text input bar
    const persistentKeyboard = {
      keyboard: [
        [
          { text: '⚡ Hyper Fetan', web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` } },
          { text: '🎲 Hyper Special', web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` } },
          { text: '🌟 Hyper Weekend', web_app: { url: `${appUrl}?tab=lottery` } },
        ],
        [
          { text: '🎮 Play Hyper Bingo', web_app: { url: appUrl } },
          { text: '💳 Wallet', web_app: { url: `${appUrl}?tab=wallet` } },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: 'Tap a game button above ⬆️',
    };

    const sendMsg = async (payload: any) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    };

    // ── Step 1: Send the announcement with inline keyboard ───────────────────
    const result = await sendMsg({
      chat_id: targetChatId,
      parse_mode: 'HTML',
      text: announcementText,
      reply_markup: announcementKeyboard,
    });

    // ── Step 2: For private chats (id > 0), send a follow-up that activates ──
    // the persistent bottom keyboard. This makes game buttons appear at the
    // bottom of the chat without the user needing to send /start.
    const isPrivateChat = Number(targetChatId) > 0;
    if (isPrivateChat) {
      await sendMsg({
        chat_id: targetChatId,
        parse_mode: 'HTML',
        text: `👇 <b>ጨዋታ ይምረጡ — Tap a game to play now!</b>`,
        reply_markup: persistentKeyboard,
      });
    }

    // ── Step 3: Always also deliver to admin's private chat with keyboard ─────
    // (so admin always has the keyboard even if they sent to a channel)
    if (adminTelegramId && String(targetChatId) !== String(adminTelegramId)) {
      await sendMsg({
        chat_id: adminTelegramId,
        parse_mode: 'HTML',
        text: `📢 <b>[Broadcast Sent]</b>\n\n${announcementText}\n\n<i>Sent to: ${targetChatId}</i>`,
        reply_markup: announcementKeyboard,
      }).catch(() => {});

      // Also activate persistent keyboard for admin
      await sendMsg({
        chat_id: adminTelegramId,
        parse_mode: 'HTML',
        text: `👇 <b>Game list:</b>`,
        reply_markup: persistentKeyboard,
      }).catch(() => {});
    }

    if (!result.ok) {
      const rawError = result.description || 'Telegram API error';
      let userFriendlyMsg = String(rawError || '');
      if (/chat not found/i.test(userFriendlyMsg)) {
        userFriendlyMsg = [
          '❌ Chat not found — HOW TO BROADCAST:',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '1. To broadcast to a channel: Add @HyperBingoBot as ADMINISTRATOR.',
          '2. To test: Select "My Telegram Chat" to receive in your private chat.',
          '',
          'Raw error: ' + rawError,
        ].join('\n');
      }

      return NextResponse.json(
        {
          error: userFriendlyMsg,
          ok: false,
          telegramRaw: result,
          tip: 'Select "My Telegram Chat" or add @HyperBingoBot as Admin to your channel',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      message: '✅ Broadcast delivered to ' + targetChatId,
      telegramResult: result,
    });
  } catch (error: any) {
    console.error('Announce weekend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
