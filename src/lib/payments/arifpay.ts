/**
 * ArifPay ETB Payment Gateway SDK Wrapper
 * Docs: https://doc.arifpay.net
 *
 * Required env variables:
 *   ARIFPAY_API_KEY=your_arifpay_api_key
 *   ARIFPAY_WEBHOOK_SECRET=your_arifpay_webhook_hmac_secret
 *   NEXT_PUBLIC_APP_URL=https://your-domain.com
 *
 * Covered scenarios (per ArifPay docs):
 *   • Checkout   – initiate a hosted payment session
 *   • Verify     – poll /transaction/status/:sessionId
 *   • Webhook    – verify HMAC-SHA256 on incoming event callbacks
 *   • Disburse   – send money to Telebirr / CBE / bank (disbursement)
 */

const ARIFPAY_BASE_URL = 'https://gateway.arifpay.net/api';

// ── Request / Response Types ──────────────────────────────────────────────────

export interface ArifPayItem {
  name: string;
  quantity: number;
  /** ETB unit price */
  price: number;
  description?: string;
}

export interface ArifPayCheckoutParams {
  /** Unique order/session reference (your tx_ref) */
  nonce: string;
  email: string;
  phone: string;
  /** ETB total amount */
  amount: number;
  currency?: 'ETB';
  items: ArifPayItem[];
  /** Redirect after successful payment */
  successUrl: string;
  cancelUrl: string;
  /** ArifPay will POST payment events here */
  notifyUrl: string;
  /** ISO date – defaults to 24 h from now */
  expireDate?: string;
}

export interface ArifPayCheckoutResponse {
  success: boolean;
  /** Hosted checkout URL to redirect the player to */
  paymentUrl?: string;
  /** ArifPay session ID for status polling & webhook matching */
  sessionId?: string;
  message?: string;
}

export interface ArifPayTransactionStatus {
  success: boolean;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  /** ETB amount actually captured */
  amount?: number;
  currency?: string;
  /** Your original nonce */
  nonce?: string;
  message?: string;
}

export interface ArifPayDisbursementParams {
  /** Unique payout reference */
  nonce: string;
  receiverName: string;
  /** Telebirr phone (+2519…) or bank account number */
  accountNumber: string;
  /** ETB */
  amount: number;
  /** 'TELEBIRR' | 'CBE' | 'AWASH' | 'BANK' */
  channel: string;
  /** Required when channel === 'BANK' */
  bankCode?: string;
  description?: string;
}

export interface ArifPayDisbursementResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHeaders() {
  const key = process.env.ARIFPAY_API_KEY;
  if (!key) throw new Error('ARIFPAY_API_KEY is not configured in environment variables');
  return {
    'x-arifpay-key': key,
    'Content-Type': 'application/json',
  };
}

// ── Checkout (Deposit) ────────────────────────────────────────────────────────

/**
 * Initialize an ArifPay hosted checkout session.
 * Returns a `paymentUrl` (redirect the player) and a `sessionId` (for polling/webhook matching).
 */
export async function arifPayInitCheckout(
  params: ArifPayCheckoutParams
): Promise<ArifPayCheckoutResponse> {
  const body = {
    nonce: params.nonce,
    email: params.email,
    phone: params.phone,
    currency: params.currency ?? 'ETB',
    expireDate: params.expireDate
      ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
    errorUrl: params.cancelUrl,
    cancelUrl: params.cancelUrl,
    notifyUrl: params.notifyUrl,
    successUrl: params.successUrl,
    items: params.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      description: item.description ?? item.name,
    })),
  };

  const res = await fetch(`${ARIFPAY_BASE_URL}/checkout/session`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    console.error('[ArifPay] Checkout init failed:', json);
    return { success: false, message: json.message ?? 'ArifPay checkout initialization failed' };
  }

  return {
    success: true,
    paymentUrl: json.data?.paymentUrl ?? json.paymentUrl,
    sessionId: json.data?.sessionId ?? json.sessionId,
  };
}

// ── Verify Transaction ────────────────────────────────────────────────────────

/**
 * Poll ArifPay for the current status of a payment session.
 * Must be called on webhook receipt AND on the success-URL return as
 * double-verification before crediting the player's wallet.
 */
export async function arifPayVerifySession(
  sessionId: string
): Promise<ArifPayTransactionStatus> {
  const res = await fetch(`${ARIFPAY_BASE_URL}/transaction/status/${sessionId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false, status: 'FAILED', message: json.message ?? 'Verification failed' };
  }

  const rawStatus = (json.data?.status ?? json.status ?? '').toUpperCase();
  const statusMap: Record<string, ArifPayTransactionStatus['status']> = {
    PAID: 'COMPLETED', SUCCESS: 'COMPLETED', COMPLETED: 'COMPLETED',
    PENDING: 'PENDING', FAILED: 'FAILED', CANCELLED: 'CANCELLED',
  };

  return {
    success: true,
    status: statusMap[rawStatus] ?? 'PENDING',
    amount: json.data?.amount,
    currency: json.data?.currency,
    nonce: json.data?.nonce,
  };
}

// ── Webhook Signature Verification ───────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature on every ArifPay webhook POST.
 * ArifPay sends the digest in the `x-arifpay-signature` header as:
 *   sha256=<hex_digest>
 */
export function verifyArifPayWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.ARIFPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[ArifPay] ARIFPAY_WEBHOOK_SECRET not set – signature check skipped');
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

// ── Disbursement (Withdrawal) ─────────────────────────────────────────────────

/**
 * Disburse ETB to a player's Telebirr, CBE, or bank account.
 * This is the final step of the withdrawal flow after admin/risk approval.
 */
export async function arifPayDisburse(
  params: ArifPayDisbursementParams
): Promise<ArifPayDisbursementResponse> {
  const body = {
    nonce: params.nonce,
    receiverName: params.receiverName,
    accountNumber: params.accountNumber,
    amount: params.amount,
    currency: 'ETB',
    channel: params.channel,
    ...(params.bankCode ? { bankCode: params.bankCode } : {}),
    description: params.description ?? 'Hyper Bingo withdrawal payout',
  };

  const res = await fetch(`${ARIFPAY_BASE_URL}/disbursement/send`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    console.error('[ArifPay] Disbursement failed:', json);
    return { success: false, message: json.message ?? 'ArifPay disbursement failed' };
  }

  return {
    success: true,
    transactionId: json.data?.transactionId ?? json.transactionId,
    status: json.data?.status ?? 'SENT',
  };
}
