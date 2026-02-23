/**
 * Enhanced password security utilities for YaadBooks.
 *
 * Provides:
 *  - HIBP (Have I Been Pwned) breach checking via k-anonymity
 *  - Password history to prevent reuse of the last 5 passwords
 *  - Password rotation / expiry checks
 *
 * Assumes the User model has been extended with:
 *   passwordHistory   String[]    // Argon2id hashes of previous passwords
 *   passwordChangedAt DateTime?   // Timestamp of last password change
 */

import crypto from 'crypto';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/auth';

// ---------------------------------------------------------------------------
// 1. HIBP Breach Check (k-anonymity)
// ---------------------------------------------------------------------------

/**
 * Check whether a plaintext password has appeared in known data breaches
 * using the Have I Been Pwned "range" API.
 *
 * Only the first 5 characters of the SHA-1 hash are sent to the API, so the
 * full password (or its hash) is never transmitted.
 *
 * @returns `{ breached: false }` when the password is safe, or
 *          `{ breached: true, count }` with the number of times it appeared.
 */
export async function checkPasswordBreached(
  password: string,
): Promise<{ breached: boolean; count?: number }> {
  const sha1 = crypto
    .createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();

  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: {
        'User-Agent': 'YaadBooks-PasswordSecurity',
      },
    },
  );

  if (!response.ok) {
    // If the API is unreachable we fail open — the password is not blocked,
    // but callers can decide to log or alert on this.
    console.warn(
      `HIBP API returned status ${response.status}; skipping breach check.`,
    );
    return { breached: false };
  }

  const body = await response.text();

  // Each line has the format: HASH_SUFFIX:COUNT
  for (const line of body.split('\n')) {
    const [hashSuffix, countStr] = line.trim().split(':');
    if (hashSuffix === suffix) {
      return { breached: true, count: parseInt(countStr, 10) };
    }
  }

  return { breached: false };
}

// ---------------------------------------------------------------------------
// 2. Password History
// ---------------------------------------------------------------------------

/** Maximum number of previous passwords to retain and check against. */
const PASSWORD_HISTORY_LIMIT = 5;

/**
 * Check whether `newPassword` matches the user's current password or any of
 * their previous passwords (up to the last {@link PASSWORD_HISTORY_LIMIT}).
 *
 * @returns `true` if the password has been used before (i.e. it IS a reuse).
 */
export async function checkPasswordHistory(
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      passwordHistory: true,
    },
  });

  if (!user) {
    return false;
  }

  // Check against the current password hash first.
  if (user.passwordHash) {
    const matchesCurrent = await verifyPassword(newPassword, user.passwordHash);
    if (matchesCurrent) {
      return true;
    }
  }

  // Check against historical hashes.
  const history: string[] = user.passwordHistory ?? [];
  for (const oldHash of history) {
    const matchesOld = await verifyPassword(newPassword, oldHash);
    if (matchesOld) {
      return true;
    }
  }

  return false;
}

/**
 * Record a password hash in the user's history.
 *
 * Call this **after** the user's `passwordHash` field has been updated so that
 * the *old* hash is the one being archived. The history is capped at
 * {@link PASSWORD_HISTORY_LIMIT} entries (oldest entries are discarded).
 *
 * Also updates `passwordChangedAt` to the current time.
 */
export async function recordPasswordInHistory(
  userId: string,
  passwordHash: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHistory: true },
  });

  const history: string[] = user?.passwordHistory ?? [];

  // Prepend the new hash and trim to the limit.
  const updatedHistory = [passwordHash, ...history].slice(
    0,
    PASSWORD_HISTORY_LIMIT,
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHistory: updatedHistory,
      passwordChangedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Password Rotation / Expiry
// ---------------------------------------------------------------------------

/**
 * Check whether a user's password has exceeded the maximum allowed age.
 *
 * Uses the `passwordChangedAt` field if available; falls back to `updatedAt`.
 *
 * @param maxAgeDays - Maximum password age in days (e.g. 90 for admins/owners).
 * @returns `true` if the password is expired (older than `maxAgeDays`).
 */
export async function checkPasswordExpired(
  userId: string,
  maxAgeDays: number,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordChangedAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    // Unknown user — treat as expired to force a password change flow.
    return true;
  }

  const referenceDate: Date = user.passwordChangedAt ?? user.updatedAt;
  const ageMs = Date.now() - referenceDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays > maxAgeDays;
}
