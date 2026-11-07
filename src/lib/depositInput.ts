import type { PaymentProvider } from './types';

function extractHttpsUrl(input: string): string | null {
  const urls = input.match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const rawUrl of urls) {
    const candidate = rawUrl
      .replace(/^[([{<]+/, '')
      .replace(/[)\]}>.,;!?]+$/, '');
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:') return parsed.toString();
    } catch {
      // Ignore non-URL text and keep looking for a receipt link.
    }
  }
  return null;
}

function normalizeReference(value: string): string {
  return value.toUpperCase().replace(/[\s_-]/g, '');
}

/** Accepts a raw reference, a receipt URL, or a copied bank/wallet message. */
export function extractDepositInput(input: string, provider?: PaymentProvider): string {
  const text = input.trim();
  if (!text) return '';

  const receiptUrl = extractHttpsUrl(text);
  if (receiptUrl) return receiptUrl;

  const isTelebirr = !provider || provider === 'Telebirr';
  const directCode = normalizeReference(text);
  if (isTelebirr && /^[A-Z0-9]{8,16}$/.test(directCode)) return directCode;
  if (!isTelebirr && /^(FT[0-9A-Z]{6,16}|[0-9A-Z]{6,20})$/.test(directCode)) return directCode;

  const labeledReference = text.match(
    /(?:transaction\s*(?:reference|id|code|no\.?|number)|receipt\s*(?:reference|id|no\.?|number)|reference(?:\s*(?:no\.?|number|#))?|ref(?:\s*(?:no\.?|#))?|FT\s*(?:reference|number)|RRN)\s*[:#=\-]?\s*([A-Z0-9]{6,24})/i,
  )?.[1];
  if (labeledReference) {
    const reference = normalizeReference(labeledReference);
    if (isTelebirr && /^[A-Z0-9]{8,16}$/.test(reference)) return reference;
    if (!isTelebirr && /^(FT[0-9A-Z]{6,16}|[0-9A-Z]{6,20})$/.test(reference)) return reference;
  }

  // Preserve support for CBE FT references embedded in copied notification text.
  if (!isTelebirr) {
    const ftReference = text.match(/\bFT[0-9A-Z]{6,16}\b/i)?.[0];
    if (ftReference) return normalizeReference(ftReference);
  }

  return '';
}
