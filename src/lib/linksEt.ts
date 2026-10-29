import 'server-only';

import { getOwnerPaymentAccounts } from './ownerPaymentAccounts';

export type LinksEtDepositProvider = 'Telebirr' | 'CBE Birr' | 'Bank Transfer';
export type LinksEtVerificationResult =
  | { matched: true; reference: string }
  | { matched: false; reason: string };

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

function normalizeTransactionId(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase().replace(/[\s_-]/g, '') : '';
}

function parseBirr(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const amount = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return amount ? Number(amount[0]) : Number.NaN;
}

function isReceiptUrl(value: string): boolean {
  const supportedHosts = [
    'transactioninfo.ethiotelecom.et', 'apps.cbe.com.et', 'mb.cbe.com.et',
    'mbreciept.cbe.com.et', 'cbepay1.cbe.com.et', 'cbepay2.cbe.com.et',
    'share.zemenbank.com', 'cs.bankofabyssinia.com', 'awashbank.com',
    'receipts.dashenbanksc.com', 'receipt.dashensuperapp.com', 'api.dashensuperapp.com',
    'm-pesabusiness.safaricom.et', 'receipt.ebirr.com', 'amharabank.com.et',
    'abaymobile.com.et', 'berhanonline.et', 'oromiabank.com', 'ahadubank.com',
    'siinqeebank.com', 'zamzambank.com.et', 'hulubeje.com',
  ];
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && supportedHosts.some((host) =>
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

function getReceiptField(receipt: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (receipt[key] !== undefined && receipt[key] !== null) return receipt[key];
  }
  const transaction = receipt.transaction;
  if (transaction && typeof transaction === 'object') {
    const nested = transaction as Record<string, unknown>;
    for (const key of keys) {
      if (nested[key] !== undefined && nested[key] !== null) return nested[key];
    }
  }
  return undefined;
}

export async function verifyDepositWithLinksEt(
  transactionId: string,
  amount: number,
  provider: LinksEtDepositProvider,
): Promise<LinksEtVerificationResult> {
  const apiKey = process.env.LINKS_ET_API_KEY;
  if (!apiKey) return { matched: false, reason: 'links.et API key is not configured.' };
  const inputIsUrl = isReceiptUrl(transactionId);
  if (!inputIsUrl && provider !== 'Telebirr') return { matched: false, reason: 'Paste the bank or wallet receipt URL to verify this payment.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://links.et/api/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(inputIsUrl
        ? { url: transactionId, waitMs: 20_000 }
        : { reference: transactionId, waitMs: 20_000 }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return { matched: false, reason: `links.et denied API access (HTTP ${response.status}); check LINKS_ET_API_KEY.` };
    }
    if (!response.ok) return { matched: false, reason: `links.et returned HTTP ${response.status}.` };

    const result = await response.json() as {
      ok?: unknown;
      providerKey?: unknown;
      receipt?: Record<string, unknown>;
    };
    const receipt = result.receipt;
    const providerKey = typeof result.providerKey === 'string' ? result.providerKey.toLowerCase() : '';
    if (result.ok !== true || !providerKey || !receipt) {
      return { matched: false, reason: 'links.et could not confirm this receipt.' };
    }
    if (provider === 'Telebirr' && providerKey !== 'telebirr') {
      return { matched: false, reason: 'The receipt is not from Telebirr. Choose the matching payment method.' };
    }
    if (provider === 'CBE Birr' && !['cbe', 'cbe-birr', 'cbebirr'].includes(providerKey)) {
      return { matched: false, reason: 'The receipt is not from CBE or CBE Birr. Choose the matching payment method.' };
    }
    if (provider === 'Bank Transfer' && providerKey === 'telebirr') {
      return { matched: false, reason: 'This is a Telebirr receipt. Choose Telebirr as the payment method.' };
    }

    const rawVerifiedId = getReceiptField(receipt,
      'receiptNo', 'reference', 'transactionReference', 'transactionId', 'invoiceNo', 'paymentOrderNumber', 'vatReceiptNo');
    const verifiedId = typeof rawVerifiedId === 'string' ? rawVerifiedId.trim() : '';
    if (!verifiedId || verifiedId.length > 255) {
      return { matched: false, reason: 'links.et returned a different or missing transaction reference.' };
    }
    if (!inputIsUrl && normalizeTransactionId(verifiedId) !== normalizeTransactionId(transactionId)) {
      return { matched: false, reason: 'links.et returned a different transaction reference.' };
    }
    const status = getReceiptField(receipt, 'transactionStatus', 'upstreamStatus', 'status');
    if (status !== undefined && !['completed', 'success', 'successful', 'paid'].includes(normalize(status))) {
      return { matched: false, reason: 'The receipt is not marked as a completed payment.' };
    }
    const amountValue = getReceiptField(receipt,
      'transferredAmount', 'settledAmount', 'amount', 'creditAmount', 'totalPaidAmount', 'totalAmount', 'totalAmountPaid');
    const returnedAmount = parseBirr(amountValue);
    if (!Number.isFinite(returnedAmount) || Math.round(returnedAmount * 100) < Math.round(amount * 100)) {
      return { matched: false, reason: 'Verified transaction amount is less than the requested deposit.' };
    }

    const receiver = getReceiptField(receipt, 'creditedPartyName', 'receiverName', 'recipientName', 'beneficiaryName');
    const account = getOwnerPaymentAccounts().find((candidate) => candidate.method === (provider === 'Telebirr' ? 'TELEBIRR' : 'CBE'));
    if (!account?.accountName || normalize(receiver) !== normalize(account.accountName)) {
      return { matched: false, reason: 'Verified receiver name does not match the configured owner account.' };
    }
    return { matched: true, reference: verifiedId };
  } catch (error) {
    return {
      matched: false,
      reason: error instanceof Error && error.name === 'AbortError'
        ? 'links.et verification timed out.'
        : 'links.et verification could not be completed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
