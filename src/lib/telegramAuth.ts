import crypto from 'crypto';
import { TelegramUser } from './types';

/**
 * Verifies Telegram WebApp initData using HMAC-SHA256.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;

    urlParams.delete('hash');

    // Build the data-check string: sorted key=value pairs joined by \n
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // HMAC key = HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  } catch {
    return false;
  }
}

/**
 * Parses the Telegram user object from initData string.
 */
export function parseTelegramUser(initData: string): TelegramUser | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr) as TelegramUser;
    const hash = urlParams.get('hash');
    const authDate = urlParams.get('auth_date');
    if (!hash || !authDate) return null;
    return { ...user, hash, auth_date: parseInt(authDate) };
  } catch {
    return null;
  }
}

/**
 * Checks if initData is fresh (within 24 hours).
 */
export function isTelegramInitDataFresh(initData: string, maxAgeSeconds = 86400): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const authDate = urlParams.get('auth_date');
    if (!authDate) return false;
    const age = Math.floor(Date.now() / 1000) - parseInt(authDate);
    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}
