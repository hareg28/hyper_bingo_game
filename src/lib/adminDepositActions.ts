import crypto from 'crypto';

export type DepositAdminAction = 'approve' | 'reject';

export function createDepositActionSignature(action: DepositAdminAction, transactionId: string): string {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!botToken) return '';
  return crypto.createHmac('sha256', botToken)
    .update(`deposit-action:${action}:${transactionId}`)
    .digest('hex')
    .slice(0, 16);
}

export function verifyDepositActionSignature(
  action: DepositAdminAction,
  transactionId: string,
  suppliedSignature: string,
): boolean {
  const expected = createDepositActionSignature(action, transactionId);
  if (!expected || !/^[a-f0-9]{16}$/i.test(suppliedSignature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(suppliedSignature, 'hex'));
}
