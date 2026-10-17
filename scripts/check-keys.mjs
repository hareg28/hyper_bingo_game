import fs from 'node:fs';
import crypto from 'node:crypto';

// Load .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eqIdx = t.indexOf('=');
  if (eqIdx !== -1) {
    const key = t.slice(0, eqIdx).trim();
    let val = t.slice(eqIdx + 1).trim();
    while ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    val = val.replace(/\\n/g, '\n').replace(/\\r/g, '');
    process.env[key] = val;
  }
}

const privKeyPem = process.env.PRIVATE_KEY;
console.log('Private key PEM (first 60):', privKeyPem?.slice(0, 60));

try {
  const kp = crypto.createPrivateKey(privKeyPem);
  const pub = crypto.createPublicKey(kp);
  const pubDer = pub.export({ type: 'spki', format: 'der' });
  console.log('\nDerived PUBLIC KEY (base64 - upload this to Telebirr portal):');
  console.log(pubDer.toString('base64'));

  const pubPem = pub.export({ type: 'spki', format: 'pem' });
  console.log('\nPublic Key PEM:');
  console.log(pubPem);

  if (fs.existsSync('public_key.pem')) {
    const existingPub = fs.readFileSync('public_key.pem', 'utf8');
    console.log('\nExisting public_key.pem:\n', existingPub.slice(0, 200));

    // Compare
    const existingKey = crypto.createPublicKey(existingPub);
    const existingDer = existingKey.export({ type: 'spki', format: 'der' });
    console.log('\nKeys match:', pubDer.equals(existingDer) ? 'YES ✅' : 'NO ❌ - Different key pairs!');
  }
} catch(e) {
  console.error('Error:', e.message);
}
