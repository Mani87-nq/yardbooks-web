/**
 * Email service layer for YardBooks.
 *
 * Supports multiple providers via environment configuration.
 * Currently implemented: Resend (RESEND_API_KEY).
 * Falls back to console logging in development when no provider is configured.
 */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Default sender address
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'YardBooks <noreply@yardbooks.com>';

/**
 * Send an email using the configured provider.
 *
 * Provider resolution:
 *  1. If RESEND_API_KEY is set, use the Resend HTTP API.
 *  2. Otherwise, log the email to the console in development.
 *  3. In production without a provider, return an error result.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const {
    to,
    subject,
    html,
    text,
    from = DEFAULT_FROM,
    replyTo,
    attachments,
  } = options;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Development fallback - log the email details
    if (process.env.NODE_ENV === 'development') {
      console.log('[Email Dev] ──────────────────────────────────');
      console.log(`[Email Dev] To:      ${Array.isArray(to) ? to.join(', ') : to}`);
      console.log(`[Email Dev] From:    ${from}`);
      console.log(`[Email Dev] Subject: ${subject}`);
      if (replyTo) console.log(`[Email Dev] Reply-To: ${replyTo}`);
      if (attachments?.length) {
        console.log(`[Email Dev] Attachments: ${attachments.map((a) => a.filename).join(', ')}`);
      }
      console.log('[Email Dev] ──────────────────────────────────');
      return { success: true, messageId: `dev-${Date.now()}` };
    }
    return { success: false, error: 'Email provider not configured' };
  }

  // Send via Resend HTTP API
  try {
    const body: Record<string, unknown> = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };

    if (text) body.text = text;
    if (replyTo) body.reply_to = replyTo;

    if (attachments?.length) {
      body.attachments = attachments.map((a) => ({
        filename: a.filename,
        content:
          typeof a.content === 'string'
            ? a.content
            : a.content.toString('base64'),
        ...(a.contentType ? { type: a.contentType } : {}),
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Resend API error:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('[Email] Send failed:', message);
    return { success: false, error: message };
  }
}
