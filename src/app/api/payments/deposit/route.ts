import { NextRequest, NextResponse } from 'next/server';
import { chapaInitializeDeposit } from '@/lib/payments/chapa';
import { db } from '@/lib/db';
import { ApiResponse, DepositInitResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, provider } = body as {
      userId: string;
      amount: number;
      provider: 'Telebirr' | 'CBE Birr' | 'Chapa';
    };

    if (!userId || !amount || amount < 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and amount (minimum 10 ETB) are required',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    const txRef = `HBINGO_${userId}_${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Initialize Chapa checkout
    const chapaRes = await chapaInitializeDeposit({
      amount,
      currency: 'ETB',
      email: `${user.username}@hyperbingo.et`,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || user.name,
      phone_number: user.phone || '0900000000',
      tx_ref: txRef,
      return_url: `${appUrl}/app?deposit=success&ref=${txRef}`,
      callback_url: `${appUrl}/api/payments/webhook`,
      customization: {
        title: 'Hyper Bingo Deposit',
        description: `Deposit ${amount} ETB to your Hyper Bingo wallet`,
      },
    });

    if (chapaRes.status !== 'success') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Payment gateway error: ${chapaRes.message}`,
      }, { status: 502 });
    }

    return NextResponse.json<ApiResponse<DepositInitResponse>>({
      success: true,
      data: {
        checkoutUrl: chapaRes.data.checkout_url,
        txRef,
        amount,
        currency: 'ETB',
      },
    });
  } catch (err) {
    console.error('[Deposit API] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to initialize deposit. Please try again.',
    }, { status: 500 });
  }
}
