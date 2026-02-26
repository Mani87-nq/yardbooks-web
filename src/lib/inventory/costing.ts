/**
 * Inventory Costing Engine — Weighted Average Method
 *
 * Calculates COGS and updates average cost for inventory movements.
 * Supports: PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT.
 *
 * Weighted Average Formula:
 *   newAvgCost = (existingQty * oldAvgCost + newQty * newUnitCost) / (existingQty + newQty)
 */
import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';

// ── Types ──

export type MovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface StockMovementInput {
  companyId: string;
  productId: string;
  movementType: MovementType;
  quantity: number;       // Positive for incoming, positive for outgoing (we negate internally for SALE/TRANSFER_OUT)
  unitCost: number;       // Cost per unit for this movement
  referenceType?: string; // GRN, POS_ORDER, INVOICE, ADJUSTMENT, TRANSFER
  referenceId?: string;
  description?: string;
  createdBy?: string;
}

export interface StockMovementResult {
  success: boolean;
  error?: string;
  movement?: {
    id: string;
    avgCostAfter: number;
    qtyAfter: number;
    totalCost: number;
  };
}

/**
 * Record a stock movement and update the product's average cost and quantity.
 *
 * For incoming movements (PURCHASE, RETURN, TRANSFER_IN, positive ADJUSTMENT):
 *   - Recalculates weighted average cost
 *   - Increases stock quantity
 *
 * For outgoing movements (SALE, TRANSFER_OUT, negative ADJUSTMENT):
 *   - Uses current average cost for COGS
 *   - Decreases stock quantity
 *   - Does NOT allow negative stock (returns error)
 */
export async function recordStockMovement(
  input: StockMovementInput,
  tx?: Prisma.TransactionClient,
): Promise<StockMovementResult> {
  const db = tx || prisma;

  try {
    // Get current product state
    const product = await db.product.findFirst({
      where: { id: input.productId, companyId: input.companyId },
      select: {
        id: true,
        quantity: true,
        averageCost: true,
        costPrice: true,
        costingMethod: true,
      },
    });

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const currentQty = Number(product.quantity);
    const currentAvgCost = Number(product.averageCost) || Number(product.costPrice) || 0;

    // Determine if this is an incoming or outgoing movement
    const isIncoming = ['PURCHASE', 'RETURN', 'TRANSFER_IN'].includes(input.movementType)
      || (input.movementType === 'ADJUSTMENT' && input.quantity > 0);

    let movementQty: number; // positive for in, negative for out
    let newAvgCost: number;
    let newQty: number;
    let totalCost: number;

    if (isIncoming) {
      // ── INCOMING: recalculate weighted average ──
      movementQty = Math.abs(input.quantity);
      const existingValue = currentQty * currentAvgCost;
      const incomingValue = movementQty * input.unitCost;

      newQty = currentQty + movementQty;
      newAvgCost = newQty > 0
        ? (existingValue + incomingValue) / newQty
        : input.unitCost; // If stock was 0, use the incoming cost

      totalCost = incomingValue;
    } else {
      // ── OUTGOING: use current average cost ──
      movementQty = -Math.abs(input.quantity);
      const outQty = Math.abs(input.quantity);

      if (outQty > currentQty) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${currentQty}, requested: ${outQty}`,
        };
      }

      newQty = currentQty - outQty;
      newAvgCost = currentAvgCost; // Average cost doesn't change on outgoing
      totalCost = outQty * currentAvgCost; // COGS
    }

    // Round values
    newAvgCost = Math.round(newAvgCost * 10000) / 10000;
    newQty = Math.round(newQty * 10000) / 10000;
    totalCost = Math.round(totalCost * 100) / 100;

    // Create movement record
    const movement = await db.stockMovement.create({
      data: {
        companyId: input.companyId,
        productId: input.productId,
        movementType: input.movementType,
        quantity: movementQty,
        unitCost: input.unitCost,
        totalCost: Math.abs(totalCost),
        avgCostAfter: newAvgCost,
        qtyAfter: newQty,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        createdBy: input.createdBy,
      },
    });

    // Update product
    await db.product.update({
      where: { id: product.id },
      data: {
        quantity: newQty,
        averageCost: newAvgCost,
        // Also update costPrice if this is a purchase (keeps costPrice aligned)
        ...(input.movementType === 'PURCHASE' ? { costPrice: input.unitCost } : {}),
      },
    });

    return {
      success: true,
      movement: {
        id: movement.id,
        avgCostAfter: newAvgCost,
        qtyAfter: newQty,
        totalCost,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record stock movement',
    };
  }
}

/**
 * Calculate COGS for a sale using the product's current average cost.
 * Does NOT record a movement — use recordStockMovement for that.
 */
export function calculateCOGS(
  currentAvgCost: number,
  quantity: number,
): number {
  return Math.round(currentAvgCost * quantity * 100) / 100;
}

/**
 * Bulk stock valuation — sum of (quantity * averageCost) for all active products.
 */
export async function getStockValuation(
  companyId: string,
): Promise<{
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  byCategory: { category: string; itemCount: number; totalValue: number }[];
}> {
  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      quantity: { gt: 0 },
    },
    select: {
      id: true,
      quantity: true,
      averageCost: true,
      costPrice: true,
      category: true,
    },
  });

  let totalQuantity = 0;
  let totalValue = 0;
  const categoryMap = new Map<string, { itemCount: number; totalValue: number }>();

  for (const product of products) {
    const qty = Number(product.quantity);
    const avgCost = Number(product.averageCost) || Number(product.costPrice) || 0;
    const value = qty * avgCost;

    totalQuantity += qty;
    totalValue += value;

    const cat = product.category || 'Uncategorized';
    const existing = categoryMap.get(cat) ?? { itemCount: 0, totalValue: 0 };
    existing.itemCount += 1;
    existing.totalValue += value;
    categoryMap.set(cat, existing);
  }

  return {
    totalItems: products.length,
    totalQuantity: Math.round(totalQuantity * 10000) / 10000,
    totalValue: Math.round(totalValue * 100) / 100,
    byCategory: Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        itemCount: data.itemCount,
        totalValue: Math.round(data.totalValue * 100) / 100,
      }))
      .sort((a, b) => b.totalValue - a.totalValue),
  };
}
