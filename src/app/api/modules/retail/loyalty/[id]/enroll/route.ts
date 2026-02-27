/**
 * POST /api/modules/retail/loyalty/[id]/enroll — Enroll a customer in a loyalty program
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, notFound, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const enrollSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  cardNumber: z.string().max(50).nullable().optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).default('BRONZE'),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const { id: loyaltyProgramId } = await context.params;

    // Verify program exists and is active
    const program = await (prisma as any).loyaltyProgram.findFirst({
      where: { id: loyaltyProgramId, companyId: companyId!, isActive: true },
    });
    if (!program) return notFound('Loyalty program not found or inactive');

    const body = await request.json();
    const parsed = enrollSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { customerId, cardNumber, tier } = parsed.data;

    // Verify customer exists and belongs to this company
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: companyId! },
    });
    if (!customer) return notFound('Customer not found');

    // Check if already enrolled
    const existingMember = await (prisma as any).loyaltyMember.findFirst({
      where: { companyId: companyId!, loyaltyProgramId, customerId },
    });
    if (existingMember) return conflict('Customer is already enrolled in this loyalty program');

    // Generate a card number if not provided
    const generatedCardNumber = cardNumber || `LM-${Date.now().toString(36).toUpperCase()}`;

    const member = await (prisma as any).loyaltyMember.create({
      data: {
        companyId: companyId!,
        customerId,
        loyaltyProgramId,
        cardNumber: generatedCardNumber,
        tier,
        pointsBalance: 0,
        lifetimePoints: 0,
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        loyaltyProgram: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to enroll customer');
  }
}
