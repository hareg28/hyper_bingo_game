import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load .env.local
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    while (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Handle escaped newlines in env vars
    val = val.replace(/\\n/g, '\n').replace(/\\r/g, '');
    process.env[key] = val;
  }
}

const FABRIC_APP_ID = process.env.FABRIC_APP_ID;
const FABRIC_APP_SECRET = process.env.FABRIC_APP_SECRET;
const MERCHANT_APP_ID = process.env.MERCHANT_APP_ID;
const MERCHANT_CODE = process.env.MERCHANT_CODE;
const PRIVATE_KEY_RAW = process.env.PRIVATE_KEY;

console.log('FABRIC_APP_ID:', FABRIC_APP_ID);
console.log('MERCHANT_APP_ID:', MERCHANT_APP_ID);
console.log('MERCHANT_CODE:', MERCHANT_CODE);
console.log('PRIVATE_KEY starts with:', PRIVATE_KEY_RAW?.slice(0, 30));

// Normalize PEM
function normalizePem(raw) {
  let str = raw.trim();
  while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  str = str.replace(/\\r\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
  if (str.includes('-----BEGIN')) {
    const match = str.match(/-----BEGIN[^-]+-----(.+?)-----END[^-]+-----/s);
    if (match) {
      const headerMatch = str.match(/(-----BEGIN[^-]+-----)/);
      const footerMatch = str.match(/(-----END[^-]+-----)/);
      const header = headerMatch ? headerMatch[1] : '-----BEGIN PRIVATE KEY-----';
      const footer = footerMatch ? footerMatch[1] : '-----END PRIVATE KEY-----';
      const body = match[1].replace(/\s+/g, '');
      const chunks = body.match(/.{1,64}/g)?.join('\n') ?? body;
      return `${header}\n${chunks}\n${footer}`;
    }
    return str;
  }
  const cleanBase64 = str.replace(/\s+/g, '');
  const chunks = cleanBase64.match(/.{1,64}/g)?.join('\n') ?? cleanBase64;
  return `-----BEGIN PRIVATE KEY-----\n${chunks}\n-----END PRIVATE KEY-----`;
}

const privateKey = normalizePem(PRIVATE_KEY_RAW);
console.log('\nNormalized PEM (first line):', privateKey.split('\n')[0]);

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers,
      rejectUnauthorized: false,
      timeout: 20000,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', err => reject(new Error(`Request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function flattenForSignature(input) {
  const flattened = {};
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

function sign(input, privateKey) {
  const flattened = flattenForSignature(input);
  const str = Object.keys(flattened).sort().map(k => `${k}=${flattened[k]}`).join('&');
  console.log('Signing string:', str.slice(0, 100) + '...');
  return crypto.createSign('RSA-SHA256').update(str, 'utf8').sign(privateKey, 'base64');
}

const BASE = 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway';

async function main() {
  // Step 1: Get token
  console.log('\n--- Step 1: Get Fabric Token ---');
  const tokenRes = await makeRequest(
    `${BASE}/payment/v1/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-APP-Key': FABRIC_APP_ID } },
    JSON.stringify({ appSecret: FABRIC_APP_SECRET })
  );
  console.log('Token response:', JSON.stringify(tokenRes).slice(0, 200));
  if (!tokenRes.token) throw new Error('No token received');
  const token = tokenRes.token;

  // Step 2: PreOrder
  console.log('\n--- Step 2: PreOrder ---');
  const merchantOrderId = `HB${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const order = {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce_str: crypto.randomBytes(16).toString('hex').toUpperCase(),
    method: 'payment.preorder',
    version: '1.0',
    biz_content: {
      appid: MERCHANT_APP_ID,
      business_type: 'BuyGoods',
      merch_code: MERCHANT_CODE,
      merch_order_id: merchantOrderId,
      notify_url: 'https://bingo-game-rho-five.vercel.app/api/payments/telebirr/notify',
      redirect_url: 'https://bingo-game-rho-five.vercel.app/api/payments/telebirr/return',
      timeout_express: '120m',
      title: 'Hyper Bingo wallet deposit',
      total_amount: '50.00',
      trade_type: 'Checkout',
      trans_currency: 'ETB',
    },
  };
  const orderWithSign = { ...order, sign: sign(order, privateKey), sign_type: 'SHA256WithRSA' };
  const preOrderRes = await makeRequest(
    `${BASE}/payment/v1/merchant/preOrder`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APP-Key': FABRIC_APP_ID, Authorization: `Bearer ${token}` },
    },
    JSON.stringify(orderWithSign)
  );
  console.log('PreOrder response:', JSON.stringify(preOrderRes).slice(0, 500));

  if (preOrderRes.result === 'SUCCESS' && preOrderRes.biz_content?.prepay_id) {
    console.log('\n✅ PreOrder SUCCESS! prepay_id:', preOrderRes.biz_content.prepay_id);
    const WEB_BASE = 'https://developerportal.ethiotelebirr.et:38443/payment/web/paygate';
    const checkoutFields = {
      appid: MERCHANT_APP_ID,
      merch_code: MERCHANT_CODE,
      nonce_str: crypto.randomBytes(16).toString('hex').toUpperCase(),
      prepay_id: preOrderRes.biz_content.prepay_id,
      timestamp: Math.floor(Date.now() / 1000).toString(),
    };
    const checkoutSign = sign(checkoutFields, privateKey);
    const url = new URL(WEB_BASE);
    for (const [k, v] of Object.entries(checkoutFields)) url.searchParams.set(k, v);
    url.searchParams.set('sign', checkoutSign);
    url.searchParams.set('sign_type', 'SHA256WithRSA');
    url.searchParams.set('version', '1.0');
    url.searchParams.set('trade_type', 'Checkout');
    console.log('\n🔗 Checkout URL:\n', url.toString());
  } else {
    console.log('\n❌ PreOrder failed:', JSON.stringify(preOrderRes));
  }
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
