import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referrerCode, commissionAmount, referredUsername, gameName, ownerProfit } = body as {
      referrerCode: string;
      commissionAmount: number;
      referredUsername?: string;
      gameName?: string;
      ownerProfit?: number;
    };

    if (!referrerCode || !commissionAmount || commissionAmount <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'referrerCode and positive commissionAmount are required',
      }, { status: 400 });
    }

    const success = await db.creditReferrerCommission(referrerCode, commissionAmount);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Commission of ${commissionAmount} ETB (1% of owner profit) credited to referrer's bonus balance (play-only).`,
      data: { referrerCode, commissionAmount, ownerProfit, success },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to reward referrer';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
