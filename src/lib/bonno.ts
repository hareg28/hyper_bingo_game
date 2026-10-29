import 'server-only';

import { getOwnerPaymentAccounts } from './ownerPaymentAccounts';

export type BonnoDepositProvider = 'Telebirr' | 'CBE Birr';
export type BonnoVerificationResult =
  | { matched: true }
  | { matched: false; reason: string };

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function expectedBank(provider: BonnoDepositProvider): string {
  return provider === 'Telebirr' ? 'telebirr' : 'cbe';
}

function normalizeTransactionId(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase().replace(/[\s_-]/g, '') : '';
}

export async function verifyDepositWithBonno(
  transactionId: string,
  amount: number,
  provider: BonnoDepositProvider,
): Promise<BonnoVerificationResult> {
  const apiKey = process.env.BONNO_API_KEY;
  if (!apiKey) return { matched: false, reason: 'Bonno API key is not configured.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://bonno.et/api/v1/verify', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ tx_id: transactionId }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) return { matched: false, reason: `Bonno returned HTTP ${response.status}.` };
    const result = await response.json() as {
      tx_id?: unknown;
      matched?: unknown;
      amount?: unknown;
      bank?: unknown;
      receiver_name?: unknown;
    };

    if (result.matched !== true) return { matched: false, reason: 'Bonno did not confirm a successful match.' };
    const submittedId = normalizeTransactionId(transactionId);
    const verifiedId = normalizeTransactionId(result.tx_id);
    if (!verifiedId || !(verifiedId.startsWith(submittedId) || submittedId.startsWith(verifiedId))) {
      return { matched: false, reason: 'Bonno returned a different or missing transaction reference.' };
    }
    const returnedAmount = Number(result.amount);
    // Credit only the requested amount. A larger verified transfer is safe to
    // accept as an overpayment; a smaller one must stay in admin review.
    if (!Number.isFinite(returnedAmount) || Math.round(returnedAmount * 100) < Math.round(amount * 100)) {
      return { matched: false, reason: 'Verified transaction amount is less than the requested deposit.' };
    }
    if (normalize(result.bank) !== expectedBank(provider)) {
      return { matched: false, reason: 'Verified transaction bank does not match the selected payment method.' };
    }

    const accountMethod = provider === 'Telebirr' ? 'TELEBIRR' : 'CBE';
    const account = getOwnerPaymentAccounts().find((candidate) => candidate.method === accountMethod);
    if (!account?.accountName || normalize(result.receiver_name) !== normalize(account.accountName)) {
      return { matched: false, reason: 'Verified receiver name does not match the configured owner account.' };
    }

    return { matched: true };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? 'Bonno verification timed out.'
      : 'Bonno verification could not be completed.';
    return { matched: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}
