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
      
      // If channel was not found or bot lacks rights, attempt direct delivery to admin
      if (adminTelegramId && targetChatId !== adminTelegramId) {
        try {
          const directRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminTelegramId,
              parse_mode: 'HTML',
              text: `📢 <b>[Admin Broadcast Preview / የሙከራ መልእክት]</b>\n\n${announcementText}\n\n━━━━━━━━━━━━━━━━━━━━━\nℹ️ <i>ማስታወሻ፡ ቻናሉ ${targetChatId} ስላልተገኘ መልእክቱ በቀጥታ ወደ እርስዎ ቴሌግራም ተልኳል። ቻናል ላይ ለማሰራጨት @HyperBingoBot ን በቻናልዎ ውስጥ አስተዳዳሪ (Admin) ያድርጉት።</i>`,
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
          const directData = await directRes.json();
          if (directData.ok) {
            return NextResponse.json({
              success: true,
              ok: true,
              message: `✅ Delivered directly to your Telegram chat (ID: ${adminTelegramId})!\n\nℹ️ Note for Channel: To broadcast publicly to ${targetChatId}, add @HyperBingoBot as Administrator of your channel.`,
            });
          }
        } catch {}
      }

      let userFriendlyMsg = String(rawError || '');
      if (/chat not found/i.test(userFriendlyMsg)) {
        userFriendlyMsg = [
          '❌ Bad Request: chat not found — HOW TO BROADCAST:',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '1. 🔐 To broadcast to a channel: Add @HyperBingoBot as ADMINISTRATOR of your channel.',
          '2. 💬 To test immediately: Select "My Telegram Chat" to receive the broadcast in your private chat.',
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
