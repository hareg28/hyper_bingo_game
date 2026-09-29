import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const update = await req.json();

    // Check if update contains a message
    if (update.message) {
      const { chat, from, text } = update.message;
      const chatId = chat.id;
      const userId = from?.id;
      const userName = from?.first_name || 'Player';
      const isAdmin = isAdminTelegramId(userId);

      const sendTelegramMessage = async (payload: any) => {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      };

      // Handle /admin command
      if (text && text.startsWith('/admin')) {
        if (!isAdmin) {
          await sendTelegramMessage({
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⛔ <b>Access Restricted / መዳረሻ ተከልክሏል</b>\n\n` +
                  `Your Telegram ID: <code>${userId}</code> is not registered as an administrator.\n` +
                  `ይህ የቴሌግራም መለያ የአስተዳዳሪ ፈቃድ የለውም።\n\n` +
                  `Contact system admin to add your ID: <code>${userId}</code> to the admin whitelist.`,
          });
          return NextResponse.json({ ok: true });
        }

        await sendTelegramMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `👑 <b>Hyper Bingo Admin Command Center</b>\n` +
                `የሃይፐር ቢንጎ አስተዳዳሪ ክፍል\n\n` +
                `👋 Welcome Admin <b>${userName}</b>!\n` +
                `• Telegram ID: <code>${userId}</code>\n` +
                `• Role: <b>Super Administrator (የስርዓት አስተዳዳሪ)</b>\n\n` +
                `You can manage games, force draw balls, review players, and approve Telebirr/CBE Birr withdrawals directly in Telegram below:`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛡️ Open Admin Panel (የአስተዳዳሪ ፓነል)',
                  web_app: { url: `${appUrl}?tab=admin` },
                },
              ],
              [
                {
                  text: '🎮 Play Hyper Bingo (ጨዋታውን ይክፈቱ)',
                  web_app: { url: appUrl },
                },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Handle /start, /games, /play, or any greeting command
      if (text && (text.startsWith('/start') || text.startsWith('/games') || text.startsWith('/help') || text.startsWith('/play') || text.startsWith('/menu'))) {
        const welcomeText =
          `🎉 <b>እንኳን ወደ ሃይፐር ቢንጎ በደህና መጡ!</b>\n` +
          `<b>Welcome to Hyper Bingo Ethiopia!</b>\n\n` +
          `🇪🇹 በኢትዮጵያ #1 ፈጣን የቀጥታ 75-ቁጥር ቢንጎ መድረክ!\n` +
          `• 80% ሽልማት · 20% ቤት ድርሻ (80% Prize · 20% House)\n` +
          `• ቴሌብር እና ሲቢኢ ብር (Telebirr &amp; CBE Birr)\n\n` +
          `👇 <b>ጨዋታ ይምረጡ / Choose a Game:</b>` +
          (isAdmin ? `\n⭐ <i>(Admin Access Verified)</i>` : '');

        const keyboardButtons: any[] = [
          [
            {
              text: '⚡ ሃይፐር ፈጣን (10 ETB)',
              web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` },
            },
          ],
          [
            {
              text: '🎲 ሃይፐር ስፔሻል (20 ETB)',
              web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` },
            },
          ],
          [
            {
              text: '🌟 ሃይፐር ዊክኤንድ ሎተሪ',
              web_app: { url: `${appUrl}?tab=lottery` },
            },
          ],
          [
            {
              text: '🎮 ዋና ሎቢ (Main Lobby)',
              web_app: { url: appUrl },
            },
            {
              text: '💳 ሒሳብ (Wallet)',
              web_app: { url: `${appUrl}?tab=wallet` },
            },
          ],
        ];

        if (isAdmin) {
          keyboardButtons.push([
            {
              text: '🛡️ Admin Panel (አስተዳዳሪ ፓነል)',
              web_app: { url: `${appUrl}?tab=admin` },
            },
          ]);
        }

        await sendTelegramMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: welcomeText,
          reply_markup: { inline_keyboard: keyboardButtons },
        });

        return NextResponse.json({ ok: true });
      }

      // Handle /wallet command
      if (text && text.startsWith('/wallet')) {
        await sendTelegramMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `💳 <b>Hyper Bingo Wallet / ሒሳብ</b>\n\nDeposit or check your balance below:`,
          reply_markup: {
            inline_keyboard: [[
              { text: '💳 Open Wallet (ሒሳብ ክፈት)', web_app: { url: `${appUrl}?tab=wallet` } },
            ]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Default fallback — any other text shows the game list
      await sendTelegramMessage({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🎮 <b>Hyper Bingo / ሃይፐር ቢንጎ</b>\n\nጨዋታ ይምረጡ — Choose a game to play:`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⚡ Hyper Fetan (10 ETB)',
                web_app: { url: `${appUrl}?tab=lobby&cat=FETAN` },
              },
              {
                text: '🎲 Hyper Special (20 ETB)',
                web_app: { url: `${appUrl}?tab=lobby&cat=SPECIAL` },
              },
            ],
            [
              {
                text: '🌟 Hyper Weekend Lottery',
                web_app: { url: `${appUrl}?tab=lottery` },
              },
              {
                text: '🎮 Main Lobby',
                web_app: { url: appUrl },
              },
            ],
            [
              {
                text: '💳 Wallet (ሒሳብ ሙላ)',
                web_app: { url: `${appUrl}?tab=wallet` },
              },
            ],
          ],
        },
      });
    }

    // Handle callback_query (inline keyboard button presses) — always acknowledge
    if (update.callback_query) {
      const cbQuery = update.callback_query;
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cbQuery.id, text: '✅ Opening Hyper Bingo...' }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET handler to query or register Telegram Webhook URL
export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  if (action === 'set') {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return NextResponse.json({ action: 'setWebhook', webhookUrl, result: data });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Otherwise return current webhook status
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json({ webhookUrl, webhookInfo: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
