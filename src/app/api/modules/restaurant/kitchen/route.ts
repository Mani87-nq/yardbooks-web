/**
 * GET   /api/modules/restaurant/kitchen — Active kitchen orders (with status filter)
 * POST  /api/modules/restaurant/kitchen — Create kitchen order
 * PATCH /api/modules/restaurant/kitchen — Update order status (advance workflow)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

/**
 * Serialize a Prisma Json modifiers value into a human-readable comma-separated string.
 * Handles arrays of strings, arrays of objects with a `name` key, plain objects, and primitives.
 * Returns null for null/undefined input.
 */
function formatModifiers(modifiers: unknown): string | null {
  if (modifiers == null) return null;

  if (Array.isArray(modifiers)) {
    const parts = modifiers.map((m) => {
      if (typeof m === 'string') return m;
      if (m && typeof m === 'object' && 'name' in m) return String(m.name);
      return String(m);
    });
    return parts.length > 0 ? parts.join(', ') : null;
  }

  if (typeof modifiers === 'object') {
    // e.g. { "Size": "Large", "Extra": "Cheese" } → "Size: Large, Extra: Cheese"
    const entries = Object.entries(modifiers as Record<string, unknown>);
    if (entries.length === 0) return null;
    return entries.map(([key, val]) => `${key}: ${val}`).join(', ');
  }

  return String(modifiers);
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:kitchen:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

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

    // Transform DB records to match the front-end KitchenOrder contract
    const transformed = orders.map((order: any) => {
      const tableNumber = order.tableSession?.table?.number
        ? Number(order.tableSession.table.number)
        : null;

      return {
        ...order,
        // 1. Map DB status → FE status
        status: REVERSE_STATUS_MAP[order.status] ?? order.status,
        // 2. Flatten table info
        tableNumber,
        tableName: tableNumber != null ? `Table ${tableNumber}` : null,
        // 3. Rename notes → specialInstructions
        specialInstructions: order.notes ?? null,
        // 4. Transform items
        items: order.items.map((item: any) => ({
          ...item,
          // 5. Rename specialNotes → notes
          notes: item.specialNotes ?? null,
          // 6. Serialize modifiers (Json) to readable string
          modifiers: formatModifiers(item.modifiers),
        })),
      };
    });

    return NextResponse.json({ data: transformed });
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
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

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

// ---- PATCH (Update order status) ----

const patchKitchenOrderSchema = z.object({
  orderId: z.string().min(1),
  status: z.string().min(1),
});

/**
 * Reverse map: DB status → front-end status for GET responses.
 * The database uses:   PENDING, PREPARING, READY, SERVED, CANCELLED
 * The kitchen UI uses: NEW, IN_PROGRESS, READY, COMPLETED
 */
const REVERSE_STATUS_MAP: Record<string, string> = {
  PENDING: 'NEW',
  PREPARING: 'IN_PROGRESS',
  READY: 'READY',
  SERVED: 'COMPLETED',
};

/**
 * Map front-end status names to database status values.
 * The kitchen UI uses: NEW, IN_PROGRESS, READY, COMPLETED
 * The database uses:   PENDING, PREPARING, READY, SERVED, CANCELLED
 */
const STATUS_MAP: Record<string, string> = {
  NEW: 'PENDING',
  IN_PROGRESS: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'SERVED',
  // Also accept the DB-native values directly
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED',
};

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:kitchen:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = patchKitchenOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { orderId, status: rawStatus } = parsed.data;
    const dbStatus = STATUS_MAP[rawStatus] || rawStatus;

    // Verify the order belongs to this company
    const existing = await (prisma as any).kitchenOrder.findFirst({
      where: { id: orderId, companyId: companyId! },
    });
    if (!existing) {
      return badRequest('Kitchen order not found');
    }

    // Build timestamp updates based on status transition
    const timestamps: Record<string, Date> = {};
    if (dbStatus === 'PREPARING' && !existing.startedAt) {
      timestamps.startedAt = new Date();
    }
    if (dbStatus === 'READY' && !existing.readyAt) {
      timestamps.readyAt = new Date();
    }
    if (dbStatus === 'SERVED' && !existing.servedAt) {
      timestamps.servedAt = new Date();
    }

    const updated = await (prisma as any).kitchenOrder.update({
      where: { id: orderId },
      data: {
        status: dbStatus,
        ...timestamps,
      },
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

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update kitchen order');
  }
}
