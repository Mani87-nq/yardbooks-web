/**
 * Account lockout system for YardBooks.
 *
 * Locks user accounts after repeated failed login attempts with
 * progressive lockout durations:
 *   - Attempts 1-4:  no lock, just increment the counter
 *   - Attempt  5:    lock for 15 minutes
 *   - Attempts 6-9:  lock for 30 minutes
 *   - Attempts 10-14: lock for 1 hour
 *   - Attempts 15+:  lock for 24 hours
 */
import prisma from '@/lib/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS_BEFORE_LOCK = 5;

/** Lockout durations in milliseconds, keyed by attempt thresholds. */
const LOCKOUT_TIERS: { minAttempts: number; durationMs: number }[] = [
  { minAttempts: 15, durationMs: 24 * 60 * 60 * 1000 }, // 24 hours
  { minAttempts: 10, durationMs: 60 * 60 * 1000 },       // 1 hour
  { minAttempts: 6,  durationMs: 30 * 60 * 1000 },       // 30 minutes
  { minAttempts: 5,  durationMs: 15 * 60 * 1000 },       // 15 minutes
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the lockout duration for a given number of failed attempts.
 * Returns 0 if no lockout should be applied yet.
 */
function getLockoutDuration(attempts: number): number {
  for (const tier of LOCKOUT_TIERS) {
    if (attempts >= tier.minAttempts) {
      return tier.durationMs;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an account is currently locked.
 *
 * Returns the lock state, the time the lock expires (if locked), and
 * how many more failed attempts the user has before a lockout kicks in.
 */
export async function checkAccountLocked(userId: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
  remainingAttempts?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lockedUntil: true },
  });

  if (!user) {
    // Treat missing users as not locked (authentication layer handles 404).
    return { locked: false };
  }

  // If the account has a lockout timestamp that is still in the future,
  // the account is locked.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      locked: true,
      lockedUntil: user.lockedUntil,
    };
  }

  // Not locked — compute how many attempts remain before the next lock.
  const attemptsBeforeLock = MAX_ATTEMPTS_BEFORE_LOCK - 1; // 4 more allowed after 0
  const remaining = Math.max(0, attemptsBeforeLock - user.failedLoginAttempts + 1);

  return {
    locked: false,
    remainingAttempts: remaining,
  };
}

/**
 * Record a failed login attempt for the given user.
 *
 * Increments the counter and — if the threshold is reached — sets a lockout
 * window whose duration depends on the total number of failed attempts.
 *
 * Returns the updated lockout state.
 */
export async function recordFailedLogin(userId: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
  failedAttempts: number;
  remainingAttempts?: number;
}> {
  // Atomically increment the counter.
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  const attempts = user.failedLoginAttempts;
  const durationMs = getLockoutDuration(attempts);

  // If a lockout duration applies, set the lockedUntil timestamp.
  if (durationMs > 0) {
    const lockedUntil = new Date(Date.now() + durationMs);

    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });

    return {
      locked: true,
      lockedUntil,
      failedAttempts: attempts,
    };
  }

  // No lockout yet — return remaining attempts.
  const remaining = Math.max(0, MAX_ATTEMPTS_BEFORE_LOCK - attempts);

  return {
    locked: false,
    failedAttempts: attempts,
    remainingAttempts: remaining,
  };
}

/**
 * Reset failed login counters after a successful login.
 */
export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Admin override to unlock a user account immediately.
 *
 * Clears both the failed-attempt counter and the lockout timestamp so
 * the user can log in again right away.
 */
export async function adminUnlockAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}
