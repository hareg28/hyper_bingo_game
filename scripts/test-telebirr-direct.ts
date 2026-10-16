import fs from 'node:fs';
import path from 'node:path';

// Preload .env.local
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

import { createTelebirrCheckout, queryTelebirrOrder } from '../src/lib/payments/telebirr';

async function main() {
  console.log('--- Testing Telebirr module directly from src/lib/payments/telebirr.ts ---');
  const merchantOrderId = `HB${Date.now()}TEST`;
  const amount = 50.00;

  console.log(`1. Creating Telebirr Checkout for ${merchantOrderId} (ETB ${amount})...`);
  const checkoutUrl = await createTelebirrCheckout({
    merchantOrderId,
    amount,
  });

  console.log('SUCCESS! Checkout URL generated:');
  console.log(checkoutUrl);

  console.log(`\n2. Querying Telebirr Order for ${merchantOrderId}...`);
  const orderStatus = await queryTelebirrOrder(merchantOrderId);
  console.log('SUCCESS! Query Order result:');
  console.dir(orderStatus, { depth: null });
}

main().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
