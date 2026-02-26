/**
 * AI Provider Resolution
 *
 * Resolves the AI provider and API key for a company.
 * Priority: user's configured key > system env var.
 * Supports multiple providers: Anthropic, OpenAI, Google.
 */
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// ─── Types ──────────────────────────────────────────────────────

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  source: 'user' | 'system';
}

export interface AIProviderSettings {
  apiKey?: string;       // Encrypted
  enabled: boolean;
  addedAt?: string;      // ISO timestamp
}

export interface AISettings {
  configured: boolean;
  providers?: {
    anthropic?: AIProviderSettings;
    openai?: AIProviderSettings;
    google?: AIProviderSettings;
  };
  defaultProvider?: 'anthropic' | 'openai' | 'google';
  advancedFeaturesEnabled?: boolean;
}

// ─── Provider Resolution ────────────────────────────────────────

/**
 * Resolve the AI provider and API key for a company.
 * Priority: user's configured key (default provider first) > system env var.
 */
export async function resolveAIProvider(companyId: string): Promise<AIProviderConfig | null> {
  try {
    // 1. Check company integration settings for user key
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { integrationSettings: true },
    });

    const settings = company?.integrationSettings as Record<string, unknown> | null;
    const aiSettings = settings?.ai as AISettings | undefined;

    if (aiSettings?.providers) {
      // Check default provider first
      const defaultProvider = aiSettings.defaultProvider || 'anthropic';
      const providerSettings = aiSettings.providers[defaultProvider];

      if (providerSettings?.apiKey && providerSettings.enabled) {
        try {
          return {
            provider: defaultProvider,
            apiKey: decrypt(providerSettings.apiKey),
            source: 'user',
          };
        } catch {
          console.error(`[AI Provider] Failed to decrypt ${defaultProvider} key for company ${companyId}`);
        }
      }

      // Check other providers as fallback
      const providers: Array<'anthropic' | 'openai' | 'google'> = ['anthropic', 'openai', 'google'];
      for (const provider of providers) {
        if (provider === defaultProvider) continue;
        const ps = aiSettings.providers[provider];
        if (ps?.apiKey && ps.enabled) {
          try {
            return {
              provider,
              apiKey: decrypt(ps.apiKey),
              source: 'user',
            };
          } catch {
            console.error(`[AI Provider] Failed to decrypt ${provider} key for company ${companyId}`);
          }
        }
      }
    }

    // 2. Fall back to system env var (Anthropic only)
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (systemKey) {
      return { provider: 'anthropic', apiKey: systemKey, source: 'system' };
    }

    return null;
  } catch (error) {
    console.error('[AI Provider] Error resolving provider:', error);
    // Fall back to system key on any error
    const systemKey = process.env.ANTHROPIC_API_KEY;
    if (systemKey) {
      return { provider: 'anthropic', apiKey: systemKey, source: 'system' };
    }
    return null;
  }
}

/**
 * Create an Anthropic client using the resolved provider.
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Check if user has their own API key (required for advanced features like OCR/vision).
 */
export async function hasUserApiKey(companyId: string): Promise<boolean> {
  const config = await resolveAIProvider(companyId);
  return config?.source === 'user';
}

/**
 * Mask an API key for display (show only last 8 chars).
 * e.g., "sk-ant-abc...XYZ12345"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '***';
  const prefix = key.substring(0, 6);
  const suffix = key.substring(key.length - 8);
  return `${prefix}...${suffix}`;
}
