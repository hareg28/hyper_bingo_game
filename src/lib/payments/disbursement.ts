/**
 * Disbursement Service — Chapa
 *
 * Routes withdrawal payouts to Chapa (Ethiopian payment gateway).
 * Required env: CHAPA_SECRET_KEY
 *
 * Usage (from /api/admin/withdrawals on APPROVE action):
 *   const result = await disburse({ ... });
 *   if (result.success) { mark withdrawal COMPLETED }
 *   else                { mark withdrawal FAILED, refund balance }
 */

import { chapaSendTransfer } from './chapa';
import { PaymentProvider } from '@/lib/types';

export interface DisburseParams {
  /** Withdrawal record ID — used as payout reference */
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
 * Disburse an approved withdrawal via Chapa.
 */
export async function disburse(params: DisburseParams): Promise<DisburseResult> {
  const reference = `WDR_${params.withdrawalId}_${Date.now()}`;

  try {
    const res = await chapaSendTransfer({
      account_name:    params.accountName,
      account_number:  params.accountNumber,
      amount:          params.amount,
      currency:        'ETB',
      beneficiary_name: params.accountName,
      reference,
      ...(params.bankCode ? { bank_code: params.bankCode } : {}),
    });

    if (res.status === 'success') {
      return {
        success:     true,
        gatewayUsed: 'Chapa',
        gatewayTxId: reference,
      };
    }

    console.error('[Disburse] Chapa transfer failed:', res.message);
    return {
      success:     false,
      gatewayUsed: 'Chapa',
      message:     res.message ?? 'Chapa disbursement failed. Check API credentials and account balance.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Disburse] Chapa exception:', msg);
    return {
      success:     false,
      gatewayUsed: 'Chapa',
      message:     msg,
    };
  }
}
