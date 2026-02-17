/**
 * Segregation of Duties (SoD) Enforcement Module
 *
 * Prevents conflicts of interest by ensuring that the person who creates
 * a financial record cannot also approve or authorize the related action.
 *
 * Built-in rules:
 *   INVOICE_PAYMENT_SEPARATION   - Invoice creator != payment approver
 *   PAYROLL_APPROVAL_SEPARATION  - Payroll creator != payroll approver
 *   VENDOR_PAYMENT_SEPARATION    - Vendor/expense creator != payment approver
 *   INVENTORY_COUNT_SEPARATION   - Inventory adjuster != stock count approver
 *
 * Rules are evaluated against real entity data via Prisma lookups.
 * Overrides are recorded in the AuditLog for traceability.
 */
import prisma from '@/lib/db';

// ============================================
// TYPES
// ============================================

/** Defines a single SoD conflict rule. */
export interface SoDRule {
  /** Unique rule identifier. */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Description of what the rule enforces. */
  description: string;
  /** The entity type the rule applies to (e.g. 'invoice', 'payrollRun'). */
  entityType: string;
  /** The action(s) that trigger this rule (e.g. 'approve_payment'). */
  actions: string[];
}

/** Result of an SoD conflict check. */
export interface SoDCheckResult {
  /** Whether the action is allowed (no conflict found). */
  allowed: boolean;
  /** If not allowed, details about the conflict. */
  conflict?: {
    /** The rule ID that was violated. */
    rule: string;
    /** The user ID that conflicts with the current user. */
    conflictingUserId: string;
    /** Human-readable description of the conflict. */
    description: string;
  };
}

/** Parameters for checking an SoD conflict. */
export interface SoDCheckParams {
  /** The user attempting the action. */
  userId: string;
  /** The action being performed (e.g. 'approve_payment', 'approve_payroll'). */
  action: string;
  /** The type of entity involved (e.g. 'invoice', 'payrollRun', 'expense', 'stockCount'). */
  entityType: string;
  /** The ID of the specific entity record. */
  entityId: string;
  /** The company scope. */
  companyId: string;
}

/** Parameters for recording an SoD override. */
export interface SoDOverrideParams {
  /** The user whose conflict is being overridden. */
  userId: string;
  /** The admin/authorized user who approved the override. */
  approvedBy: string;
  /** The SoD rule being overridden. */
  rule: string;
  /** The entity type involved. */
  entityType: string;
  /** The entity ID involved. */
  entityId: string;
  /** The company scope. */
  companyId: string;
  /** Business justification for the override. */
  reason: string;
}

// ============================================
// BUILT-IN RULES
// ============================================

export const SOD_RULES: SoDRule[] = [
  {
    id: 'INVOICE_PAYMENT_SEPARATION',
    name: 'Invoice / Payment Separation',
    description:
      'The user who created an invoice cannot approve or record a payment against that same invoice.',
    entityType: 'invoice',
    actions: ['approve_payment', 'record_payment'],
  },
  {
    id: 'PAYROLL_APPROVAL_SEPARATION',
    name: 'Payroll Approval Separation',
    description:
      'The user who created a payroll run cannot approve that same run.',
    entityType: 'payrollRun',
    actions: ['approve_payroll'],
  },
  {
    id: 'VENDOR_PAYMENT_SEPARATION',
    name: 'Vendor / Payment Separation',
    description:
      'The user who created a vendor expense cannot approve the payment for that expense.',
    entityType: 'expense',
    actions: ['approve_payment', 'approve_expense'],
  },
  {
    id: 'INVENTORY_COUNT_SEPARATION',
    name: 'Inventory Count Separation',
    description:
      'The user who performed the stock count cannot also approve it.',
    entityType: 'stockCount',
    actions: ['approve_stock_count'],
  },
];

// ============================================
// ENTITY CREATOR LOOKUPS
// ============================================

/**
 * Look up the userId that originally created the entity.
 * Returns null when the entity is not found or has no tracked creator.
 */
async function getEntityCreator(
  entityType: string,
  entityId: string,
  companyId: string,
): Promise<string | null> {
  switch (entityType) {
    case 'invoice': {
      const invoice = await prisma.invoice.findFirst({
        where: { id: entityId, companyId },
        select: { createdBy: true },
      });
      return invoice?.createdBy ?? null;
    }

    case 'payrollRun': {
      const payrollRun = await prisma.payrollRun.findFirst({
        where: { id: entityId, companyId },
        select: { createdBy: true },
      });
      return payrollRun?.createdBy ?? null;
    }

    case 'expense': {
      const expense = await prisma.expense.findFirst({
        where: { id: entityId, companyId },
        select: { createdBy: true },
      });
      return expense?.createdBy ?? null;
    }

    case 'stockCount': {
      const stockCount = await prisma.stockCount.findFirst({
        where: { id: entityId, companyId },
        select: { countedBy: true },
      });
      return stockCount?.countedBy ?? null;
    }

    default:
      return null;
  }
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check whether an action would violate a Segregation of Duties rule.
 *
 * The function finds the matching rule for the given entityType + action,
 * looks up who originally created/performed the entity, and compares
 * that userId against the current actor.
 *
 * @returns `{ allowed: true }` when no conflict exists, or
 *          `{ allowed: false, conflict: { ... } }` when a violation is detected.
 */
export async function checkSoDConflict(
  params: SoDCheckParams,
): Promise<SoDCheckResult> {
  const { userId, action, entityType, entityId, companyId } = params;

  // Find the applicable rule(s) for this entity type + action
  const matchingRule = SOD_RULES.find(
    (rule) => rule.entityType === entityType && rule.actions.includes(action),
  );

  // No rule governs this combination -- allow by default
  if (!matchingRule) {
    return { allowed: true };
  }

  // Check whether an override has already been granted for this exact case
  const existingOverride = await prisma.auditLog.findFirst({
    where: {
      companyId,
      entityType: 'sod_override',
      entityId,
      action: 'APPROVE',
      notes: { contains: matchingRule.id },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingOverride) {
    // An authorized override exists -- allow the action
    return { allowed: true };
  }

  // Look up who originally created the entity
  const creatorId = await getEntityCreator(entityType, entityId, companyId);

  // If there is no recorded creator we cannot enforce the rule -- allow
  if (!creatorId) {
    return { allowed: true };
  }

  // Conflict: the same user created the entity and is now trying to approve it
  if (creatorId === userId) {
    return {
      allowed: false,
      conflict: {
        rule: matchingRule.id,
        conflictingUserId: creatorId,
        description: matchingRule.description,
      },
    };
  }

  return { allowed: true };
}

/**
 * Record an administrative override of an SoD rule in the audit log.
 *
 * This should only be called by authorized personnel (ADMIN / OWNER) when
 * a legitimate business reason exists to bypass a duty-separation rule.
 * The override is permanently recorded so auditors can review it later.
 */
export async function overrideSoDConflict(
  params: SoDOverrideParams,
): Promise<void> {
  const { userId, approvedBy, rule, entityType, entityId, companyId, reason } =
    params;

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: approvedBy,
      action: 'APPROVE',
      entityType: 'sod_override',
      entityId,
      oldValues: {
        rule,
        originalEntityType: entityType,
        conflictingUserId: userId,
      },
      newValues: {
        rule,
        overriddenBy: approvedBy,
        reason,
      },
      changedFields: ['sod_override'],
      reason,
      notes: `SoD override for rule ${rule} on ${entityType}/${entityId}. User ${userId} was allowed to proceed. Approved by ${approvedBy}. Reason: ${reason}`,
    },
  });
}
