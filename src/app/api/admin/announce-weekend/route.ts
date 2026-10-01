import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';
import { db } from '@/lib/db';

const DEFAULT_BOT_TOKEN = '8695197731:AAFGJVsWLVxAmzHqd8Sb8TOLRKt-DyUTcUw';

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';

  try {
    const body = await req.json();
    const { adminTelegramId, weekendGames, chatId, customText, mediaUrl, mediaType, fileName } = body;

    // Verify caller is admin
    if (!isAdminTelegramId(adminTelegramId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let announcementText = '';
    if (customText && typeof customText === 'string' && customText.trim().length > 0) {
      announcementText = customText.trim();
    } else {
      announcementText =
        `🌟👑 <b>HYPER BINGO ETHIOPIA — WEEKEND MEGA EXTRAVAGANZA!</b> 👑🌟\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🇪🇹 <b>የሳምንቱ መጨረሻ ታላቅ የቢንጎ እና የሎተሪ ፌስቲቫል!</b>\n` +
        `💰 <b>የጃክፖት ፈንድ / Total Prize Pool: 100,000+ ETB!</b>\n\n` +
        `⏰ <b>የቀጥታ ዕጣ ማውጣት ሰዓቶች (Official Draw Times):</b>\n` +
        `   🏆 <b>2:00 PM (ከሰዓት 8:00)</b> — ⚡ Mega Kickoff Draw\n` +
        `   🏆 <b>5:00 PM (ከቀኑ 11:00)</b> — 🎲 Golden Rush Mega Draw\n` +
        `   🏆 <b>7:00 PM (ምሽት 1:00)</b> — 👑 Super Jackpot Finale\n\n` +
        `💎 <b>ልዩ ጥቅሞች (Why Play Now):</b>\n` +
        `   ✅ <b>80% የተጣራ ክፍያ ለአሸናፊዎች</b> (80% Return to Players)\n` +
        `   ✅ <b>ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር</b> (Instant Cashout)\n` +
        `   🎁 <b>20 ETB የመመዝገቢያ ቦነስ</b> (Play-only Welcome Bonus)\n\n` +
        `🚀 <i>ዕድልዎን አሁኑኑ ይሞክሩ! ካርዶችዎን ቀድመው ይያዙ!</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 <b>ከታች ያለውን አዝራር ተጭነው አሁኑኑ ይቀላቀሉ!</b>`;
    }

    // Persist announcement in database with media so all users opening the bot or web app see it!
    try {
      await db.saveAnnouncement(
        announcementText,
        'HYPER BINGO BROADCAST',
        'BROADCAST',
        mediaUrl || undefined,
        mediaType || undefined,
        fileName || undefined
      );
    } catch (saveErr) {
      console.error('Failed to save announcement to DB in announce-weekend:', saveErr);
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

    // Helper to send message, photo, or document based on media type (supports both URLs and base64 uploads)
    const sendTelegramPayload = async (targetId: string | number) => {
      if (mediaType === 'photo' && mediaUrl) {
        if (mediaUrl.startsWith('data:')) {
          try {
            const [meta, base64Data] = mediaUrl.split(',');
            const mimeMatch = meta.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer], { type: mimeType });

            const formData = new FormData();
            formData.append('chat_id', String(targetId));
            formData.append('caption', announcementText);
            formData.append('parse_mode', 'HTML');
            formData.append('reply_markup', JSON.stringify(announcementKeyboard));
            formData.append('photo', blob, fileName || 'broadcast_image.jpg');

            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              body: formData,
            });
            return res.json();
          } catch (e: any) {
            console.error('Error sending multipart photo:', e);
          }
        }

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetId,
            photo: mediaUrl,
            caption: announcementText,
            parse_mode: 'HTML',
            reply_markup: announcementKeyboard,
          }),
        });
        return res.json();
      } else if (mediaType === 'document' && mediaUrl) {
        if (mediaUrl.startsWith('data:')) {
          try {
            const [meta, base64Data] = mediaUrl.split(',');
            const mimeMatch = meta.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer], { type: mimeType });

            const formData = new FormData();
            formData.append('chat_id', String(targetId));
            formData.append('caption', announcementText);
            formData.append('parse_mode', 'HTML');
            formData.append('reply_markup', JSON.stringify(announcementKeyboard));
            formData.append('document', blob, fileName || 'document.pdf');

            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
              method: 'POST',
              body: formData,
            });
            return res.json();
          } catch (e: any) {
            console.error('Error sending multipart document:', e);
          }
        }

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetId,
            document: mediaUrl,
            caption: announcementText,
            parse_mode: 'HTML',
            reply_markup: announcementKeyboard,
          }),
        });
        return res.json();
      } else {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetId,
            parse_mode: 'HTML',
            text: announcementText,
            reply_markup: announcementKeyboard,
          }),
        });
        return res.json();
      }
    };

    // Send the standalone announcement (NO redundant follow-up game list messages!)
    const result = await sendTelegramPayload(targetChatId);

    // If sent to a channel, also deliver a preview copy to admin's private chat without any game list spam
    if (adminTelegramId && String(targetChatId) !== String(adminTelegramId)) {
      await sendTelegramPayload(adminTelegramId).catch(() => {});
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
