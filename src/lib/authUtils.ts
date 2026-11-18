/**
 * Checks whether a given Telegram User ID or Username is configured as an administrator in .env.
 * Supports comma-separated list of IDs or usernames in NEXT_PUBLIC_ADMIN_TELEGRAM_IDS or ADMIN_TELEGRAM_IDS.
 * Example: ADMIN_TELEGRAM_IDS=570615212,7829104,@adminuser
 */

export function getAdminWhitelist(): string[] {
  const envAdmins1 = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADMIN_TELEGRAM_IDS) || '';
  const envAdmins2 = (typeof process !== 'undefined' && process.env?.ADMIN_TELEGRAM_IDS) || '';
  const combined = `${envAdmins1},${envAdmins2}`;

  const list = combined
    .split(',')
    .map((id) => id.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  const defaults = [
    '570615212',
    '7829104',
    '634945198',
    'hareg_t',
    'hareg28',
    'tamraattteff',
    'tamrat',
  ];
  for (const d of defaults) {
    if (!list.includes(d)) list.push(d);
  }
  return list;
}

/** Numeric Telegram chat IDs configured to receive server-side admin notices. */
export function getAdminTelegramIds(): string[] {
  const configuredIds = typeof process !== 'undefined' ? process.env?.ADMIN_TELEGRAM_IDS : '';
  return (configuredIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^-?\d+$/.test(id));
}

export function isAdminTelegramId(telegramIdOrUsername: string | number | undefined | null): boolean {
  if (!telegramIdOrUsername) return false;
  
  const normalizedInput = String(telegramIdOrUsername).trim().toLowerCase().replace(/^@/, '');
  if (!normalizedInput) return false;

  const adminWhitelist = getAdminWhitelist();
  return adminWhitelist.includes(normalizedInput);
}

