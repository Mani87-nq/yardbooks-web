/**
 * Typed Event Bus for inter-module communication.
 *
 * Design:
 *   - Modules never import from each other directly.  They communicate
 *     by publishing and subscribing to typed events through this bus.
 *   - Sync handlers run inside the emitter's call stack (same transaction).
 *   - Async handlers are fire-and-forget: queued and flushed after the
 *     request completes so they never block the emitter.
 *
 * Usage (subscribe):
 *   import { eventBus } from '@/modules/event-bus';
 *   eventBus.on('invoice.paid', async (payload) => { ... });
 *
 * Usage (emit):
 *   await eventBus.emit('invoice.paid', { invoiceId, companyId, ... });
 */

// ============================================
// CORE EVENT MAP
// ============================================

/**
 * Exhaustive map of core events and their payload shapes.
 * Module-specific events use the `{moduleId}.{entity}.{action}` convention
 * and are represented by the `string` fallback on EventName.
 */
export interface CoreEventMap {
  // ── Invoicing ────────────────────────────────
  'invoice.created': {
    invoiceId: string;
    companyId: string;
    customerId: string;
    total: number;
  };
  'invoice.sent': {
    invoiceId: string;
    companyId: string;
    customerId: string;
  };
  'invoice.paid': {
    invoiceId: string;
    companyId: string;
    customerId: string;
    amount: number;
    method: string;
  };
  'invoice.overdue': {
    invoiceId: string;
    companyId: string;
    customerId: string;
    daysOverdue: number;
  };
  'invoice.voided': {
    invoiceId: string;
    companyId: string;
    reason: string;
  };

  // ── Payments ─────────────────────────────────
  'payment.received': {
    paymentId: string;
    invoiceId: string;
    companyId: string;
    amount: number;
    method: string;
  };
  'payment.refunded': {
    paymentId: string;
    invoiceId: string;
    companyId: string;
    amount: number;
    reason: string;
  };

  // ── POS ──────────────────────────────────────
  'pos.order.completed': {
    orderId: string;
    companyId: string;
    terminalId: string;
    total: number;
    items: number;
  };
  'pos.order.voided': {
    orderId: string;
    companyId: string;
    reason: string;
  };
  'pos.session.opened': {
    sessionId: string;
    companyId: string;
    terminalId: string;
  };
  'pos.session.closed': {
    sessionId: string;
    companyId: string;
    totalSales: number;
  };

  // ── Customers ────────────────────────────────
  'customer.created': {
    customerId: string;
    companyId: string;
    name: string;
  };
  'customer.updated': {
    customerId: string;
    companyId: string;
    changes: Record<string, unknown>;
  };
  'customer.deleted': {
    customerId: string;
    companyId: string;
  };

  // ── Products ─────────────────────────────────
  'product.created': {
    productId: string;
    companyId: string;
  };
  'product.updated': {
    productId: string;
    companyId: string;
    changes: Record<string, unknown>;
  };
  'product.deleted': {
    productId: string;
    companyId: string;
  };
  'product.low_stock': {
    productId: string;
    companyId: string;
    currentQty: number;
    reorderLevel: number;
  };

  // ── Employees ────────────────────────────────
  'employee.clocked_in': {
    employeeId: string;
    companyId: string;
    timestamp: string;
  };
  'employee.clocked_out': {
    employeeId: string;
    companyId: string;
    timestamp: string;
  };
  'employee.created': {
    employeeId: string;
    companyId: string;
  };
  'employee.terminated': {
    employeeId: string;
    companyId: string;
  };

  // ── Expenses ─────────────────────────────────
  'expense.created': {
    expenseId: string;
    companyId: string;
    amount: number;
    category: string;
  };
  'expense.approved': {
    expenseId: string;
    companyId: string;
  };

  // ── Payroll ──────────────────────────────────
  'payroll.run.approved': {
    runId: string;
    companyId: string;
    totalNet: number;
  };
  'payroll.run.paid': {
    runId: string;
    companyId: string;
  };

  // ── Accounting ───────────────────────────────
  'journal.posted': {
    entryId: string;
    companyId: string;
    module: string;
  };
  'fiscal_period.closed': {
    periodId: string;
    companyId: string;
    year: number;
    month: number;
  };

  // ── Module lifecycle ─────────────────────────
  'module.activated': {
    moduleId: string;
    companyId: string;
  };
  'module.deactivated': {
    moduleId: string;
    companyId: string;
  };
}

// ============================================
// TYPE UTILITIES
// ============================================

/**
 * An event name is either a key of the core event map or an arbitrary
 * string (for module-specific events like "salon.appointment.created").
 */
export type EventName = keyof CoreEventMap | (string & {});

/**
 * Resolve the payload type for a given event name.
 * Core events get their declared shape; unknown events fall back to
 * a generic record.
 */
export type EventPayload<T extends EventName> = T extends keyof CoreEventMap
  ? CoreEventMap[T]
  : Record<string, unknown>;

// ============================================
// HANDLER TYPES
// ============================================

type HandlerMode = 'sync' | 'async';

interface RegisteredHandler {
  /** Which module registered this handler (used for filtering and cleanup) */
  moduleId: string;
  /** Execution mode */
  mode: HandlerMode;
  /** The actual handler function */
  fn: (payload: Record<string, unknown>) => void | Promise<void>;
}

interface EmitContext {
  /** Company ID that emitted the event */
  companyId?: string;
  /** Currently active module IDs for the company — handlers from inactive modules are skipped */
  activeModules?: string[];
}

interface QueuedAsyncTask {
  handler: RegisteredHandler;
  payload: Record<string, unknown>;
}

// ============================================
// EVENT BUS
// ============================================

class EventBus {
  private handlers = new Map<string, RegisteredHandler[]>();
  private asyncQueue: QueuedAsyncTask[] = [];

  // ── Subscribe ──────────────────────────────────────────────

  /**
   * Register a synchronous handler.
   * Sync handlers run immediately inside `emit()` — they share the
   * caller's transaction / error boundary.
   */
  on<T extends EventName>(
    event: T,
    handler: (payload: EventPayload<T>) => void | Promise<void>,
    moduleId = 'core'
  ): () => void {
    return this._register(event, handler as RegisteredHandler['fn'], moduleId, 'sync');
  }

  /**
   * Register an asynchronous (fire-and-forget) handler.
   * Async handlers are queued during `emit()` and executed later
   * when `flush()` is called (typically at the end of a request).
   */
  onAsync<T extends EventName>(
    event: T,
    handler: (payload: EventPayload<T>) => Promise<void>,
    moduleId = 'core'
  ): () => void {
    return this._register(event, handler as RegisteredHandler['fn'], moduleId, 'async');
  }

  // ── Emit ───────────────────────────────────────────────────

  /**
   * Emit an event.
   *
   * 1. Runs all sync handlers immediately (awaiting each).
   * 2. Queues all async handlers for later `flush()`.
   *
   * If a sync handler throws, the error propagates to the emitter.
   * If `context.activeModules` is provided, handlers from modules
   * not in that list are silently skipped.
   */
  async emit<T extends EventName>(
    event: T,
    payload: EventPayload<T>,
    context?: EmitContext
  ): Promise<void> {
    const registered = this.handlers.get(event);
    if (!registered || registered.length === 0) return;

    const activeSet = context?.activeModules
      ? new Set(context.activeModules)
      : null;

    for (const handler of registered) {
      // Skip handlers from inactive modules (core handlers always run)
      if (
        activeSet &&
        handler.moduleId !== 'core' &&
        !activeSet.has(handler.moduleId)
      ) {
        continue;
      }

      if (handler.mode === 'sync') {
        try {
          await handler.fn(payload as Record<string, unknown>);
        } catch (error) {
          console.error(
            `[EventBus] Sync handler error (module="${handler.moduleId}", event="${event}"):`,
            error
          );
          throw error; // Sync errors propagate — they are part of the transaction
        }
      } else {
        // Queue for deferred execution
        this.asyncQueue.push({
          handler,
          payload: payload as Record<string, unknown>,
        });
      }
    }
  }

  // ── Flush ──────────────────────────────────────────────────

  /**
   * Process all queued async handlers.
   * Call this at the end of request processing (e.g. in middleware or
   * after the response is sent).
   *
   * Errors in async handlers are logged but never propagate.
   */
  async flush(): Promise<void> {
    const queue = this.asyncQueue.splice(0);
    if (queue.length === 0) return;

    const results = queue.map(async ({ handler, payload }) => {
      try {
        await handler.fn(payload);
      } catch (error) {
        console.error(
          `[EventBus] Async handler error (module="${handler.moduleId}"):`,
          error
        );
      }
    });

    await Promise.allSettled(results);
  }

  // ── Cleanup ────────────────────────────────────────────────

  /**
   * Remove all handlers registered by a specific module.
   * Called when a module is deactivated at runtime.
   */
  removeModule(moduleId: string): void {
    for (const [event, list] of this.handlers) {
      const filtered = list.filter((h) => h.moduleId !== moduleId);
      if (filtered.length === 0) {
        this.handlers.delete(event);
      } else {
        this.handlers.set(event, filtered);
      }
    }
  }

  /**
   * Remove all handlers. Used in tests.
   */
  reset(): void {
    this.handlers.clear();
    this.asyncQueue = [];
  }

  // ── Introspection ──────────────────────────────────────────

  /**
   * List all event names that currently have at least one handler.
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Count handlers for a specific event (useful for tests).
   */
  handlerCount(event: string): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  // ── Private ────────────────────────────────────────────────

  private _register(
    event: string,
    fn: RegisteredHandler['fn'],
    moduleId: string,
    mode: HandlerMode
  ): () => void {
    const entry: RegisteredHandler = { moduleId, mode, fn };
    const existing = this.handlers.get(event);

    if (existing) {
      existing.push(entry);
    } else {
      this.handlers.set(event, [entry]);
    }

    // Return an unsubscribe function
    return () => {
      const list = this.handlers.get(event);
      if (!list) return;
      const idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this.handlers.delete(event);
    };
  }
}

// ============================================
// SINGLETON
// ============================================

/** Global event bus singleton. */
export const eventBus = new EventBus();
