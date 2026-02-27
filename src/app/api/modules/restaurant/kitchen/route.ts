/**
 * GET  /api/modules/restaurant/kitchen — Active kitchen orders (with status filter)
 * POST /api/modules/restaurant/kitchen — Create kitchen order
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:kitchen:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING, PREPARING, READY, SERVED, CANCELLED
    const priority = searchParams.get('priority');
    const orderType = searchParams.get('orderType');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    // Default: show active orders (not served/cancelled) unless specific status requested
    const statusFilter = status
      ? { status }
      : { status: { in: ['PENDING', 'PREPARING', 'READY'] } };

    const where: any = {
      companyId: companyId!,
      ...statusFilter,
      ...(priority ? { priority } : {}),
      ...(orderType ? { orderType } : {}),
    };

    const orders = await (prisma as any).kitchenOrder.findMany({
      where,
      take: limit,
      orderBy: [
        { priority: 'desc' }, // RUSH > HIGH > NORMAL > LOW
        { sentToKitchenAt: 'asc' }, // Oldest first
      ],
      include: {
        items: {
          include: { menuItem: { select: { id: true, name: true, prepTime: true } } },
          orderBy: { course: 'asc' },
        },
        tableSession: {
          select: {
            id: true,
            guestCount: true,
            table: { select: { id: true, number: true, section: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: orders });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list kitchen orders');
  }
}

const kitchenOrderItemSchema = z.object({
  menuItemId: z.string().optional(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).default(1),
  modifiers: z.any().optional(),
  specialNotes: z.string().max(500).optional(),
  course: z.enum(['APPETIZER', 'MAIN', 'DESSERT', 'DRINK', 'SIDE']).default('MAIN'),
});

const createKitchenOrderSchema = z.object({
  tableSessionId: z.string().optional(),
  posOrderId: z.string().optional(),
  serverId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH']).default('NORMAL'),
  orderType: z.enum(['DINE_IN', 'TAKEOUT', 'DELIVERY']).default('DINE_IN'),
  notes: z.string().max(500).optional(),
  items: z.array(kitchenOrderItemSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:kitchen:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createKitchenOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Get next order number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastOrder = await (prisma as any).kitchenOrder.findFirst({
      where: { companyId: companyId!, sentToKitchenAt: { gte: today } },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    const order = await (prisma as any).kitchenOrder.create({
      data: {
        companyId: companyId!,
        tableSessionId: parsed.data.tableSessionId || null,
        posOrderId: parsed.data.posOrderId || null,
        serverId: parsed.data.serverId || null,
        orderNumber,
        priority: parsed.data.priority,
        orderType: parsed.data.orderType,
        notes: parsed.data.notes || null,
        status: 'PENDING',
        items: {
          create: parsed.data.items.map((item) => ({
            menuItemId: item.menuItemId || null,
            name: item.name,
            quantity: item.quantity,
            modifiers: item.modifiers || null,
            specialNotes: item.specialNotes || null,
            course: item.course,
            status: 'PENDING',
          })),
        },
      },
      include: {
        items: {
          include: { menuItem: { select: { id: true, name: true, prepTime: true } } },
        },
        tableSession: {
          select: {
            id: true,
            table: { select: { id: true, number: true, section: true } },
          },
        },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create kitchen order');
  }
}
