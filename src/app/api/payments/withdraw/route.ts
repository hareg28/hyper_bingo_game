import { NextRequest, NextResponse } from 'next/server';
import { chapaSendTransfer } from '@/lib/payments/chapa';
import { db } from '@/lib/db';
import { ApiResponse, WithdrawResponse, PaymentProvider } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, accountNumber, accountName, paymentMethod } = body as {
      userId: string;
      amount: number;
      accountNumber: string;   // Telebirr: +2519..., CBE: account number
      accountName: string;     // Full legal name
      paymentMethod: PaymentProvider;
    };

    // Validation
    if (!userId || !amount || !accountNumber || !accountName || !paymentMethod) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'All fields are required: userId, amount, accountNumber, accountName, paymentMethod',
      }, { status: 400 });
    }

    if (amount < 50) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Minimum withdrawal amount is 50 ETB',
      }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, { status: 404 });
    }

    // Create withdrawal request (deducts from winningBalance in DB)
    const { withdrawal } = await db.createWithdrawal({
      userId,
      amount,
      paymentMethod,
      accountNumber,
      accountName,
    });

    // Attempt automated payout via Chapa Transfer API if key is configured
    if (process.env.CHAPA_SECRET_KEY) {
      try {
        await chapaSendTransfer({
          account_name: accountName,
          account_number: accountNumber,
          amount,
          currency: 'ETB',
          beneficiary_name: accountName,
          reference: withdrawal.id,
        });
        console.log(`[Withdraw] Automated payout sent: ${amount} ETB to ${accountNumber}`);
      } catch (payoutErr) {
        // Payout failed but withdrawal request is saved for admin manual processing
        console.error('[Withdraw] Automated payout failed, requires admin review:', payoutErr);
      }
    }

    return NextResponse.json<ApiResponse<WithdrawResponse>>({
      success: true,
      data: {
        withdrawalId: withdrawal.id,
        status: withdrawal.status,
        estimatedProcessingTime: '1-24 hours (admin review)',
      },
      message: `Withdrawal request of ${amount} ETB submitted successfully!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Withdraw API] Error:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
