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
          `• በቴሌብር እና በሲቢኢ ብር ፈጣን ገቢና ወጪ (Instant Telebirr & CBE)\n` +
          `• 80% የሽልማት ገንዳ ለአሸናፊዎች · 20% የቤት ድርሻ\n` +
          `• የቀጥታ እይታ ሞድ (Spectator Mode) — ያለ ካርድም ጨዋታውን በቀጥታ መመልከት ይችላሉ!\n\n` +
          `🎮 <b>ዋና ዋና የጨዋታ ዝርዝሮች (Main Game List):</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <b>ሃይፐር ፈጣን (Hyper Fetan - 1 Min / 500 Cards):</b>\n` +
          `  • ⚡ Fetan 5 ETB  ·  ⚡ Fetan 10 ETB\n` +
          `  • ⚡ Fetan 30 ETB ·  ⚡ Fetan 50 ETB\n\n` +
          `🎲 <b>ሃይፐር ስፔሻል (Hyper Special - Live Room):</b>\n` +
          `  • 🎲 Special 10 ETB · 🎲 Special 20 ETB\n` +
          `  • 🎯 Special 50 ETB · 💎 Special 100 ETB\n\n` +
          `🌟 <b>ሃይፐር ዊክኤንድ (Hyper Weekend - Mega Jackpots):</b>\n` +
          `  • 🌟 Hyper Weekend 30 (🏆 30,000 ETB Pool)\n` +
          `  • 🌟 Hyper Weekend 50 (🏆 50,000 ETB Pool)\n` +
          `  • 👑 Hyper Weekend 100 (🏆 100,000 ETB Mega Pool)\n` +
          `  ⏰ ድራው ሰዓት፡ <b>2:00 PM, 5:00 PM &amp; 7:00 PM (ዓርብ–እሑድ)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👇 <b>ከታች ከዝርዝሩ አንዱን ይጫኑ — ቀጥታ ወደ ጨዋታው ይወስድዎታል!</b>\n` +
          `(Tap any game below to open and join directly:)` +
          (isAdmin ? `\n\n⭐ <b>(Admin Access Granted / የአስተዳዳሪ መዳረሻ ተሰጥቶዎታል)</b>` : '');

        const keyboardButtons: any[] = [
          [
            {
              text: '⚡ Hyper Fetan 5 (5 ETB)',
              web_app: { url: `${appUrl}?game=gm_fetan_05` },
            },
            {
              text: '⚡ Hyper Fetan 10 (10 ETB)',
              web_app: { url: `${appUrl}?game=gm_fetan_10` },
            },
          ],
          [
            {
              text: '⚡ Hyper Fetan 30 (30 ETB)',
              web_app: { url: `${appUrl}?game=gm_fetan_30` },
            },
            {
              text: '⚡ Hyper Fetan 50 (50 ETB)',
              web_app: { url: `${appUrl}?game=gm_fetan_50` },
            },
          ],
          [
            {
              text: '🎲 Special 10 ETB',
              web_app: { url: `${appUrl}?game=gm_special_10` },
            },
            {
              text: '🎲 Special 20 ETB',
              web_app: { url: `${appUrl}?game=gm_special_20` },
            },
          ],
          [
            {
              text: '🎯 Special 50 ETB',
              web_app: { url: `${appUrl}?game=gm_special_50` },
            },
            {
              text: '💎 Special 100 ETB',
              web_app: { url: `${appUrl}?game=gm_special_100` },
            },
          ],
          [
            {
              text: '🌟 Hyper Weekend 30 (30k Pool)',
              web_app: { url: `${appUrl}?game=gm_weekend_30` },
            },
            {
              text: '🌟 Hyper Weekend 50 (50k Pool)',
              web_app: { url: `${appUrl}?game=gm_weekend_50` },
            },
          ],
          [
            {
              text: '👑 Hyper Weekend 100 (100k Jackpot)',
              web_app: { url: `${appUrl}?game=gm_weekend_100` },
            },
          ],
          [
            {
              text: '🎮 Open Hyper Bingo Lobby (ዋና ሎቢ)',
              web_app: { url: `${appUrl}?tab=lobby` },
            },
            {
              text: '💳 Deposit / Wallet (ሒሳብ ሙላ)',
              web_app: { url: `${appUrl}?tab=wallet` },
            },
          ],
        ];

        // If sender is admin, add direct Admin button
        if (isAdmin) {
          keyboardButtons.push([
            {
              text: '🛡️ Open Admin Panel (የአስተዳዳሪ ፓነል)',
              web_app: { url: `${appUrl}?tab=admin` },
            },
          ]);
        }

        await sendTelegramMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: welcomeText,
          reply_markup: {
            inline_keyboard: keyboardButtons,
          },
        });

        return NextResponse.json({ ok: true });
      }

      // Default fallback — responds to ANY text that is not a command
      await sendTelegramMessage({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🤖 <b>Hyper Bingo Games / የሃይፐር ቢንጎ ጨዋታዎች</b>\n\n` +
              `ከታች ከዋና ጨዋታዎች መካከል አንዱን መርጠው በቀጥታ ወደ ጨዋታው ይግቡ፡\n` +
              `Tap any game below to jump straight to the room:\n\n` +
              `🌟 <b>Hyper Weekend Draws:</b> Fri–Sun | 2:00 PM, 5:00 PM &amp; 7:00 PM EAT\n` +
              `📞 Support: <a href="tel:+251911234567">+251 91 123 4567</a> | @HyperBingoSupport`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⚡ Hyper Fetan 10 (10 ETB)',
                web_app: { url: `${appUrl}?game=gm_fetan_10` },
              },
              {
                text: '🎲 Hyper Special 20 (20 ETB)',
                web_app: { url: `${appUrl}?game=gm_special_20` },
              },
            ],
            [
              {
                text: '🌟 Hyper Weekend 50 (50k Pool)',
                web_app: { url: `${appUrl}?game=gm_weekend_50` },
              },
              {
                text: '👑 Hyper Weekend 100 (100k Jackpot)',
                web_app: { url: `${appUrl}?game=gm_weekend_100` },
              },
            ],
            [
              {
                text: '🎮 Play Hyper Bingo (ሁሉንም ጨዋታዎች ክፈት)',
                web_app: { url: appUrl },
              },
            ],
            [
              {
                text: '💳 Deposit / Wallet (ሒሳብ ሙላ)',
                web_app: { url: `${appUrl}?tab=wallet` },
              },
              {
                text: '📞 Support (+251 91 123 4567)',
                url: 'tel:+251911234567',
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
