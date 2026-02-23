# YaadBooks Deployment Verification Guide

**For:** Mani  
**Date:** 2025-02-23  
**Purpose:** Quick checklist to verify security and authentication work correctly

---

## 🚀 Step-by-Step Deployment & Testing

### 1. Update Coolify Environment Variables

Go to: **Coolify Dashboard** → **YaadBooks App** → **Environment**

Copy and paste these **EXACT** variables:

```env
DATABASE_URL=postgres://postgres:nN0ym8jSltEFAqBct1NL1Ecd6YewzkCbof6a53uYSxNtgotSOk3nlQPwwBJKRvlL@k4go8skw8g0kk4wo84k4ogc4:5432/yardbooks

DIRECT_URL=postgres://postgres:nN0ym8jSltEFAqBct1NL1Ecd6YewzkCbof6a53uYSxNtgotSOk3nlQPwwBJKRvlL@k4go8skw8g0kk4wo84k4ogc4:5432/yardbooks

JWT_ACCESS_SECRET=5a29b9ac7db0f92d6cc1fcce27eabfa2030e98deaed3dc74b4b31b3474d7ed00

JWT_REFRESH_SECRET=94df4765de2f59f6662611c31297b635876dc20dfee20c3c9b06f30842a7845a

ENCRYPTION_KEY=c860d587903fd4dea0ec5b712d0d80fcf51b14a2d30a7f38b45e1fac4f43ec00

NEXT_PUBLIC_APP_URL=https://your-actual-domain.com

NODE_ENV=production
```

⚠️ **IMPORTANT:** Change `https://your-actual-domain.com` to your real domain!

---

### 2. Deploy the Application

Click **"Deploy"** in Coolify and wait for build to complete.

**Expected output in logs:**
```
✓ Compiled successfully
✓ Generating static pages
✓ Finalizing build
```

---

### 3. Run Database Migration

**Option A: Via Coolify Terminal**
1. Go to Coolify → YaadBooks → Terminal
2. Run:
```bash
npx prisma db push
```

**Option B: Via SSH**
```bash
ssh root@178.156.226.84
cd /path/to/yardbooks-web
npx prisma db push
```

**Expected output:**
```
✓ Prisma schema loaded
✓ Datasource: PostgreSQL database
✓ Database schema updated
```

---

### 4. Verify Security Headers

Open terminal on your computer and run:

```bash
curl -I https://your-domain.com
```

**✅ You should see these headers:**
```
HTTP/2 200
x-frame-options: DENY
x-content-type-options: nosniff
strict-transport-security: max-age=31536000; includeSubDomains; preload
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; ...
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
```

**❌ If you don't see these:**
- Check that deployment succeeded
- Verify Next.js middleware is running
- Check Coolify logs for errors

---

### 5. Test Authentication Flow

#### Test 1: Access Dashboard Without Login
1. Open browser in **incognito/private mode**
2. Go to: `https://your-domain.com/dashboard`
3. **✅ Expected:** Redirected to `/login?from=/dashboard`
4. **❌ If not:** Middleware not running - check deployment logs

---

#### Test 2: Create Account
1. Go to: `https://your-domain.com/signup`
2. Fill in:
   - **Email:** test@example.com
   - **Password:** TestPassword123!@# (must meet requirements)
   - **First Name:** Test
   - **Last Name:** User
   - **Company Name:** Test Company
3. Click **"Sign Up"**
4. **✅ Expected:** Redirected to `/dashboard`, you're logged in
5. **❌ If error:** Check browser console and Coolify logs

---

#### Test 3: Login
1. **Logout** (click logout button in dashboard)
2. **✅ Expected:** Redirected to `/login`, cookies cleared
3. Go to `/login`
4. Enter credentials from Test 2
5. Click **"Login"**
6. **✅ Expected:** Redirected to `/dashboard`

---

#### Test 4: Rate Limiting (Important!)
1. **Logout**
2. Go to `/login`
3. Try to login with **wrong password** 6 times in a row
4. **✅ Expected after 5th attempt:** 
   ```json
   {
     "type": "rate_limit",
     "title": "Too many login attempts",
     "detail": "Please try again later."
   }
   ```
5. **❌ If you can keep trying:** Rate limiting not working - check implementation

---

#### Test 5: Account Lockout
1. Create a new account (or use existing)
2. **Logout**
3. Try to login with **wrong password** exactly 6 times
4. **✅ Expected on 6th attempt:**
   ```json
   {
     "type": "account_locked",
     "title": "Account locked",
     "detail": "Account is locked due to too many failed login attempts. Try again after [timestamp]."
   }
   ```
5. Wait 15 minutes OR unlock via database:
   ```sql
   UPDATE "User" SET "failedLoginAttempts" = 0, "lockedUntil" = NULL WHERE email = 'your-email@example.com';
   ```

---

#### Test 6: Password Requirements
1. Go to `/signup`
2. Try these passwords and verify they're **rejected**:
   - `short` → ❌ "Password must be at least 12 characters"
   - `alllowercase123!` → ❌ "Password must contain an uppercase letter"
   - `ALLUPPERCASE123!` → ❌ "Password must contain a lowercase letter"
   - `NoNumbersHere!` → ❌ "Password must contain a number"
   - `NoSpecialChar123` → ❌ "Password must contain a special character"
3. Try valid password: `ValidPassword123!@#`
   - ✅ Should be accepted

---

#### Test 7: Session Persistence
1. Login to dashboard
2. **Close browser completely**
3. Open browser again
4. Go to `https://your-domain.com/dashboard`
5. **✅ Expected:** Still logged in (cookies persist)
6. **❌ If logged out:** Cookie settings incorrect - check HTTPS/secure flags

---

#### Test 8: Logout Clears Session
1. Login to dashboard
2. Open browser DevTools → Application → Cookies
3. Note the cookies: `accessToken`, `yaadbooks_refresh_token`
4. Click **Logout**
5. Check cookies again
6. **✅ Expected:** Both cookies are deleted
7. Try to access `/dashboard`
8. **✅ Expected:** Redirected to `/login` (session invalidated)

---

### 6. Check Security.txt

Visit: `https://your-domain.com/.well-known/security.txt`

**✅ Expected:**
```
Contact: mailto:admin@dolphytech.com
Contact: mailto:partnerships@dolphytech.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://your-domain.com/.well-known/security.txt
```

---

### 7. Monitor Logs

Go to **Coolify** → **YaadBooks** → **Logs** and watch for:

**✅ Good signs:**
```
✓ Session created for user: user-id-here
✓ Login successful
✓ Refresh token validated
✓ User logged out
```

**❌ Watch out for:**
```
✗ JWT_ACCESS_SECRET is not set
✗ Database connection failed
✗ Rate limit exceeded (if happening too often)
✗ Account locked (if not from your testing)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "JWT_ACCESS_SECRET is not set"
**Solution:**
1. Go to Coolify → Environment Variables
2. Verify `JWT_ACCESS_SECRET` is set exactly as shown in Step 1
3. Redeploy the app

---

### Issue 2: "Cannot connect to database"
**Solution:**
1. Check that database service is running in Coolify
2. Verify `DATABASE_URL` uses internal hostname `k4go8skw8g0kk4wo84k4ogc4`
3. Don't use external IP `178.156.226.84` in production

---

### Issue 3: Redirected to login even after logging in
**Solution:**
1. Check that cookies are being set (DevTools → Application → Cookies)
2. Verify `NEXT_PUBLIC_APP_URL` matches your actual domain
3. Ensure you're accessing via HTTPS (not HTTP)

---

### Issue 4: Rate limiting not working
**Solution:**
1. Check middleware is running: `curl -I https://your-domain.com`
2. Verify security headers are present
3. Check Coolify logs for middleware errors

---

### Issue 5: Password validation not working
**Solution:**
1. Check that API route is using Zod validation
2. Verify `/src/lib/auth/password.ts` is being imported
3. Check browser console for frontend validation errors

---

## ✅ Final Verification Checklist

Print this out and check off as you test:

- [ ] Environment variables set in Coolify
- [ ] App deployed successfully
- [ ] `npx prisma db push` completed
- [ ] Security headers present in HTTP response
- [ ] Dashboard redirects to login when not authenticated
- [ ] Signup creates account and logs in
- [ ] Login with correct credentials works
- [ ] Logout clears cookies and redirects to login
- [ ] Rate limiting kicks in after 5 login attempts
- [ ] Account locks after 5 failed login attempts
- [ ] Password validation rejects weak passwords
- [ ] Session persists after closing browser
- [ ] security.txt file is accessible
- [ ] No errors in Coolify logs

**If all boxes checked:** ✅ **PRODUCTION-READY!**

---

## 📞 Need Help?

**Security Issues:** admin@dolphytech.com  
**General Support:** partnerships@dolphytech.com

**Reference Documents:**
- `SECURITY_AUDIT_REPORT.md` - Full security audit
- `AUTH_IMPLEMENTATION_REPORT.md` - Authentication details
- This file - Quick verification guide

---

**Last Updated:** 2025-02-23  
**Next Review:** Before production launch
