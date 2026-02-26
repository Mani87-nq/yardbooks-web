/**
 * POST /api/v1/company/integrations/validate-key
 *
 * Validates an AI provider API key by making a minimal API call.
 * Returns { valid: boolean, error?: string, provider: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const bodySchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google']),
  apiKey: z.string().min(10).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid request: provider and apiKey are required');
    }

    const { provider, apiKey } = parsed.data;

    switch (provider) {
      case 'anthropic': {
        try {
          const client = new Anthropic({ apiKey });
          // Minimal API call to validate key — cheapest possible
          await client.messages.create({
            model: 'claude-haiku-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          });
          return NextResponse.json({ valid: true, provider });
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          if (err.status === 401) {
            return NextResponse.json({ valid: false, provider, error: 'Invalid API key. Please check your Anthropic API key.' });
          }
          if (err.status === 403) {
            return NextResponse.json({ valid: false, provider, error: 'API key does not have permission. Check your Anthropic account.' });
          }
          if (err.status === 429) {
            // Rate limited means the key IS valid
            return NextResponse.json({ valid: true, provider });
          }
          return NextResponse.json({ valid: false, provider, error: err.message || 'Failed to validate key' });
        }
      }

      case 'openai': {
        try {
          // Validate OpenAI key by calling the models endpoint
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.status === 401) {
            return NextResponse.json({ valid: false, provider, error: 'Invalid API key. Please check your OpenAI API key.' });
          }
          if (res.status === 429) {
            // Rate limited means key is valid
            return NextResponse.json({ valid: true, provider });
          }
          if (res.ok) {
            return NextResponse.json({ valid: true, provider });
          }
          return NextResponse.json({ valid: false, provider, error: `OpenAI returned status ${res.status}` });
        } catch (error: unknown) {
          const err = error as { message?: string };
          return NextResponse.json({ valid: false, provider, error: err.message || 'Failed to validate key' });
        }
      }

      case 'google': {
        try {
          // Validate Google AI key by calling the models list endpoint
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (res.status === 400 || res.status === 403) {
            return NextResponse.json({ valid: false, provider, error: 'Invalid API key. Please check your Google AI API key.' });
          }
          if (res.ok) {
            return NextResponse.json({ valid: true, provider });
          }
          return NextResponse.json({ valid: false, provider, error: `Google AI returned status ${res.status}` });
        } catch (error: unknown) {
          const err = error as { message?: string };
          return NextResponse.json({ valid: false, provider, error: err.message || 'Failed to validate key' });
        }
      }

      default:
        return badRequest('Unsupported provider');
    }
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Validation failed');
  }
}
