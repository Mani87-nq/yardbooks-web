/**
 * Password hashing utilities using Argon2id.
 * Argon2id is the recommended algorithm for password hashing (OWASP).
 */
import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

/**
 * Hash a plaintext password with Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Basic password strength validation.
 * Returns an array of issues (empty = valid).
 */
export function validatePasswordStrength(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 12) issues.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) issues.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('Password must contain a number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('Password must contain a special character');
  return issues;
}
