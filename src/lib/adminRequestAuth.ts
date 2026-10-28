import { NextRequest } from 'next/server';
import { TelegramUser } from './types';
import { isAdminTelegramId } from './authUtils';
import { isTelegramInitDataFresh, parseTelegramUser, verifyTelegramInitData } from './telegramAuth';

export function getAuthorizedTelegramAdmin(request: NextRequest): TelegramUser | null {
  const initData = request.headers.get('x-telegram-init-data') ?? '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initData || !botToken || !verifyTelegramInitData(initData, botToken) || !isTelegramInitDataFresh(initData, 15 * 60)) {
    return null;
  }

  const telegramUser = parseTelegramUser(initData);
  return telegramUser?.id && (
    isAdminTelegramId(telegramUser.id) || isAdminTelegramId(telegramUser.username)
  ) ? telegramUser : null;
}

export function isAuthorizedTelegramAdmin(request: NextRequest): boolean {
  return getAuthorizedTelegramAdmin(request) !== null;
}
