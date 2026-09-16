import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse, LinkedAccountType } from '@/lib/types';

// GET /api/accounts?userId=xxx  -- list linked accounts
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: 'userId required' }, { status: 400 });
  const accounts = await db.getLinkedAccounts(userId);
  return NextResponse.json<ApiResponse>({ success: true, data: accounts });
}

// POST /api/accounts  -- link a new account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, accountNumber, accountName, bankName } = body as {
      userId: string;
      type: LinkedAccountType;
      accountNumber: string;
      accountName: string;
      bankName?: string;
    };

    if (!userId || !type || !accountNumber || !accountName) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Basic phone validation for Telebirr (+2519xxxxxxxx)
    if (type === 'TELEBIRR' && !/^\+2519\d{8}$/.test(accountNumber)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Telebirr account must be a valid Ethiopian phone number: +2519XXXXXXXX',
      }, { status: 400 });
    }

    const account = await db.addLinkedAccount({ userId, type, accountNumber, accountName, bankName });
    return NextResponse.json<ApiResponse>({ success: true, data: account, message: 'Account linked successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to link account';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/accounts?userId=xxx&accountId=xxx  -- unlink account
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const accountId = req.nextUrl.searchParams.get('accountId');
  if (!userId || !accountId) return NextResponse.json<ApiResponse>({ success: false, error: 'userId and accountId required' }, { status: 400 });
  await db.deleteLinkedAccount(userId, accountId);
  return NextResponse.json<ApiResponse>({ success: true, message: 'Account removed' });
}
