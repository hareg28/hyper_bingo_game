import { NextRequest } from 'next/server';
import { TelegramUser } from './types';
import { db } from './db';
import { isAdminTelegramId } from './authUtils';
import { isTelegramInitDataFresh, parseTelegramUser, verifyTelegramInitData } from './telegramAuth';

export async function getAuthorizedTelegramAdmin(request: NextRequest): Promise<TelegramUser | null> {
  const initData = request.headers.get('x-telegram-init-data') ?? '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initData || !botToken || !verifyTelegramInitData(initData, botToken) || !isTelegramInitDataFresh(initData, 15 * 60)) {
    return null;
  }

  const telegramUser = parseTelegramUser(initData);
  if (!telegramUser?.id) return null;
  if (isAdminTelegramId(telegramUser.id) || isAdminTelegramId(telegramUser.username)) return telegramUser;

  const databaseUser = await db.getUserByTelegramId(String(telegramUser.id)).catch(() => null)
    || (telegramUser.username
      ? await db.getUserByUsername(telegramUser.username).catch(() => null)
      : null);
  return databaseUser?.role === 'admin' ? telegramUser : null;
}

export async function isAuthorizedTelegramAdmin(request: NextRequest): Promise<boolean> {
  return (await getAuthorizedTelegramAdmin(request)) !== null;
}
