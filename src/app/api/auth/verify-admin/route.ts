import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/authUtils';
import { ApiResponse } from '@/lib/types';

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

    const isAdmin = isAdminTelegramId(identifier);

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

  const isAdmin = isAdminTelegramId(identifier);
  return NextResponse.json<ApiResponse>({
    success: true,
    data: { isAdmin, identifier },
  });
}
