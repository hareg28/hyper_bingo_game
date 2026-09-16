import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData, parseTelegramUser, isTelegramInitDataFresh } from '@/lib/telegramAuth';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData } = body as { initData: string };

    if (!initData) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'initData is required',
      }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Server misconfiguration: TELEGRAM_BOT_TOKEN not set',
      }, { status: 500 });
    }

    // Verify HMAC signature
    const isValid = verifyTelegramInitData(initData, botToken);
    if (!isValid) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid Telegram initData signature',
      }, { status: 401 });
    }

    // Check freshness (within 24 hours)
    if (!isTelegramInitDataFresh(initData)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Telegram initData has expired. Please reopen the Mini App.',
      }, { status: 401 });
    }

    // Parse Telegram user
    const tgUser = parseTelegramUser(initData);
    if (!tgUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Could not parse Telegram user from initData',
      }, { status: 400 });
    }

    // Upsert user in database
    const user = await db.upsertUserFromTelegram(tgUser);
    const wallet = await db.getOrCreateWallet(user.id);
    const linkedAccounts = await db.getLinkedAccounts(user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user, wallet, linkedAccounts },
      message: 'Authenticated successfully',
    });
  } catch (err) {
    console.error('[Auth Telegram] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
