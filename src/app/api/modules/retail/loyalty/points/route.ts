/**
 * POST /api/modules/retail/loyalty/points — Award, redeem, or adjust loyalty points
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

const pointsTransactionSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  type: z.enum(['EARN', 'REDEEM', 'ADJUST']),
  points: z.int().min(1, 'Points must be at least 1'),
  description: z.string().max(500).nullable().optional(),
  orderId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = pointsTransactionSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { memberId, type, points, description, orderId } = parsed.data;

    // Verify member exists and belongs to this company
    const member = await (prisma as any).loyaltyMember.findFirst({
      where: { id: memberId, companyId: companyId! },
      include: { loyaltyProgram: true },
    });
    if (!member) return notFound('Loyalty member not found');

    // Calculate new balance
    let newBalance: number;
    let lifetimeAdd = 0;

    switch (type) {
      case 'EARN':
        newBalance = member.pointsBalance + points;
        lifetimeAdd = points;
        break;
      case 'REDEEM':
        if (member.pointsBalance < points) {
          return badRequest(`Insufficient points. Current balance: ${member.pointsBalance}, requested: ${points}`);
        }
        newBalance = member.pointsBalance - points;
        break;
      case 'ADJUST':
        // Adjust can go positive or negative; the points value is the absolute delta.
        // For negative adjustments, check balance.
        newBalance = member.pointsBalance + points;
        if (newBalance < 0) {
          return badRequest('Adjustment would result in negative balance');
        }
        if (points > 0) lifetimeAdd = points;
        break;
      default:
        return badRequest('Invalid transaction type');
    }

    // Use a transaction to ensure atomicity
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Create transaction record
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          companyId: companyId!,
          loyaltyProgramId: member.loyaltyProgramId,
          memberId,
          orderId: orderId || null,
          type,
          points: type === 'REDEEM' ? -points : points,
          balanceAfter: newBalance,
          description: description || `${type} ${points} points`,
        },
      });

      // Update member balance
      const updatedMember = await tx.loyaltyMember.update({
        where: { id: memberId },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: { increment: lifetimeAdd },
          lastActivityAt: new Date(),
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          loyaltyProgram: { select: { id: true, name: true } },
        },
      });

      return { transaction, member: updatedMember };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to process points transaction');
  }
}
