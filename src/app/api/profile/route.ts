import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isTelegramInitDataFresh, parseTelegramUser, verifyTelegramInitData } from '@/lib/telegramAuth';

export async function PATCH(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !initData || !verifyTelegramInitData(initData, botToken) || !isTelegramInitDataFresh(initData, 15 * 60)) {
      return NextResponse.json({ success: false, error: 'Please reopen the Mini App and try again.' }, { status: 401 });
    }

    const telegramUser = parseTelegramUser(initData);
    if (!telegramUser?.id) return NextResponse.json({ success: false, error: 'Telegram account not found.' }, { status: 401 });

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ success: false, error: 'Name must be between 2 and 100 characters.' }, { status: 400 });
    }

    const user = await db.getUserByTelegramId(String(telegramUser.id));
    if (!user?.phone) return NextResponse.json({ success: false, error: 'Register through the bot before editing your profile.' }, { status: 403 });

    const updatedUser = await db.updateUserName(user.id, name);
    if (!updatedUser) return NextResponse.json({ success: false, error: 'Could not update your profile.' }, { status: 500 });
    return NextResponse.json({ success: true, data: { user: updatedUser } });
  } catch (error) {
    console.error('[Profile API] Name update failed:', error);
    return NextResponse.json({ success: false, error: 'Could not update your profile.' }, { status: 500 });
  }
}
