import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { isAuthorizedTelegramAdmin } from '@/lib/adminRequestAuth';

export async function GET(req: NextRequest) {
  if (!isAuthorizedTelegramAdmin(req)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Administrator authentication required.',
    }, { status: 403 });
  }

  try {
    const transactions = await db.getAllTransactions();
    return NextResponse.json<ApiResponse>({ success: true, data: transactions });
  } catch (error) {
    console.error('[Admin transactions] Could not load transactions:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Could not load all transaction history.',
    }, { status: 500 });
  }
}
