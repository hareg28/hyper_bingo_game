/**
 * Owner / merchant receiving accounts shown to players during manual deposit.
 * Configure via environment variables (never collect player PINs in-app).
 */

export type OwnerAccountMethod = 'TELEBIRR' | 'CBE';

export interface OwnerPaymentAccount {
  method: OwnerAccountMethod;
  label: string;
  accountNumber: string;
  accountName: string;
  /** Optional CBE bank account when method is CBE */
  bankAccountNumber?: string;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const local = digits.startsWith('251') ? digits.slice(3) : digits;
  if (local.length >= 10) {
    return `0${local.slice(0, 2)}${'X'.repeat(Math.max(0, local.length - 4))}${local.slice(-2)}`;
  }
  return phone;
}

function maskAccount(acct: string): string {
  const clean = acct.replace(/\s/g, '');
  if (clean.length <= 4) return clean;
  return `${'X'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function readOwnerConfig() {
  const telebirrPhone =
    process.env.OWNER_TELEBIRR_PHONE ??
    process.env.NEXT_PUBLIC_OWNER_TELEBIRR_PHONE ??
    '0938922481';
  const telebirrName =
    process.env.OWNER_TELEBIRR_NAME ??
    process.env.NEXT_PUBLIC_OWNER_TELEBIRR_NAME ??
    'Hyper Bingo';
  const cbePhone =
    process.env.OWNER_CBE_PHONE ??
    process.env.NEXT_PUBLIC_OWNER_CBE_PHONE ??
    telebirrPhone;
  const cbeName =
    process.env.OWNER_CBE_NAME ??
    process.env.NEXT_PUBLIC_OWNER_CBE_NAME ??
    telebirrName;
  const cbeAccount =
    process.env.OWNER_CBE_ACCOUNT ??
    process.env.NEXT_PUBLIC_OWNER_CBE_ACCOUNT ??
    '1000540829954';
  return { telebirrPhone, telebirrName, cbePhone, cbeName, cbeAccount };
}

export function getOwnerPaymentAccounts(options?: { mask?: boolean }): OwnerPaymentAccount[] {
  const mask = options?.mask ?? false;
  const { telebirrPhone, telebirrName, cbePhone, cbeName, cbeAccount } = readOwnerConfig();

  const teleDisplay = mask ? maskPhone(telebirrPhone) : telebirrPhone;
  const cbeAcctDisplay = mask ? maskAccount(cbeAccount) : cbeAccount;

  return [
    {
      method: 'TELEBIRR',
      label: 'Telebirr',
      accountNumber: teleDisplay,
      accountName: telebirrName,
    },
    {
      method: 'CBE',
      label: 'CBE',
      accountNumber: cbeAcctDisplay,
      accountName: cbeName,
      bankAccountNumber: cbePhone !== telebirrPhone ? (mask ? maskPhone(cbePhone) : cbePhone) : undefined,
    },
  ];
}

/** Raw destination strings for payment instructions (admin-configured, unmasked). */
export function getOwnerDestinationForProvider(provider: string): string {
  const { telebirrPhone, telebirrName, cbePhone, cbeAccount, cbeName } = readOwnerConfig();

  if (provider === 'Telebirr') {
    return `Telebirr: ${telebirrPhone} (${telebirrName})`;
  }
  if (provider === 'CBE Birr') {
    return `CBE Birr / Phone: ${cbePhone} / CBE Acct: ${cbeAccount} (${cbeName})`;
  }
  return `CBE Account: ${cbeAccount} (${cbeName})`;
}

/** Payment gateways are disabled — deposits/withdrawals are admin-verified only. */
export function isAutoGatewayEnabled(): boolean {
  return false;
}

export function isAutoDisburseEnabled(): boolean {
  return false;
}
