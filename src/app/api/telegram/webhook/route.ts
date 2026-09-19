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

      // Handle /start or any greeting command
      if (text && (text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/play'))) {
        const welcomeText = 
          `🎉 <b>እንኳን ወደ ሃይፐር ቢንጎ በደህና መጡ!</b>\n` +
          `<b>Welcome to Hyper Bingo Ethiopia!</b>\n\n` +
          `🇪🇹 በኢትዮጵያ የመጀመሪያው ፈጣን የቀጥታ 75-ቁጥር ቢንጎ መድረክ!\n` +
          `• በቴሌብር እና በሲቢኢ ብር ፈጣን ገቢና ወጪ\n` +
          `• የቀጥታ ቁጥሮች እጣ እና አሸናፊዎችን እኩል ማካፈል\n` +
          `• 100% አስተማማኝ እና ፈጣን የጨዋታ አሰራር\n\n` +
          `⚡ Play real-time 75-ball bingo, win ETB prizes, and cash out instantly!\n\n` +
          `🌟 <b>Weekend Hyper Draw Schedule (ዊክኤንድ ጨዋታ ሰዓት):</b>\n` +
          `  📅 Friday – Sunday (ዓርብ – እሑድ)\n` +
          `  ⏰ Opens: <b>10:00 PM EAT (ማታ 4:00 ሰዓት)</b>\n\n` +
          `📞 <b>Customer Support / ደንበኞች አገልግሎት:</b>\n` +
          `  📱 Phone: <a href="tel:+251911234567">+251 91 123 4567</a>\n` +
          `  💬 Telegram: @HyperBingoSupport\n\n` +
          `የእርስዎ ቴሌግራም መለያ (Your Telegram ID): <code>${userId}</code>` +
          (isAdmin ? `\n⭐ <b>(Admin Access Granted / የአስተዳዳሪ መዳረሻ ተሰጥቶዎታል)</b>` : '');

        const keyboardButtons: any[] = [
          [
            {
              text: '🎮 Play Hyper Bingo (ሚኒ አፕ ክፈት)',
              web_app: { url: appUrl },
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

      // Default fallback
      await sendTelegramMessage({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🤖 <b>Hyper Bingo Bot</b>\n\nUse /start to open the game or /admin to access admin tools.\n\nጨዋታውን ለመጀመር /start ይጫኑ።\n\n` +
              `🌟 <b>Weekend Hyper Draw:</b> Fri–Sun | Opens 10:00 PM EAT (ማታ 4:00)\n` +
              `📞 Support: <a href="tel:+251911234567">+251 91 123 4567</a> | @HyperBingoSupport`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Play Hyper Bingo (ሚኒ አፕ ክፈት)',
                web_app: { url: appUrl },
              },
            ],
            [
              {
                text: '📞 Contact Support (+251 91 123 4567)',
                url: 'tel:+251911234567',
              },
            ],
          ],
        },
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
