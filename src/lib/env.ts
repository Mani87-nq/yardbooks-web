/**
 * Environment variable validation.
 *
 * Import this module early (e.g. in instrumentation.ts or layout.tsx)
 * so the app fails fast with a clear message instead of crashing with
 * a cryptic "undefined" error at runtime.
 */
import { z } from 'zod/v4';

const serverEnvSchema = z.object({
  // Database (connection string — starts with postgres:// or postgresql://)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT / Auth
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-character hex string'),

  // Email (optional — gracefully degrades)
  RESEND_API_KEY: z.string().optional(),

  // Stripe (optional — billing disabled without it)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Google OAuth (optional — social login disabled without it)
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),

  // WiPay (optional — JMD invoice payments disabled without it)
  WIPAY_ACCOUNT_NUMBER: z.string().optional(),
  WIPAY_API_KEY: z.string().optional(),
  WIPAY_DEVELOPER_ID: z.string().optional(),
  WIPAY_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),

  // Sentry (optional — monitoring disabled without it)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _validated = false;

/**
 * Validate all required environment variables. Call once at startup.
 * Throws with a clear list of missing/invalid variables.
 */
export function validateEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      '\n╔══════════════════════════════════════════════╗\n' +
      '║     MISSING / INVALID ENVIRONMENT VARIABLES    ║\n' +
      '╠══════════════════════════════════════════════╣\n' +
      `\n${errors}\n\n` +
      'Set these in your .env.local or Coolify environment.\n' +
      '╚══════════════════════════════════════════════╝\n'
    );

    // In production, crash early. In development, warn only.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${errors}`);
    }
  }

  _validated = true;
  return (result.success ? result.data : process.env) as ServerEnv;
}

/**
 * Get validated environment. Throws if validateEnv() hasn't been called.
 */
export function getEnv(): ServerEnv {
  if (!_validated) {
    return validateEnv();
  }
  return process.env as unknown as ServerEnv;
}
