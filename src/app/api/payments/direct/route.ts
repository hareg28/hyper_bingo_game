/**
 * Deprecated: /api/payments/direct
 *
 * Fake OTP/SMS passcode simulation has been retired in favor of the official
 * ArifPay payment gateway architecture:
 *
 *   Player → Hyper Bingo Backend (create PENDING tx)
 *          → ArifPay Gateway (Telebirr / CBE / Bank)
 *          → Customer completes payment
 *          → ArifPay Webhook + Status Verification
 *          → Hyper Bingo Backend credits wallet (+ETB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  return NextResponse.json<ApiResponse>({
    success: false,
    error: 'Direct OTP simulation has been deprecated. Please use the official ArifPay checkout gateway to deposit funds safely.',
  }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'Direct OTP endpoint is deprecated. Use /api/payments/deposit with ArifPay gateway.',
  });
}
