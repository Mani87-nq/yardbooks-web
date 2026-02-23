# YaadBooks Known Issues

**Date:** 2026-02-23
**Status:** Production-ready with known limitations

---

## Critical Issues

*None identified.*

---

## Medium Priority

### 1. Stripe Webhook Handlers Are Stub Implementations
**File:** `src/app/api/webhooks/stripe/route.ts`
**Description:** The Stripe webhook correctly verifies signatures, but the event handlers only log to console. They contain TODO comments for actual database updates (subscription status, payment recording, etc.).
**Impact:** Stripe payments will process, but subscription status won't auto-update in the database.
**Recommendation:** Implement the TODO blocks before going live with paid subscriptions.

### 2. Store-Driven Pages Don't Persist Across Sessions
**Pages:** Dashboard, Reports, Banking, Accounting (Chart of Accounts, Journal Entries), AI Assistant
**Description:** These pages use Zustand store data which is populated during the session. Data is lost on page refresh unless the store has persistence configured. The data hydration hook fetches some data from API, but banking/accounting data appears to be local-only.
**Impact:** Users may lose in-session banking and accounting data on refresh.
**Recommendation:** Migrate banking and accounting pages to use React Query hooks backed by API endpoints (like the POS and Customers pages already do).

### 3. AI Assistant Uses Rule-Based Logic, Not Actual AI
**File:** `src/app/(dashboard)/ai/page.tsx`
**Description:** The `generateAIResponse()` function uses keyword matching and local calculations, not an actual LLM API call.
**Impact:** AI responses are limited to pre-programmed patterns.
**Recommendation:** Integrate with Claude API or similar for real AI-powered insights.

---

## Low Priority

### 4. Legacy Plan Names in Prisma Enum
**File:** `prisma/schema.prisma`
**Description:** The SubscriptionPlan enum still contains legacy values (STARTER, BUSINESS, PROFESSIONAL, ENTERPRISE) alongside the new SOLO/TEAM values for migration compatibility.
**Impact:** No functional impact. Legacy values exist for backward compatibility.
**Recommendation:** Remove legacy enum values after all existing subscriptions are migrated.

### 5. Redundant Permission Filtering in Sidebar
**File:** `src/components/layout/Sidebar.tsx`
**Description:** The navigation.map callback filters items twice: once at the group level (for empty group hiding) and once at the item render level. Both use `!item.permission || can(item.permission)`.
**Impact:** No functional impact, minor performance overhead (negligible).
**Recommendation:** Use `visibleItems` variable for rendering instead of re-filtering.

### 6. `plan-gate.ts` and `plan-gate.server.ts` Are Orphaned
**Files:** `src/lib/plan-gate.ts`, `src/lib/plan-gate.server.ts`
**Description:** These files are no longer imported by any code after the feature gating removal, but they still exist in the codebase.
**Impact:** Dead code, no functional impact.
**Recommendation:** Delete both files.

### 7. Payroll Permissions Are Coarse
**Description:** The RBAC system has only `payroll:read`, `payroll:create`, and `payroll:approve` permissions. There is no `payroll:update` or `payroll:delete`. Both edit and delete operations on employees use `payroll:create` as the gate.
**Impact:** Cannot differentiate between create, update, and delete access for payroll records.
**Recommendation:** Add `payroll:update` and `payroll:delete` permissions to `src/lib/auth/rbac.ts`.

### 8. Some Dashboard Pages Lack PermissionGate
**Description:** PermissionGate was added to 6 primary list pages (customers, expenses, inventory, invoices, quotations, payroll). Sub-pages like invoice editing (`/invoices/[id]/edit`), stock counts, and banking pages don't have client-side permission gates.
**Impact:** Low risk since API routes enforce permissions server-side. Unauthorized users would see the UI but get 403 errors on API calls.
**Recommendation:** Add PermissionGate to sub-pages for better UX (hide buttons before users click them).

---

## Non-Issues (Investigated and Cleared)

- **Companies routes using `requireAuth`** - Appropriate since they operate across companies, not within a single company's permission scope. Manual membership + role checks are correct.
- **`auth/me` route using `requireAuth`** - Correct; returns current user info regardless of company.
- **Webhook routes without JWT auth** - Correct; use Stripe signature verification instead.
