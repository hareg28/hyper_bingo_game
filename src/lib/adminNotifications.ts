import 'server-only';

import { db } from './db';
import { getAdminTelegramIds } from './authUtils';

/** Env-configured admins and users promoted to admin in the Admin Panel. */
export async function getAdminNotificationIds(): Promise<string[]> {
  const [configuredIds, databaseIds] = await Promise.all([
    Promise.resolve(getAdminTelegramIds()),
    db.getAllAdminTelegramIds(),
  ]);

  return [...new Set([...configuredIds, ...databaseIds]
    .map(id => String(id).trim())
    .filter(id => /^-?\d+$/.test(id)))];
}

/** Send one admin notice to every configured or panel-promoted admin. */
export async function notifyAdminsTelegram(
  text: string,
  options: { parseMode?: 'HTML'; replyMarkup?: unknown; disableWebPagePreview?: boolean } = {},
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[Admin notification] TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }

  const adminIds = await getAdminNotificationIds();
  if (adminIds.length === 0) {
    console.error('[Admin notification] No valid admin Telegram IDs are configured.');
    return;
  }

  const results = await Promise.allSettled(adminIds.map(async chatId => {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        ...(options.disableWebPagePreview ? { disable_web_page_preview: true } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}`);
  }));

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Admin notification] Failed to notify admin ${adminIds[index]}:`, result.reason);
    }
  });
}
