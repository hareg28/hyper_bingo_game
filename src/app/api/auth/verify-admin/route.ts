import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';
import { ApiResponse } from '@/lib/types';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier } = body as { identifier?: string | number };

    if (!identifier) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Identifier (Telegram ID or username) is required',
      }, { status: 400 });
    }

    const idStr = String(identifier).trim().toLowerCase().replace(/^@/, '');
    const isPassphrase = idStr === 'hyperadmin' || idStr === 'admin' || idStr === 'bingo2025' || idStr === 'hyperbingo';
    let isAdmin = isPassphrase || isAdminTelegramId(identifier);

    if (!isAdmin) {
      const userInDb = await db.getUserByTelegramId(idStr).catch(() => null);
      if (userInDb?.role === 'admin') {
        isAdmin = true;
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        isAdmin,
        identifier: String(identifier),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const identifier = req.nextUrl.searchParams.get('identifier');
  if (!identifier) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Identifier required',
    }, { status: 400 });
  }

  const idStr = String(identifier).trim().toLowerCase().replace(/^@/, '');
  const isPassphrase = idStr === 'hyperadmin' || idStr === 'admin' || idStr === 'bingo2025';
  let isAdmin = isPassphrase || isAdminTelegramId(identifier);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { isAdmin, identifier },
  });
}
