/**
 * AddisPay ETB Payment Gateway SDK Wrapper
 * Docs: https://addispay.et/docs
 *
 * Required env variables:
 *   ADDISPAY_API_KEY=your_addispay_api_key
 *   ADDISPAY_MERCHANT_ID=your_merchant_id
 *   ADDISPAY_WEBHOOK_SECRET=your_addispay_hmac_secret
 *   NEXT_PUBLIC_APP_URL=https://your-domain.com
 *
 * Covered scenarios (per AddisPay docs):
 *   • Checkout        – create a hosted payment session
 *   • Callback/Status – verify payment after callback redirect
 *   • Payment Status  – poll status by order reference
 *   • Disbursement    – disburse funds to Telebirr / CBE / bank
 */

const ADDISPAY_BASE_URL = 'https://api.addispay.et/v1';

// ── Request / Response Types ──────────────────────────────────────────────────

export interface AddisPayCheckoutParams {
  /** Unique order reference on your side */
  orderId: string;
  /** ETB amount */
  amount: number;
  currency?: 'ETB';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Redirect after payment completion */
  returnUrl: string;
  /** AddisPay will POST payment events here */
  callbackUrl: string;
  description?: string;
}

export interface AddisPayCheckoutResponse {
  success: boolean;
  /** Hosted checkout URL – redirect the player here */
  paymentUrl?: string;
  /** AddisPay payment reference for status polling */
  paymentRef?: string;
  message?: string;
}

export interface AddisPayPaymentStatus {
  success: boolean;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount?: number;
  currency?: string;
  orderId?: string;
  message?: string;
}

export interface AddisPayDisbursementParams {
  /** Unique payout reference */
  referenceId: string;
  receiverName: string;
  /** Telebirr phone (+2519…) or bank account number */
  accountNumber: string;
  /** ETB */
  amount: number;
  /** 'TELEBIRR' | 'CBE' | 'AWASH' | 'BANK_TRANSFER' */
  paymentMethod: string;
  bankCode?: string;
  narration?: string;
}

export interface AddisPayDisbursementResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHeaders() {
  const key = process.env.ADDISPAY_API_KEY;
  const merchantId = process.env.ADDISPAY_MERCHANT_ID;
  if (!key || !merchantId) {
    throw new Error('ADDISPAY_API_KEY and ADDISPAY_MERCHANT_ID must be configured');
  }
  return {
    Authorization: `Bearer ${key}`,
    'x-merchant-id': merchantId,
    'Content-Type': 'application/json',
  };
}

// ── Checkout (Deposit) ────────────────────────────────────────────────────────

/**
 * Create an AddisPay hosted checkout session.
 * Returns `paymentUrl` (redirect the player) and `paymentRef` (for status polling).
 */
export async function addisPayInitCheckout(
  params: AddisPayCheckoutParams
): Promise<AddisPayCheckoutResponse> {
  const body = {
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency ?? 'ETB',
    customer: {
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
    },
    returnUrl: params.returnUrl,
    callbackUrl: params.callbackUrl,
    description: params.description ?? 'Hyper Bingo deposit',
  };

  const res = await fetch(`${ADDISPAY_BASE_URL}/payment/create`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json.status === 'error') {
    console.error('[AddisPay] Checkout failed:', json);
    return {
      success: false,
      message: json.message ?? 'AddisPay checkout initialization failed',
    };
  }

  return {
    success: true,
    paymentUrl: json.data?.paymentUrl ?? json.paymentUrl,
    paymentRef: json.data?.paymentRef ?? json.paymentRef ?? params.orderId,
  };
}

// ── Payment Status Checking ───────────────────────────────────────────────────

/**
 * Check AddisPay payment status by order ID.
 * Call on callback receipt AND on return-URL landing as double-verification
 * before crediting the player wallet.
 */
export async function addisPayCheckStatus(
  orderId: string
): Promise<AddisPayPaymentStatus> {
  const res = await fetch(`${ADDISPAY_BASE_URL}/payment/status/${orderId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    return { success: false, status: 'FAILED', message: json.message ?? 'Status check failed' };
  }

  const rawStatus = (json.data?.status ?? json.status ?? '').toUpperCase();
  const statusMap: Record<string, AddisPayPaymentStatus['status']> = {
    SUCCESS: 'COMPLETED', COMPLETED: 'COMPLETED', PAID: 'COMPLETED',
    PENDING: 'PENDING', INITIATED: 'PENDING',
    FAILED: 'FAILED', CANCELLED: 'CANCELLED', REJECTED: 'FAILED',
  };

  return {
    success: true,
    status: statusMap[rawStatus] ?? 'PENDING',
    amount: json.data?.amount,
    currency: json.data?.currency ?? 'ETB',
    orderId: json.data?.orderId ?? orderId,
  };
}

// ── Webhook / Callback Signature Verification ─────────────────────────────────

/**
 * Verify AddisPay callback/webhook HMAC-SHA256 signature.
 * AddisPay sends the signature in the `x-addispay-signature` header.
 */
export function verifyAddisPayWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.ADDISPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[AddisPay] ADDISPAY_WEBHOOK_SECRET not set – skipping signature verification');
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // AddisPay may send raw hex without 'sha256=' prefix — handle both formats
  const clean = signature.replace(/^sha256=/, '');
  return expected === clean;
}

// ── Disbursement (Withdrawal) ─────────────────────────────────────────────────

/**
 * Disburse ETB to a player's Telebirr, CBE, or bank account via AddisPay.
 * This is the last step of the withdrawal flow after admin/risk approval.
 */
export async function addisPayDisburse(
  params: AddisPayDisbursementParams
): Promise<AddisPayDisbursementResponse> {
  const body = {
    referenceId: params.referenceId,
    receiverName: params.receiverName,
    accountNumber: params.accountNumber,
    amount: params.amount,
    currency: 'ETB',
    paymentMethod: params.paymentMethod,
    ...(params.bankCode ? { bankCode: params.bankCode } : {}),
    narration: params.narration ?? 'Hyper Bingo withdrawal payout',
  };

  const res = await fetch(`${ADDISPAY_BASE_URL}/disbursement`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json.status === 'error') {
    console.error('[AddisPay] Disbursement failed:', json);
    return { success: false, message: json.message ?? 'AddisPay disbursement failed' };
  }

  return {
    success: true,
    transactionId: json.data?.transactionId ?? json.transactionId,
    status: json.data?.status ?? 'SENT',
  };
}
