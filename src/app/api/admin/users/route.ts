import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const [stats, users] = await Promise.all([
      db.getPlatformStats(),
      db.getAllUsers(),
    ]);

    // Attach wallet balance for each user
    const usersWithBalance = await Promise.all(
      users.map(async (u) => {
        const wallet = await db.getWallet(u.id);
        return {
          ...u,
          balance: wallet.balance,
          bonusBalance: wallet.bonusBalance,
          totalDeposited: wallet.totalDeposited,
          totalWithdrawn: wallet.totalWithdrawn,
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats,
      users: usersWithBalance,
    });
  } catch (error: any) {
    console.error('Error fetching admin users/stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
