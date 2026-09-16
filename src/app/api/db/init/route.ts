import { NextRequest, NextResponse } from 'next/server';
import { initDatabaseSchema, getNeonSql } from '@/lib/neon';
import { isAdminTelegramId } from '@/lib/authUtils';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get('admin_id');

  // Simple security: require admin Telegram ID in query
  if (!adminId || !isAdminTelegramId(adminId)) {
    return NextResponse.json(
      { error: 'Access denied. Pass ?admin_id=YOUR_TELEGRAM_ID to initialize the database.' },
      { status: 403 }
    );
  }

  const sql = getNeonSql();
  if (!sql) {
    return NextResponse.json({
      connected: false,
      mode: 'in-memory',
      message: 'DATABASE_URL is not set. The app is running in in-memory mode. Add your Neon connection string to .env.local and Vercel environment variables to enable persistent storage.',
      action: 'Add DATABASE_URL=postgresql://... to your .env.local and Vercel project settings.',
    });
  }

  try {
    const result = await initDatabaseSchema();

    if (result.connected) {
      // Run a quick connectivity test
      const testRows = await sql`SELECT NOW() as server_time, current_database() as db_name`;
      return NextResponse.json({
        connected: true,
        mode: 'neon-postgresql',
        serverTime: testRows[0].server_time,
        database: testRows[0].db_name,
        message: result.message,
        tables: ['users', 'wallets', 'transactions', 'withdrawal_requests', 'linked_accounts', 'games'],
      });
    }

    return NextResponse.json({ connected: false, error: result.error }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}
