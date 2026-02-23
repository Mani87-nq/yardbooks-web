# YaadBooks - Quick Deploy Checklist

**⏱️ Time Required:** 30 minutes  
**📋 Prerequisite:** Coolify access

---

## 🚀 5-Step Production Deployment

### Step 1: Copy Environment Variables (2 min)
Go to: **Coolify** → **YaadBooks** → **Environment Variables**

Paste these **EXACT** values:

```env
DATABASE_URL=postgres://postgres:nN0ym8jSltEFAqBct1NL1Ecd6YewzkCbof6a53uYSxNtgotSOk3nlQPwwBJKRvlL@k4go8skw8g0kk4wo84k4ogc4:5432/yardbooks
DIRECT_URL=postgres://postgres:nN0ym8jSltEFAqBct1NL1Ecd6YewzkCbof6a53uYSxNtgotSOk3nlQPwwBJKRvlL@k4go8skw8g0kk4wo84k4ogc4:5432/yardbooks
JWT_ACCESS_SECRET=5a29b9ac7db0f92d6cc1fcce27eabfa2030e98deaed3dc74b4b31b3474d7ed00
JWT_REFRESH_SECRET=94df4765de2f59f6662611c31297b635876dc20dfee20c3c9b06f30842a7845a
ENCRYPTION_KEY=c860d587903fd4dea0ec5b712d0d80fcf51b14a2d30a7f38b45e1fac4f43ec00
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

⚠️ **CHANGE** `https://your-domain.com` to your actual domain!

---

### Step 2: Deploy (5 min)
Click **"Deploy"** button in Coolify.

Wait for: ✓ Build complete, ✓ Deployment successful

---

### Step 3: Run Database Migration (2 min)
In **Coolify Terminal** or via SSH:

```bash
npx prisma db push
```

Expected: ✓ Database schema updated

---

### Step 4: Verify Security (5 min)
Run on your computer:

```bash
curl -I https://your-domain.com
```

✅ Check for these headers:
- `x-frame-options: DENY`
- `strict-transport-security:`
- `content-security-policy:`

---

### Step 5: Test Login Flow (10 min)

1. **Create Account**
   - Go to: `https://your-domain.com/signup`
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - ✅ Should redirect to dashboard

2. **Test Logout**
   - Click logout
   - ✅ Should redirect to `/login`

3. **Test Login**
   - Login with same credentials
   - ✅ Should access dashboard

4. **Test Rate Limit**
   - Try wrong password 6 times
   - ✅ Should get "Too many attempts" error

---

## ✅ Done!

Your app is production-ready with enterprise security.

**Full Details:** See `SECURITY_AUDIT_REPORT.md`  
**Testing Guide:** See `DEPLOYMENT_VERIFICATION.md`

---

## 🚨 Troubleshooting

**"JWT_ACCESS_SECRET not set"**  
→ Check Step 1 - verify all env vars are saved in Coolify

**"Cannot connect to database"**  
→ Verify database service is running in Coolify

**Still redirecting to login after login**  
→ Check `NEXT_PUBLIC_APP_URL` matches your actual domain

**Security headers missing**  
→ Verify deployment succeeded, check logs

---

**Need Help?** admin@dolphytech.com
