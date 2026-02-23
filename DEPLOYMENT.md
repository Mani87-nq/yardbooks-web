# YardBooks Production Deployment Guide

## Quick Deployment Steps

### 1. Set Up Supabase Database (Free Tier)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users (e.g., `us-east-1` for Jamaica)
3. Set a secure database password (save it!)
4. Wait for the project to be provisioned (~2 minutes)

5. Get your connection strings from **Settings → Database → Connection string**:
   - **URI (Transaction pooler)**: Copy this for `DATABASE_URL`
   - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

   - **URI (Session pooler / Direct)**: Copy this for `DIRECT_URL` (used for migrations)
   - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

### 2. Configure Vercel Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables** and add:

```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

JWT_ACCESS_SECRET=<generate-a-64-char-random-string>
JWT_REFRESH_SECRET=<generate-another-64-char-random-string>

ENCRYPTION_KEY=<generate-a-64-char-hex-string>

NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

**To generate secrets:**
```bash
# JWT secrets (run twice for each):
openssl rand -base64 48

# Encryption key (64-char hex):
openssl rand -hex 32
```

### 3. Run Database Migrations

After setting environment variables, trigger a deploy which will automatically run migrations via `postinstall`.

Or manually via Vercel CLI:
```bash
vercel env pull .env.production.local
npx prisma migrate deploy
```

### 4. Deploy to Vercel

```bash
vercel --prod
```

Or push to your GitHub repo to trigger automatic deployment.

### 5. Verify Deployment

1. Visit `https://your-app.vercel.app/signup`
2. Create a test account
3. Verify you can log in
4. Create a company, customer, and invoice

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooler) |
| `DIRECT_URL` | Yes | PostgreSQL direct connection (migrations) |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting sensitive data |
| `NEXT_PUBLIC_APP_URL` | Yes | Full URL of your app (for CORS, emails) |
| `NODE_ENV` | Yes | Set to `production` |

---

## Post-Deployment Checklist

- [ ] Database connected and migrations applied
- [ ] Can register a new user
- [ ] Can log in with registered user
- [ ] Can create a company
- [ ] Can create customers, products, invoices
- [ ] Session persists across page reloads
- [ ] Logout works correctly
- [ ] Error pages display correctly

---

## Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correct in Vercel
- Check Supabase project is running
- Ensure you're using the pooler connection string

### "Prisma migration failed"
- Use `DIRECT_URL` for migrations (not pooler)
- Run `npx prisma migrate deploy` locally with production env

### "JWT verification failed"
- Ensure `JWT_ACCESS_SECRET` is set in Vercel
- Tokens from development won't work in production

### "Registration works but login fails"
- Clear browser cookies and try again
- Check that both JWT secrets are set

---

## Security Notes

1. **Never commit `.env` files** to git
2. **Rotate secrets** periodically
3. **Monitor** Supabase dashboard for suspicious activity
4. **Enable** Supabase's built-in security features (RLS is NOT used - we use app-level multi-tenancy)

---

## Scaling Considerations

**Free Tier Limits (Supabase):**
- 500MB database storage
- 2GB bandwidth/month
- 50,000 monthly active users

**When to upgrade:**
- >100 concurrent users
- >500MB database size
- Need point-in-time recovery

---

*Last updated: February 2026*
