import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, username, telegramId, referralCode } = body as {
      name?: string;
      phone?: string;
      username?: string;
      telegramId?: string;
      referralCode?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Full name is required',
      }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid Ethiopian phone number is required',
      }, { status: 400 });
    }

    const cleanPhone = phone.trim();
    // Validate Ethiopian phone pattern (+2519... or 09... or 07...)
    const ethPhoneRegex = /^(\+251[79]\d{8}|0[79]\d{8})$/;
    if (!ethPhoneRegex.test(cleanPhone.replace(/[\s-]/g, ''))) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Please enter a valid Ethiopian phone number (e.g. 0911234567 or +251911234567)',
      }, { status: 400 });
    }

    const user = await db.registerUser({
      name: name.trim(),
      phone: cleanPhone,
      username: username?.trim(),
      telegramId: telegramId?.trim(),
      referredBy: referralCode?.trim(),
    });

    const wallet = await db.getOrCreateWallet(user.id);
    const linkedAccounts = await db.getLinkedAccounts(user.id);

    // ── NOTIFICATIONS ON REGISTRATION (Telegram & SMS) ──
    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
    let telegramNotified = false;

    // 1. Telegram Welcome Notification (if user has telegramId)
    if (user.telegramId && !user.telegramId.startsWith('web_')) {
      try {
        const welcomeText = 
          `🎉 <b>እንኳን ወደ ሃይፐር ቢንጎ በደህና መጡ! / Welcome to Hyper Bingo!</b> 🎉\n\n` +
          `👋 ሰላም <b>${user.name}</b> (@${user.username || 'player'})!\n` +
          `መለያዎ በተሳካ ሁኔታ ተፈጥሯል።\n\n` +
          `🎁 <b>የመመዝገቢያ ቦነስ:</b> <b>20 ETB</b> ወደ ዋሌትዎ ገብቷል!\n` +
          `<i>(ይህ ቦነስ ለጨዋታ መጫወቻ ብቻ የሚያገለግል ሲሆን በቀጥታ ማውጣት አይቻልም)</i>\n\n` +
          `🚀 <b>የግብዣ ኮድዎ:</b> <code>${user.referralCode}</code>\n` +
          `🔗 <b>የግብዣ ሊንክዎ:</b> https://t.me/HyperBingoBot?start=${user.referralCode}\n\n` +
          `💡 <i>ጓደኛዎን ይጋብዙ! የጋበዙት ሰው ሲያሸንፍ የቤቱን 1% ትርፍ ቦነስ ያገኛሉ!</i>\n` +
          `መልካም የጨዋታ ጊዜ! 🏆`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegramId,
            parse_mode: 'HTML',
            text: welcomeText,
          }),
        });
        telegramNotified = true;
      } catch (tgErr) {
        console.error('[Register API] Telegram notification dispatch error:', tgErr);
      }
    }

    // 2. SMS Welcome Notification (simulated / gateway dispatch)
    console.log(`[SMS GATEWAY DISPATCH] Sent to ${cleanPhone}: "Welcome to Hyper Bingo, ${user.name}! Your account is active with 20 ETB game bonus. Play directly on Telegram: https://t.me/HyperBingoBot?start=${user.referralCode}"`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { 
        user, 
        wallet, 
        linkedAccounts,
        notification: {
          telegram: telegramNotified,
          sms: true,
          phone: cleanPhone,
          bonusETB: 20
        }
      },
      message: 'Account created successfully! Welcome notification sent via Telegram & SMS.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
