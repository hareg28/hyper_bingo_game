import { NextResponse } from 'next/server';
import { getOwnerPaymentAccounts } from '@/lib/ownerPaymentAccounts';
import { ApiResponse } from '@/lib/types';

/** Owner receiving accounts for manual deposit (merchant till — shown to payers). */
export async function GET() {
  const accounts = getOwnerPaymentAccounts({ mask: false });
  return NextResponse.json<ApiResponse>({
    success: true,
    data: accounts,
  });
}
