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

      // Build the announcement message
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

    // Send to the provided chatId (can be a group, channel, or individual)
    const targetChatId = chatId || adminTelegramId;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        parse_mode: 'HTML',
        text: announcementText,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Join Weekend Games Now!',
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      const rawError = result.description || 'Telegram API error';
      let userFriendlyMsg = String(rawError || '');

      // Diagnose common failures and give actionable advice to admin
      if (/chat not found/i.test(userFriendlyMsg)) {
        userFriendlyMsg = [
          '❌ Bad Request: chat not found — HOW TO FIX THIS:',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '1. 🔐 Add @HyperBingoBot as ADMINISTRATOR of the channel first: @HyperBingoChannel',
          '   (BotFather → /mybots → HyperBingoBot → Bot Settings → Administrators)',
          '   OR click: "Add Bot to Channel / Add to Group"',
          '',
          '2. 🆔 Channel private channels need NUMERIC chat_id format like: -1001234567890',
          '   Paste above field "Target Chat ID" instead of @username',
          '',
          '3. ✅ Click "Send Test to Me" to prove bot is working before broadcasting',
          '',
          '4. Debug: https://api.telegram.org/bot<TOKEN>/getChat?chat_id=@HyperBingoChannel',
          '   ← if this returns ok=false the bot is NOT added or username is incorrect',
          '',
          'Raw error: ' + rawError,
        ].join('\n');
      } else if (/not enough rights|bot was kicked|forbidden/i.test(userFriendlyMsg)) {
        userFriendlyMsg = '🚫 Bot KICKED/NO RIGHTS: Add HyperBingoBot is not admin of @HyperBingoChannel — promote @HyperBingoBot to admin role with Post permission on the channel\n' + 'Original error: ' + rawError;
      } else if (/message is not modified|can't parse/i.test(userFriendlyMsg)) {
        userFriendlyMsg = '⚠️ ' + userFriendlyMsg + ' — text empty try shorter message or try again';
      }

      return NextResponse.json(
        {
          error: userFriendlyMsg,
          ok: false,
          telegramRaw: result,
          tip: 'Try chat_id = numeric format -1001234567890 instead of @username',
        },
        { status: 200 } // 200 so admin's UI shows detailed messages (better DX)
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
