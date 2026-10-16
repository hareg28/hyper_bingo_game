import { createSign, randomBytes } from 'node:crypto';

type TelebirrEnvironment = 'sandbox' | 'production';

type TelebirrCredentials = {
  environment: TelebirrEnvironment;
  fabricAppId: string;
  fabricAppSecret: string;
  merchantAppId: string;
  merchantCode: string;
  privateKey: string;
  notifyUrl: string;
  redirectUrl: string;
};

type TelebirrApiResponse = {
  result?: string;
  code?: string;
  msg?: string;
  message?: string;
  token?: string;
  biz_content?: Record<string, unknown>;
};

const TELEBIRR_ENDPOINTS: Record<TelebirrEnvironment, { apiBase: string; webBase: string }> = {
  sandbox: {
    apiBase: 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
    webBase: 'https://developerportal.ethiotelebirr.et:38443/payment/web/paygate',
  },
  production: {
    apiBase: 'https://superapp.ethiomobilemoney.et:38443/apiaccess/payment/gateway',
    webBase: 'https://superapp.ethiomobilemoney.et:38443/payment/web/paygate',
  },
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing Telebirr configuration: ${name}`);
  return value;
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

export function getTelebirrCredentials(): TelebirrCredentials {
  const environment = (process.env.TELEBIRR_ENVIRONMENT || 'sandbox').toLowerCase();
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new Error('TELEBIRR_ENVIRONMENT must be sandbox or production');
  }

  return {
    environment,
    fabricAppId: requiredEnv('FABRIC_APP_ID'),
    fabricAppSecret: requiredEnv('FABRIC_APP_SECRET'),
    merchantAppId: requiredEnv('MERCHANT_APP_ID'),
    merchantCode: requiredEnv('MERCHANT_CODE'),
    privateKey: normalizePem(requiredEnv('PRIVATE_KEY')),
    notifyUrl: requiredEnv('TELEBIRR_NOTIFY_URL'),
    redirectUrl: requiredEnv('TELEBIRR_REDIRECT_URL'),
  };
}

function flattenForSignature(input: Record<string, unknown>): Record<string, string> {
  const flattened: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'sign' || key === 'sign_type' || key === 'signType' || value == null || value === '') continue;
    if (key === 'biz_content' && typeof value === 'object' && !Array.isArray(value)) {
      for (const [bizKey, bizValue] of Object.entries(value)) {
        if (bizValue != null && bizValue !== '') flattened[bizKey] = String(bizValue);
      }
    } else if (typeof value !== 'object') {
      flattened[key] = String(value);
    }
  }
  return flattened;
}

function signatureString(input: Record<string, unknown>): string {
  const flattened = flattenForSignature(input);
  return Object.keys(flattened).sort().map((key) => `${key}=${flattened[key]}`).join('&');
}

function sign(input: Record<string, unknown>, privateKey: string): string {
  return createSign('RSA-SHA256').update(signatureString(input), 'utf8').sign(privateKey, 'base64');
}

async function telebirrRequest(
  url: string,
  init: RequestInit,
): Promise<TelebirrApiResponse> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const raw = await response.text();
  let body: TelebirrApiResponse;
  try {
    body = JSON.parse(raw) as TelebirrApiResponse;
  } catch {
    throw new Error(`Telebirr returned a non-JSON response (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Telebirr request failed (HTTP ${response.status}, code ${body.code ?? 'unknown'})`);
  }
  return body;
}

async function getFabricToken(credentials: TelebirrCredentials): Promise<string> {
  const { apiBase } = TELEBIRR_ENDPOINTS[credentials.environment];
  const response = await telebirrRequest(`${apiBase}/payment/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': credentials.fabricAppId,
    },
    body: JSON.stringify({ appSecret: credentials.fabricAppSecret }),
  });
  if (!response.token) throw new Error(`Telebirr token request failed (code ${response.code ?? 'unknown'})`);
  return response.token;
}

function authorizationHeader(token: string): string {
  return /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
}

function makeNonce(): string {
  return randomBytes(16).toString('hex').toUpperCase();
}

function makeSignedOrder(input: {
  credentials: TelebirrCredentials;
  merchantOrderId: string;
  amount: string;
  title: string;
}): Record<string, unknown> {
  const { credentials, merchantOrderId, amount, title } = input;
  const order = {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce_str: makeNonce(),
    method: 'payment.preorder',
    version: '1.0',
    biz_content: {
      notify_url: credentials.notifyUrl,
      appid: credentials.merchantAppId,
      merch_code: credentials.merchantCode,
      merch_order_id: merchantOrderId,
      trade_type: 'Checkout',
      title,
      total_amount: amount,
      trans_currency: 'ETB',
      timeout_express: '120m',
      business_type: 'BuyGoods',
      payee_type: '3000',
      payee_identifier: credentials.merchantCode,
      payee_identifier_type: '04',
      redirect_url: credentials.redirectUrl,
      callback_info: 'Hyper Bingo deposit',
    },
  };
  return { ...order, sign: sign(order, credentials.privateKey), sign_type: 'SHA256WithRSA' };
}

export async function createTelebirrCheckout(input: {
  merchantOrderId: string;
  amount: number;
}): Promise<string> {
  const credentials = getTelebirrCredentials();
  const endpoints = TELEBIRR_ENDPOINTS[credentials.environment];
  const token = await getFabricToken(credentials);
  const order = makeSignedOrder({
    credentials,
    merchantOrderId: input.merchantOrderId,
    amount: input.amount.toFixed(2),
    title: 'Hyper Bingo wallet deposit',
  });
  const preOrder = await telebirrRequest(`${endpoints.apiBase}/payment/v1/merchant/preOrder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': credentials.fabricAppId,
      Authorization: authorizationHeader(token),
    },
    body: JSON.stringify(order),
  });
  const prepayId = preOrder.biz_content?.prepay_id;
  if (preOrder.result !== 'SUCCESS' || typeof prepayId !== 'string' || !prepayId) {
    throw new Error(`Telebirr order creation failed (code ${preOrder.code ?? 'unknown'})`);
  }

  const checkoutFields = {
    appid: credentials.merchantAppId,
    merch_code: credentials.merchantCode,
    nonce_str: makeNonce(),
    prepay_id: prepayId,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  const checkoutSign = sign(checkoutFields, credentials.privateKey);
  const checkoutUrl = new URL(endpoints.webBase);
  for (const [key, value] of Object.entries(checkoutFields)) checkoutUrl.searchParams.set(key, value);
  checkoutUrl.searchParams.set('sign', checkoutSign);
  checkoutUrl.searchParams.set('sign_type', 'SHA256WithRSA');
  checkoutUrl.searchParams.set('version', '1.0');
  checkoutUrl.searchParams.set('trade_type', 'Checkout');
  return checkoutUrl.toString();
}

export async function queryTelebirrOrder(merchantOrderId: string) {
  const credentials = getTelebirrCredentials();
  const endpoints = TELEBIRR_ENDPOINTS[credentials.environment];
  const token = await getFabricToken(credentials);
  const query = {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce_str: makeNonce(),
    method: 'payment.queryorder',
    version: '1.0',
    biz_content: {
      appid: credentials.merchantAppId,
      merch_code: credentials.merchantCode,
      merch_order_id: merchantOrderId,
    },
  };
  const response = await telebirrRequest(`${endpoints.apiBase}/payment/v1/merchant/queryOrder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': credentials.fabricAppId,
      Authorization: authorizationHeader(token),
    },
    body: JSON.stringify({ ...query, sign: sign(query, credentials.privateKey), sign_type: 'SHA256WithRSA' }),
  });
  const content = response.biz_content;
  if (response.result !== 'SUCCESS' || !content) {
    throw new Error(`Telebirr status query failed (code ${response.code ?? 'unknown'})`);
  }
  return {
    merchantOrderId: String(content.merch_order_id ?? ''),
    status: String(content.trade_status ?? content.order_status ?? '').toUpperCase(),
    amount: Number(content.total_amount),
    currency: String(content.trans_currency ?? ''),
    paymentOrderId: String(content.payment_order_id ?? content.trans_id ?? ''),
  };
}
