/**
 * POST /api/modules/retail/segments/[id]/members — Add or remove members from a segment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const membersSchema = z.object({
  action: z.enum(['add', 'remove']),
  customerIds: z.array(z.string().min(1)).min(1, 'At least one customer ID is required'),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id: segmentId } = await context.params;

    // Verify segment exists and belongs to company
    const segment = await (prisma as any).customerSegment.findFirst({
      where: { id: segmentId, companyId: companyId! },
    });
    if (!segment) return notFound('Customer segment not found');

    if (segment.type === 'AUTO') {
      return badRequest('Cannot manually modify members of an auto segment');
    }

    const body = await request.json();
    const parsed = membersSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { action, customerIds } = parsed.data;

    if (action === 'add') {
      // Verify all customers belong to this company
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds }, companyId: companyId! },
        select: { id: true },
      });

      const validIds = customers.map((c) => c.id);
      const invalidIds = customerIds.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        return badRequest(`Customers not found: ${invalidIds.join(', ')}`);
      }

      // Add members (skip duplicates)
      const existingMembers = await (prisma as any).customerSegmentMember.findMany({
        where: { segmentId, customerId: { in: validIds } },
        select: { customerId: true },
      });
      const existingCustomerIds = new Set(existingMembers.map((m: any) => m.customerId));
      const newCustomerIds = validIds.filter((id) => !existingCustomerIds.has(id));

      if (newCustomerIds.length > 0) {
        await (prisma as any).customerSegmentMember.createMany({
          data: newCustomerIds.map((customerId) => ({
            segmentId,
            customerId,
          })),
        });

        // Update member count
        await (prisma as any).customerSegment.update({
          where: { id: segmentId },
          data: { memberCount: { increment: newCustomerIds.length } },
        });
      }

      return NextResponse.json({
        added: newCustomerIds.length,
        skipped: existingCustomerIds.size,
        total: (segment.memberCount || 0) + newCustomerIds.length,
      });
    } else {
      // Remove members
      const deleteResult = await (prisma as any).customerSegmentMember.deleteMany({
        where: {
          segmentId,
          customerId: { in: customerIds },
        },
      });

      // Update member count
      if (deleteResult.count > 0) {
        await (prisma as any).customerSegment.update({
          where: { id: segmentId },
          data: { memberCount: { decrement: deleteResult.count } },
        });
      }

      return NextResponse.json({
        removed: deleteResult.count,
        total: Math.max(0, (segment.memberCount || 0) - deleteResult.count),
      });
    }
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to modify segment members');
  }
}
