import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const body = await req.json();
    const { adminTelegramId, weekendGames, chatId } = body;

    // Verify caller is admin
    if (!isAdminTelegramId(adminTelegramId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!weekendGames || weekendGames.length === 0) {
      return NextResponse.json({ error: 'No weekend games provided' }, { status: 400 });
    }

    // Build the announcement message
    const gameLines = weekendGames
      .map((g: any, i: number) =>
        `${i + 1}. 🌟 <b>${g.name}</b>\n` +
        `   💵 Entry: <b>${g.entryPrice} ETB</b> | 🏆 Prize Pool: <b>${g.prizePool.toLocaleString()} ETB</b>\n` +
        `   👥 Players: <b>${g.currentPlayers}/${g.maxPlayers}</b> | ⏱ Draw every ${g.drawInterval}s`
      )
      .join('\n\n');

    const announcementText =
      `🎉🌟 <b>WEEKEND HYPER BINGO — Special Lottery Games!</b> 🌟🎉\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🇪🇹 <b>የሳምንቱ መጨረሻ ልዩ ቢንጎ ጨዋታዎች!</b>\n\n` +
      `${gameLines}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Win big ETB prizes this weekend!</b>\n` +
      `📲 Open the app and join now — seats fill up fast!\n\n` +
      `💰 ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር\n` +
      `🔥 100% ደህንነቱ የተጠበቀ ጨዋታ`;

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
      return NextResponse.json(
        { error: result.description || 'Telegram API error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Weekend game announcement sent successfully!',
      telegramResult: result,
    });
  } catch (error: any) {
    console.error('Announce weekend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
