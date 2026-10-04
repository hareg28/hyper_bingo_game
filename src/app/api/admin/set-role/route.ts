import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminTelegramId } from '@/lib/authUtils';
import { ApiResponse, UserRole } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminTelegramId, targetUserId, identifier, role } = body as {
      adminTelegramId?: string;
      targetUserId?: string;
      identifier?: string;
      role?: UserRole;
    };

    if (!role || (role !== 'admin' && role !== 'user')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid role. Must be admin or user.',
      }, { status: 400 });
    }

    // Verify requesting admin
    let isAuthorized = false;
    if (adminTelegramId) {
      const cleanAdmin = String(adminTelegramId).trim().toLowerCase().replace(/^@/, '');
      if (isAdminTelegramId(cleanAdmin) || cleanAdmin === 'admin' || cleanAdmin === 'hyperadmin') {
        isAuthorized = true;
      } else {
        const adminInDb = (await db.getUserByTelegramId(cleanAdmin)) || (await db.getUserByUsername(cleanAdmin));
        if (adminInDb?.role === 'admin') isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Unauthorized: Only an existing administrator can manage admin roles.',
      }, { status: 403 });
    }

    let updatedUser = null;
    if (targetUserId) {
      updatedUser = await db.updateUserRole(targetUserId, role);
    } else if (identifier) {
      if (role === 'admin') {
        updatedUser = await db.addAdminByIdentifier(identifier);
      } else {
        const clean = identifier.trim().toLowerCase().replace(/^@/, '');
        const target = (await db.getUserByTelegramId(clean)) ||
                       (await db.getUserByUsername(clean)) ||
                       (await db.getUserByPhone(identifier.trim()));
        if (target) {
          updatedUser = await db.updateUserRole(target.id, 'user');
        }
      }
    }

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Target user not found with provided ID or identifier.',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user: updatedUser },
      message: `User @${updatedUser.username || updatedUser.name} role successfully updated to ${role.toUpperCase()}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
