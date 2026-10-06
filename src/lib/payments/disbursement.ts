/**
 * Disbursement Service — ArifPay
 *
 * Routes withdrawal payouts to ArifPay.
 *
 * Usage (from admin withdrawal-approval handler):
 *   const result = await disburse({ ... });
 *   if (result.success) { mark withdrawal COMPLETED }
 *   else                { mark withdrawal FAILED, refund balance }
 *
 * Required env: ARIFPAY_API_KEY
 */

import { arifPayDisburse } from './arifpay';
import { PaymentProvider } from '@/lib/types';

export interface DisburseParams {
  /** Withdrawal record ID — used as the unique payout nonce */
  withdrawalId: string;
  /** Player's full legal name */
  accountName: string;
  /** Telebirr phone (+2519…) or bank account number */
  accountNumber: string;
  /** ETB */
  amount: number;
  paymentMethod: PaymentProvider;
  /** Bank code — required for Bank Transfer payouts */
  bankCode?: string;
}

export interface DisburseResult {
  success: boolean;
  gatewayUsed: string;
  gatewayTxId?: string;
  message?: string;
}

/**
 * Map a PaymentProvider to an ArifPay disbursement channel string.
 */
function toArifPayChannel(method: PaymentProvider): string {
  switch (method) {
    case 'Telebirr':      return 'TELEBIRR';
    case 'CBE Birr':      return 'CBE';
    case 'M-Pesa':        return 'MPESA';
    case 'Bank Transfer': return 'BANK';
    default:              return 'TELEBIRR';
  }
}

/**
 * Disburse an approved withdrawal via ArifPay.
 */
export async function disburse(params: DisburseParams): Promise<DisburseResult> {
  const nonce = `WDR_${params.withdrawalId}_${Date.now()}`;

  try {
    const res = await arifPayDisburse({
      nonce,
      receiverName:  params.accountName,
      accountNumber: params.accountNumber,
      amount:        params.amount,
      channel:       toArifPayChannel(params.paymentMethod),
      bankCode:      params.bankCode,
      description:   `Hyper Bingo withdrawal #${params.withdrawalId}`,
    });

    if (res.success) {
      return {
        success:      true,
        gatewayUsed:  'ArifPay',
        gatewayTxId:  res.transactionId,
      };
    }

    console.error('[Disburse] ArifPay failed:', res.message);
    return {
      success:     false,
      gatewayUsed: 'ArifPay',
      message:     res.message ?? 'ArifPay disbursement failed. Check account balance and API credentials.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Disburse] ArifPay exception:', msg);
    return {
      success:     false,
      gatewayUsed: 'ArifPay',
      message:     msg,
    };
  }
}
