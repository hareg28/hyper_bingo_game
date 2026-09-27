import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

// GET /api/admin/deposits - List all pending deposits for admin review
export async function GET() {
  try {
    const deposits = await db.getPendingDeposits();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: deposits,
    });
  } catch (err: unknown) {
    console.error('Error fetching pending deposits:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch deposits',
    }, { status: 500 });
  }
}

// POST /api/admin/deposits - Approve or Reject a pending deposit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, action } = body as {
      transactionId: string;
      action: 'APPROVE' | 'REJECT';
      adminName?: string;
    };

    if (!transactionId || !action) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'transactionId and action (APPROVE/REJECT) are required',
      }, { status: 400 });
    }

    if (action === 'APPROVE') {
      const tx = await db.approvePendingDeposit(transactionId);
      if (!tx) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Deposit transaction not found or already processed',
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse>({
        success: true,
        data: tx,
        message: `Deposit of ${tx.amount} ETB approved and credited successfully.`,
      });
    } else {
      const tx = await db.rejectPendingDeposit(transactionId);
      if (!tx) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Deposit transaction not found',
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse>({
        success: true,
        data: tx,
        message: 'Deposit rejected.',
      });
    }
  } catch (err: unknown) {
    console.error('Error processing deposit action:', err);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
