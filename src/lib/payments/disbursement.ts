/**
 * Disbursement Service — ArifPay
 *
 * Routes withdrawal payouts to ArifPay (Ethiopian payment gateway).
 * Required env: ARIFPAY_API_KEY
 *
 * Usage (from /api/admin/withdrawals on APPROVE action):
 *   const result = await disburse({ ... });
 *   if (result.success) { mark withdrawal COMPLETED }
 *   else                { mark withdrawal FAILED, refund balance }
 */

import { arifPayDisburse } from './arifpay';
import { PaymentProvider } from '@/lib/types';

export interface DisburseParams {
  /** Withdrawal record ID — used as payout nonce */
  withdrawalId: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  paymentMethod: PaymentProvider;
  bankCode?: string;
}

export interface DisburseResult {
  success: boolean;
  gatewayUsed: string;
  gatewayTxId?: string;
  message?: string;
}

/**
 * Map PaymentProvider to ArifPay channel string.
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
        gatewayTxId:  res.transactionId ?? nonce,
      };
    }

    console.error('[Disburse] ArifPay failed:', res.message);
    return {
      success:     false,
      gatewayUsed: 'ArifPay',
      message:     res.message ?? 'ArifPay disbursement failed. Check API credentials and account balance.',
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
