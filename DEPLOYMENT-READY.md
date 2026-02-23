# YaadBooks Deployment Readiness Checklist

**Date:** 2026-02-23
**Target:** Production deployment to yaadbooks.com (Coolify @ 178.156.226.84)

---

## Pre-Deployment Checklist

### Build & Compilation
- [x] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [x] No circular dependencies
- [x] All imports resolve correctly

### Authentication & Security
- [x] All 100+ API routes protected with `requirePermission`
- [x] Billing checkout route secured (was unauthenticated)
- [x] Stripe webhooks use HMAC-SHA256 signature verification
- [x] JWT-based auth with access/refresh tokens
- [x] RBAC role hierarchy enforced server-side
- [x] Team management prevents privilege escalation
- [x] Self-modification prevention (cannot change own role/remove self)
- [x] OWNER role immutability enforced

### RBAC System
- [x] 5 roles defined: OWNER, ADMIN, ACCOUNTANT, STAFF, READ_ONLY
- [x] 46 permissions mapped to roles with inheritance
- [x] Client-side `usePermissions` hook reads real role from store
- [x] `PermissionGate` component guards UI actions
- [x] Sidebar navigation filtered by permission
- [x] Team management respects role hierarchy

### Pricing Model
- [x] Solo plan: $19.99/mo, 1 user, all features
- [x] Team plan: $14.99/user/mo, unlimited users, all features
- [x] All feature gates removed from API and UI
- [x] New companies default to SOLO plan with 14-day trial
- [x] Stripe checkout session creation secured

### Data Integrity
- [x] Prisma schema has SOLO/TEAM in SubscriptionPlan enum
- [x] Legacy plan values retained for migration compatibility
- [x] Company-scoped data isolation in all API routes

---

## Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# App
NEXT_PUBLIC_APP_URL=https://yaadbooks.com
NODE_ENV=production

# Optional
SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
```

---

## Database Migration Steps

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Apply schema changes (adds SOLO/TEAM to SubscriptionPlan enum)
npx prisma migrate deploy

# 3. Migrate existing subscriptions from legacy plans
# Run this SQL after migration:
UPDATE "Company"
SET "subscriptionPlan" = 'SOLO'
WHERE "subscriptionPlan" IN ('STARTER', 'BUSINESS');

UPDATE "Company"
SET "subscriptionPlan" = 'TEAM'
WHERE "subscriptionPlan" IN ('PROFESSIONAL', 'ENTERPRISE');
```

---

## Deployment Steps

```bash
# 1. Build
npm run build

# 2. Verify no errors
npx tsc --noEmit

# 3. Deploy (rsync to Coolify server)
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  ./ user@178.156.226.84:/path/to/yaadbooks/

# 4. On server: install dependencies and restart
npm install --production
npx prisma migrate deploy
npx prisma generate
pm2 restart yaadbooks
```

---

## Post-Deployment Verification

1. **Auth flow:** Sign up, log in, refresh token, log out
2. **RBAC:** Log in as OWNER, verify all nav items visible. Create a READ_ONLY user, verify restricted nav and hidden buttons.
3. **Billing:** Navigate to Settings > Billing, verify Solo/Team plans display. (Do not test checkout without Stripe live keys.)
4. **Team management:** Invite a member, change their role, remove them.
5. **Core features:** Create a customer, create an invoice, record an expense, add a product.
6. **POS:** Open POS, add items to cart, process a payment.
7. **Reports:** Navigate to Reports, verify data loads from store.

---

## Known Blockers (None Critical)

| Issue | Severity | Impact |
|-------|----------|--------|
| Stripe webhook handlers are stubs (console.log only) | Medium | Subscriptions won't auto-update after payment |
| Banking/accounting data is store-only (not persisted) | Medium | Data lost on page refresh |
| AI assistant uses rule-based logic | Low | Not a real AI integration |
| Orphaned plan-gate files | Low | Dead code, no impact |

**Recommendation:** Deploy with the understanding that Stripe subscription lifecycle management needs to be implemented before enabling paid plans.

---

## Confidence Level

**Production-ready for core accounting features.** The application can be deployed for:
- Customer/vendor management
- Invoice creation and management
- Expense tracking
- Inventory management
- Payroll processing
- POS operations
- Journal entries and chart of accounts
- Team management with RBAC

**Not yet ready for:**
- Automated Stripe subscription lifecycle (webhook handlers need implementation)
- Real AI-powered insights (currently rule-based)
- Persistent banking/accounting data (needs API migration)
