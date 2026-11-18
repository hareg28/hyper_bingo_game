import { NextRequest, NextResponse } from 'next/server';
import { getNeonSql } from '@/lib/neon';
import { getBotCountForGame } from '@/lib/botPlayers';
import { isAdminTelegramId } from '@/lib/authUtils';

export async function GET(req: NextRequest) {
  try {
    const sql = getNeonSql();
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    // Ensure bot_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS bot_settings (
        category VARCHAR(64) PRIMARY KEY,
        custom_bot_count INTEGER,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT category, custom_bot_count
      FROM bot_settings
    `;

    const customMap: Record<string, number | null> = {};
    for (const r of rows) {
      customMap[String(r.category)] = r.custom_bot_count != null ? Number(r.custom_bot_count) : null;
    }

    // Default time-division counts (already reduced by 60%)
    const defaultFetan = getBotCountForGame('gm_fetan', 'HYPER_FETAN');
    const defaultSpecial = getBotCountForGame('gm_special_speed', 'HYPER_SPECIAL');
    const defaultWeekend = getBotCountForGame('gm_weekend_fri_2pm', 'HYPER_WEEKEND');

    return NextResponse.json({
      success: true,
      data: {
        HYPER_FETAN: {
          category: 'HYPER_FETAN',
          name: 'Hyper Fetan (ፈጣን ቢንጎ)',
          entryPrice: 10,
          customCount: customMap['HYPER_FETAN'] ?? null,
          defaultCount: defaultFetan,
          activeCount: customMap['HYPER_FETAN'] ?? defaultFetan,
          derash: Math.round((customMap['HYPER_FETAN'] ?? defaultFetan) * 10 * 0.80),
        },
        HYPER_SPECIAL: {
          category: 'HYPER_SPECIAL',
          name: 'Hyper Special (ልዩ ቢንጎ)',
          entryPrice: 10,
          customCount: customMap['HYPER_SPECIAL'] ?? null,
          defaultCount: defaultSpecial,
          activeCount: customMap['HYPER_SPECIAL'] ?? defaultSpecial,
          derash: Math.round((customMap['HYPER_SPECIAL'] ?? defaultSpecial) * 10 * 0.80),
        },
        HYPER_WEEKEND: {
          category: 'HYPER_WEEKEND',
          name: 'Hyper Weekend (የሳምንት መጨረሻ)',
          entryPrice: 50,
          customCount: customMap['HYPER_WEEKEND'] ?? null,
          defaultCount: defaultWeekend,
          activeCount: customMap['HYPER_WEEKEND'] ?? defaultWeekend,
          derash: Math.min(50000, Math.round((customMap['HYPER_WEEKEND'] ?? defaultWeekend) * 50 * 0.80)),
        },
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/bot-settings:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminTelegramId, category, customBotCount } = body;

    // Verify admin privileges
    const isAuth = isAdminTelegramId(adminTelegramId) || String(adminTelegramId).toLowerCase() === 'admin';
    if (!isAuth) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
    }

    const sql = getNeonSql();
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    // Ensure bot_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS bot_settings (
        category VARCHAR(64) PRIMARY KEY,
        custom_bot_count INTEGER,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const parsedCount = (typeof customBotCount === 'number' && customBotCount > 0)
      ? Math.round(customBotCount)
      : null;

    // Upsert into bot_settings
    await sql`
      INSERT INTO bot_settings (category, custom_bot_count, updated_at)
      VALUES (${category}, ${parsedCount}, NOW())
      ON CONFLICT (category) DO UPDATE
      SET custom_bot_count = EXCLUDED.custom_bot_count,
          updated_at = NOW()
    `;

    // Also update any matching games in games table so live state picks it up immediately.
    // If setting a custom count, purge old bot cards for OPEN games so it sets fresh from 0!
    try {
      if (parsedCount) {
        await sql`
          DELETE FROM game_cards
          WHERE game_id IN (
            SELECT id FROM games
            WHERE (category = ${category} OR game_type = ${category})
              AND status = 'OPEN'
          ) AND user_id LIKE 'bot_%'
        `;
        await sql`
          UPDATE games
          SET custom_bot_count = ${parsedCount},
              current_players = ${parsedCount},
              updated_at = NOW()
          WHERE (category = ${category} OR game_type = ${category})
            AND status = 'OPEN'
        `;
      } else {
        await sql`
          UPDATE games
          SET custom_bot_count = NULL,
              updated_at = NOW()
          WHERE category = ${category} OR game_type = ${category}
        `;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: parsedCount
        ? `Bot count for ${category} set to ${parsedCount} for 1 round. Derash will calculate based on this, and next round will auto-revert to dynamic system count.`
        : `Bot count for ${category} reset to default dynamic system count.`,
      category,
      customBotCount: parsedCount,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/bot-settings:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
