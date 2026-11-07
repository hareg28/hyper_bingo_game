import 'server-only';

import { getOwnerPaymentAccounts } from './ownerPaymentAccounts';

export type LinksEtDepositProvider = 'Telebirr' | 'CBE Birr' | 'Bank Transfer';
export type LinksEtVerificationResult =
  | { matched: true; reference: string }
  | { matched: false; reason: string };

type LinksEtResponse = {
  ok?: unknown;
  error?: unknown;
  message?: unknown;
  providerKey?: unknown;
  receipt?: Record<string, unknown>;
  requestId?: unknown;
  statusUrl?: unknown;
  processingStatus?: unknown;
};

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/[_\s]+/g, ' ').toLowerCase()
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

export function isSupportedLinksEtReceiptUrl(value: string): boolean {
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

function getResponseError(result: LinksEtResponse): string {
  for (const value of [result.error, result.message]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const key of ['message', 'detail', 'code']) {
        if (typeof nested[key] === 'string' && nested[key].trim()) return nested[key].trim();
      }
    }
  }
  return '';
}

async function pollLinksEtVerification(
  statusUrl: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<LinksEtResponse> {
  const url = new URL(statusUrl, 'https://links.et');
  if (url.origin !== 'https://links.et') throw new Error('links.et returned an invalid status URL.');

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 1_500);
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      } else {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        }, { once: true });
      }
    });

    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal,
      cache: 'no-store',
    });
    const result = await response.json() as LinksEtResponse;
    if (!response.ok && response.status !== 202) {
      return result;
    }
    const status = typeof result.processingStatus === 'string' ? result.processingStatus.toLowerCase() : '';
    if (result.ok === true || status === 'completed' || status === 'failed') return result;
  }

  return { ok: false, error: 'links.et verification remained queued until the server timeout.' };
}

export async function verifyDepositWithLinksEt(
  transactionId: string,
  amount: number,
  provider: LinksEtDepositProvider,
): Promise<LinksEtVerificationResult> {
  const apiKey = process.env.LINKS_API_KEY || process.env.LINKS_ET_API_KEY;
  if (!apiKey) return { matched: false, reason: 'links.et API key is not configured.' };
  const inputIsUrl = isSupportedLinksEtReceiptUrl(transactionId);
  if (!inputIsUrl && provider !== 'Telebirr') return { matched: false, reason: 'Paste the bank or wallet receipt URL to verify this payment.' };

  const controller = new AbortController();
  // links.et may return 202 after the initial wait while a slow provider is
  // still being checked. Allow the follow-up polling window to complete too.
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch('https://links.et/api/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(inputIsUrl
        ? { url: transactionId, waitMs: 15_000 }
        : { reference: transactionId, waitMs: 15_000 }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return { matched: false, reason: `links.et denied API access (HTTP ${response.status}); check LINKS_API_KEY.` };
    }
    const initialResult = await response.json() as LinksEtResponse;
    let result = initialResult;
    if (response.status === 202) {
      const statusUrl = typeof initialResult.statusUrl === 'string' ? initialResult.statusUrl : '';
      if (!statusUrl) return { matched: false, reason: 'links.et queued the receipt but did not provide a status URL.' };
      result = await pollLinksEtVerification(statusUrl, apiKey, controller.signal);
    }
    if (!response.ok && response.status !== 202) {
      const detail = getResponseError(result);
      return { matched: false, reason: detail ? `links.et could not verify this receipt: ${detail}` : `links.et returned HTTP ${response.status}.` };
    }

    const receipt = result.receipt;
    const providerKey = typeof result.providerKey === 'string' ? result.providerKey.toLowerCase() : '';
    if (result.ok !== true || !providerKey || !receipt) {
      const detail = getResponseError(result);
      return { matched: false, reason: detail ? `links.et could not verify this receipt: ${detail}` : 'links.et could not confirm this receipt.' };
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
    if (!Number.isFinite(returnedAmount)) {
      return { matched: false, reason: 'The verified receipt does not include a readable transferred amount.' };
    }
    if (Math.round(returnedAmount * 100) !== Math.round(amount * 100)) {
      return {
        matched: false,
        reason: `Verified amount (${returnedAmount} ETB) does not match the requested amount (${amount} ETB).`,
      };
    }

    const receiver = getReceiptField(receipt, 'creditedPartyName', 'receiverName', 'recipientName', 'beneficiaryName');
    const account = getOwnerPaymentAccounts().find((candidate) => candidate.method === (provider === 'Telebirr' ? 'TELEBIRR' : 'CBE'));
    if (!account?.accountName || normalize(receiver) !== normalize(account.accountName)) {
      const returnedName = typeof receiver === 'string' && receiver.trim() ? receiver.trim() : '(not provided)';
      const configuredName = account?.accountName?.trim() || '(not configured)';
      return {
        matched: false,
        reason: `Verified receiver name "${returnedName}" does not match configured owner name "${configuredName}".`,
      };
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
