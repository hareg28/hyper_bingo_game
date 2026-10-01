import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminTelegramId } from '@/lib/authUtils';

export const dynamic = 'force-dynamic';

// GET: Returns the currently active announcement
export async function GET() {
  try {
    const announcement = await db.getActiveAnnouncement();
    return NextResponse.json({
      success: true,
      announcement: announcement || null,
    });
  } catch (error: any) {
    console.error('GET /api/announcements error:', error);
    return NextResponse.json({ success: false, announcement: null, error: error.message }, { status: 500 });
  }
}

// POST: Admin creates or updates an announcement
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, title, type, adminTelegramId } = body;

    if (!isAdminTelegramId(adminTelegramId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Announcement text is required' }, { status: 400 });
    }

    const saved = await db.saveAnnouncement(text.trim(), title?.trim() || '', type || 'BROADCAST');
    return NextResponse.json({
      success: true,
      announcement: saved,
    });
  } catch (error: any) {
    console.error('POST /api/announcements error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Admin dismisses/clears the active announcement
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminTelegramId, id } = body;

    if (!isAdminTelegramId(adminTelegramId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    await db.clearActiveAnnouncement(id);
    return NextResponse.json({ success: true, message: 'Announcement cleared' });
  } catch (error: any) {
    console.error('DELETE /api/announcements error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
