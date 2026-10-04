import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const telegramId = searchParams.get('telegramId');
    const phone = searchParams.get('phone');

    let user = null;
    if (userId) {
      user = await db.getUser(userId);
    } else if (telegramId) {
      user = await db.getUserByTelegramId(telegramId);
    } else if (phone) {
      user = await db.getUserByPhone(phone);
    }

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    const wallet = await db.getOrCreateWallet(user.id);
    const linkedAccounts = await db.getLinkedAccounts(user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user, wallet, linkedAccounts },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
