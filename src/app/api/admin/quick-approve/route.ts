import { NextResponse } from 'next/server';

/** Legacy unauthenticated approval links are disabled. Use signed Telegram admin buttons or the authenticated admin panel. */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'This approval link is no longer available. Use the authenticated admin panel.' },
    { status: 410 },
  );
}
