# YaadBooks — Claude Code Project Instructions

## DEPLOYMENT — READ THIS FIRST

**There is NO GitHub Actions CI/CD.** Pushing to GitHub does NOT deploy anything.

### Deployment Steps (MANDATORY after every code change):
1. `git push origin main` — Push code to GitHub repo
2. **Go to Coolify dashboard** and click **Redeploy** — This is the ONLY way to deploy
3. Wait for the build to complete and verify health check passes

### Coolify Dashboard:
- **URL:** `[REDACTED - see Coolify dashboard]`
- **App page:** `[REDACTED - see Coolify dashboard]`
- **Logs tab:** Append `/logs` to the app page URL
- **Deployments tab:** Append `/deployment` to the app page URL

### After Deploy Checklist:
- [ ] Health check: `curl https://yaadbooks.com/api/health`
- [ ] Test login flow (email + Google OAuth)
- [ ] Check dashboard loads without errors

## TECH STACK

- **Framework:** Next.js 16.1.1 (App Router, Turbopack, standalone output)
- **ORM:** Prisma 7.4.0 with `@prisma/adapter-pg` driver adapter
- **Database:** PostgreSQL (on same Coolify server)
- **Auth:** JWT (jose library) + Google OAuth + 2FA (TOTP)
- **State:** Zustand stores (appStore, posStore)
- **Testing:** Vitest (`npm test`)
- **Server:** Coolify on `[REDACTED - see Coolify dashboard]`
- **Domain:** yaadbooks.com

## KNOWN GOTCHAS

### Prisma Decimal Fields
Prisma `Decimal` fields serialize as STRINGS in JSON. Always wrap with `Number()`:
```typescript
// WRONG: string concatenation → "1200027600"
invoices.reduce((sum, inv) => sum + inv.balance, 0);

// RIGHT: numeric addition → 39600
invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
```
Global fix is in `src/lib/db/index.ts` (Prisma.Decimal.prototype.toJSON override).

### Docker NEXT_PUBLIC_* Variables
`NEXT_PUBLIC_*` env vars must be set at **build time** in the Dockerfile, NOT at runtime.
They are baked into the JS bundle during `npm run build`.

### Schema Changes
`docker-entrypoint.sh` runs `prisma db push --skip-generate` at container startup.
New nullable fields are safe. Breaking changes need manual migration.

## PROJECT STRUCTURE

```
src/
├── app/              # Next.js App Router pages & API routes
├── components/       # React components
├── hooks/            # Custom hooks (useCurrency, useCompanyData, api/)
├── lib/              # Core libraries (auth, db, encryption, utils)
├── store/            # Zustand stores (appStore, posStore)
├── types/            # TypeScript type definitions
├── __tests__/        # Vitest test suites
prisma/
├── schema.prisma     # Database schema
```
