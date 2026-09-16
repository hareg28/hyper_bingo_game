/**
 * Checks whether a given Telegram User ID or Username is configured as an administrator in .env.
 * Supports comma-separated list of IDs or usernames in NEXT_PUBLIC_ADMIN_TELEGRAM_IDS or ADMIN_TELEGRAM_IDS.
 * Example: ADMIN_TELEGRAM_IDS=570615212,7829104,@adminuser
 */

export function getAdminWhitelist(): string[] {
  const envAdmins = 
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADMIN_TELEGRAM_IDS) || 
    (typeof process !== 'undefined' && process.env?.ADMIN_TELEGRAM_IDS) || 
    '';

  return envAdmins
    .split(',')
    .map((id) => id.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function isAdminTelegramId(telegramIdOrUsername: string | number | undefined | null): boolean {
  if (!telegramIdOrUsername) return false;
  
  const normalizedInput = String(telegramIdOrUsername).trim().toLowerCase().replace(/^@/, '');
  if (!normalizedInput) return false;

  const adminWhitelist = getAdminWhitelist();
  return adminWhitelist.includes(normalizedInput);
}

