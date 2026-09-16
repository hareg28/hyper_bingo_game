import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, username, telegramId, referralCode } = body as {
      name?: string;
      phone?: string;
      username?: string;
      telegramId?: string;
      referralCode?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Full name is required',
      }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Valid Ethiopian phone number is required',
      }, { status: 400 });
    }

    const cleanPhone = phone.trim();
    // Validate Ethiopian phone pattern (+2519... or 09... or 07...)
    const ethPhoneRegex = /^(\+251[79]\d{8}|0[79]\d{8})$/;
    if (!ethPhoneRegex.test(cleanPhone.replace(/[\s-]/g, ''))) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Please enter a valid Ethiopian phone number (e.g. 0911234567 or +251911234567)',
      }, { status: 400 });
    }

    const user = await db.registerUser({
      name: name.trim(),
      phone: cleanPhone,
      username: username?.trim(),
      telegramId: telegramId?.trim(),
      referredBy: referralCode?.trim(),
    });

    const wallet = await db.getOrCreateWallet(user.id);
    const linkedAccounts = await db.getLinkedAccounts(user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user, wallet, linkedAccounts },
      message: 'Account created successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
