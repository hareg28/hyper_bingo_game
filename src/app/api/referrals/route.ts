import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

/**
 * GET /api/referrals?code=ABCDEF
 * Resolves a referral code to the referrer's basic info.
 * Used by registration flow to validate referral links before account creation.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Normalize: always uppercase, strip whitespace
    const raw = searchParams.get('code')?.trim() || '';
    const code = raw.toUpperCase();

    if (!code || code.length < 4) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid referral code is required (minimum 4 characters)',
      }, { status: 400 });
    }

    const referrer = await db.getUserByReferralCode(code);

    if (!referrer) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Referral code "${code}" was not found. Please check the code and try again, or register without one.`,
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        name: referrer.name,
        username: referrer.username,
        referrerName: referrer.name,
        referrerUsername: referrer.username,
        referralCode: referrer.referralCode,
        valid: true,
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
