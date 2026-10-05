import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chapaInitializeDeposit } from '@/lib/payments/chapa';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, email, phone, returnUrl } = body as {
      userId: string;
      amount: number;
      email?: string;
      phone?: string;
      returnUrl?: string;
    };

    if (!userId || !amount || amount < 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'userId and minimum amount (10 ETB) are required',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    const txRef = `HB_CHAPA_${userId}_${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bingo-game-rho-five.vercel.app';
    const callbackUrl = `${appUrl}/api/payments/webhook`;
    const resolvedReturnUrl = returnUrl || `${appUrl}?tab=wallet&status=success&ref=${txRef}`;

    const cleanPhone = (phone || user.phone || '').replace(/[^\d+]/g, '');
    const userEmail = email || `${user.username || user.id}@hyperbingo.et`;
    const nameParts = (user.name || 'Hyper Player').trim().split(' ');
    const firstName = nameParts[0] || 'Hyper';
    const lastName = nameParts.slice(1).join(' ') || 'Player';

    // Call Chapa initialize
    const chapaRes = await chapaInitializeDeposit({
      amount,
      currency: 'ETB',
      email: userEmail,
      first_name: firstName,
      last_name: lastName,
      phone_number: cleanPhone || '0911234567',
      tx_ref: txRef,
      return_url: resolvedReturnUrl,
      callback_url: callbackUrl,
      customization: {
        title: 'Hyper Bingo Deposit',
        description: `Wallet deposit of ${amount} ETB for @${user.username}`,
      },
    });

    if (chapaRes.status === 'success' && chapaRes.data?.checkout_url) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          checkoutUrl: chapaRes.data.checkout_url,
          txRef,
          amount,
        },
      });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: chapaRes.message || 'Failed to initialize payment gateway',
    }, { status: 400 });
  } catch (err: unknown) {
    console.error('[Chapa Deposit API] Error:', err);
    const message = err instanceof Error ? err.message : 'Payment gateway error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
