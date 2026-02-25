/**
 * POST /api/v1/contact
 *
 * Public endpoint for the Contact Us form.
 * Validates input with Zod, rate-limits by IP, and sends the
 * enquiry via email using the existing email service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { badRequest, internalError } from '@/lib/api-error';
import { sendEmail } from '@/lib/email/service';

// ──────────────────────────────────────────────────────────────
// Rate limiting (simple in-memory, 3 submissions per minute per IP)
// ──────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

// Periodically clean stale entries to prevent memory leaks (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60_000);

// ──────────────────────────────────────────────────────────────
// Validation schema
// ──────────────────────────────────────────────────────────────
const contactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name is too long'),
  email: z
    .string()
    .email('Please provide a valid email address'),
  phone: z
    .string()
    .max(30, 'Phone number is too long')
    .optional()
    .or(z.literal('')),
  subject: z.enum(['general', 'sales', 'support', 'partnership', 'other'], {
    error: 'Please select a valid subject',
  }),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message is too long (5000 characters max)'),
});

// ──────────────────────────────────────────────────────────────
// Subject labels for the email
// ──────────────────────────────────────────────────────────────
const SUBJECT_LABELS: Record<string, string> = {
  general: 'General Inquiry',
  sales: 'Sales',
  support: 'Support',
  partnership: 'Partnership',
  other: 'Other',
};

// ──────────────────────────────────────────────────────────────
// Destination for contact form emails
// ──────────────────────────────────────────────────────────────
const CONTACT_EMAIL = process.env.CONTACT_FORM_EMAIL ?? 'support@yaadbooks.com';

// ──────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // --- Rate limit ---
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many submissions. Please wait a minute and try again.',
        },
        { status: 429 }
      );
    }

    // --- Parse & validate ---
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { name, email, phone, subject, message } = parsed.data;
    const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

    // --- Send notification email to the team ---
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">New Contact Form Submission</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px; vertical-align: top;">Name</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Email</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                <a href="mailto:${escapeHtml(email)}" style="color: #059669;">${escapeHtml(email)}</a>
              </td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Phone</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(phone)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Subject</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(subjectLabel)}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <div>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">Message</p>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="color: #111827; font-size: 14px; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0; text-align: center;">
            Sent from the YaadBooks Contact Form
          </p>
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to: CONTACT_EMAIL,
      subject: `[Contact] ${subjectLabel} — ${name}`,
      html: emailHtml,
      replyTo: email,
    });

    if (!emailResult.success) {
      console.error('[Contact] Failed to send email:', emailResult.error);
      // Still return success to the user — we don't want to expose internal errors.
      // The form data was valid; we just couldn't deliver it. Log it for monitoring.
    }

    return NextResponse.json(
      { success: true, message: 'Your message has been sent. We will be in touch soon!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Contact] Unexpected error:', error);
    return internalError(error instanceof Error ? error.message : 'Failed to process contact form');
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
