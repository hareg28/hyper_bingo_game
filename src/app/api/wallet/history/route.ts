import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { isTelegramInitDataFresh, parseTelegramUser, verifyTelegramInitData } from '@/lib/telegramAuth';

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData || !verifyTelegramInitData(initData, botToken) || !isTelegramInitDataFresh(initData)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Valid Telegram session required to view transaction history.',
    }, { status: 401 });
  }

  const telegramUser = parseTelegramUser(initData);
  if (!telegramUser) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Telegram user could not be read.' }, { status: 401 });
  }

  try {
    const user = await db.getUserByTelegramId(String(telegramUser.id));
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User account not found.' }, { status: 404 });
    }

    const requestedUserId = req.nextUrl.searchParams.get('userId');
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'You cannot view another user’s history.' }, { status: 403 });
    }

    const transactions = await db.getTransactions(user.id);
    return NextResponse.json<ApiResponse>({ success: true, data: transactions });
  } catch (error) {
    console.error('[Wallet history] Could not load transactions:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Could not load transaction history.' }, { status: 500 });
  }
}
