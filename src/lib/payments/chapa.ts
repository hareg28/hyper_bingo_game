/**
 * Chapa ETB Payment Gateway SDK Wrapper
 * Docs: https://developers.chapa.co/docs
 *
 * Required env variables:
 *   CHAPA_SECRET_KEY=CHASECK_TEST_xxxx  (test) or CHASECK_xxxx (live)
 *   CHAPA_WEBHOOK_SECRET=your_webhook_secret
 *   NEXT_PUBLIC_APP_URL=https://your-domain.com
 */

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

interface ChapaDepositParams {
  amount: number;
  currency: 'ETB';
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  tx_ref: string;           // Unique transaction reference
  return_url: string;       // Redirect after payment
  callback_url: string;     // Webhook URL
  customization?: {
    title?: string;
    description?: string;
  };
}

interface ChapaDepositResponse {
  status: 'success' | 'failed';
  message: string;
  data: {
    checkout_url: string;
  };
}

interface ChapaTransferParams {
  account_name: string;
  account_number: string;   // Telebirr phone or bank account
  amount: number;
  currency: 'ETB';
  beneficiary_name: string;
  bank_code?: string;       // Required for bank transfers (get from /banks endpoint)
  reference: string;        // Unique reference per transfer
}

interface ChapaVerifyResponse {
  status: 'success' | 'failed';
  message: string;
  data: {
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
    reference: string;
  };
}

function getHeaders() {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new Error('CHAPA_SECRET_KEY is not set in environment variables');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Initialize a Chapa checkout for ETB deposit.
 */
export async function chapaInitializeDeposit(params: ChapaDepositParams): Promise<ChapaDepositResponse> {
  const res = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chapa initialize failed: ${err}`);
  }
  return res.json();
}

/**
 * Verify a completed Chapa transaction by tx_ref.
 */
export async function chapaVerifyTransaction(txRef: string): Promise<ChapaVerifyResponse> {
  const res = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${txRef}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chapa verify failed: ${err}`);
  }
  return res.json();
}

/**
 * Send a payout (withdrawal) to a Telebirr phone or bank account.
 */
export async function chapaSendTransfer(params: ChapaTransferParams): Promise<{ status: string; message: string }> {
  const res = await fetch(`${CHAPA_BASE_URL}/transfers`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...params, currency: 'ETB' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chapa transfer failed: ${err}`);
  }
  return res.json();
}

/**
 * Verify Chapa webhook HMAC signature.
 * Chapa sends X-Chapa-Signature: sha256=HASH in headers.
 */
export function verifyChapaWebhook(payload: string, signature: string): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) return false;
  const crypto = require('crypto') as typeof import('crypto');
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return expected === signature;
}

/**
 * Get a list of supported banks for bank transfers.
 */
export async function chapaGetBanks(): Promise<{ id: string; name: string; code: string }[]> {
  const res = await fetch(`${CHAPA_BASE_URL}/banks`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch banks list from Chapa');
  const data = await res.json();
  return data.data ?? [];
}
