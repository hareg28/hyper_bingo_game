import { NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';

export async function POST() {
  return NextResponse.json<ApiResponse>({
    success: false,
    error: 'Registration is only available in the Hyper Bingo bot. Open the bot and share your contact to register.',
  }, { status: 403 });
}
