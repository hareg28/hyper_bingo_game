import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier } = body as { identifier?: string };

    if (!identifier || !identifier.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Phone number or Telegram ID is required',
      }, { status: 400 });
    }

    const cleanInput = identifier.trim();
    let user = await db.getUserByPhone(cleanInput);
    if (!user) {
      user = await db.getUserByTelegramId(cleanInput);
    }

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No account found with this phone number or Telegram ID. Please open an account first.',
      }, { status: 404 });
    }

    const wallet = await db.getOrCreateWallet(user.id);
    const linkedAccounts = await db.getLinkedAccounts(user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user, wallet, linkedAccounts },
      message: 'Logged in successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
