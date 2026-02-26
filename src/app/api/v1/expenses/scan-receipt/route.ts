/**
 * POST /api/v1/expenses/scan-receipt
 *
 * Scans a receipt image and extracts expense data using Claude Vision API.
 * Falls back to regex-based extraction for client-side OCR text.
 *
 * Gated: Requires user's own API key for server-side OCR (Vision).
 * System API key only supports client-side OCR text extraction.
 *
 * Accepts multipart form data with:
 *   - image: The receipt image (JPEG, PNG, WebP, PDF)
 *   - ocrText: Pre-extracted text from client-side OCR
 *
 * Returns extracted data that can be used to pre-fill an expense form.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { resolveAIProvider, createAnthropicClient } from '@/lib/ai/providers';

// ─── Simple receipt text parser (regex-based fallback) ──────────

interface ExtractedReceipt {
  vendor?: string;
  date?: string;
  subtotal?: number;
  gctAmount?: number;
  total?: number;
  items?: Array<{ description: string; amount: number }>;
  paymentMethod?: string;
  confidence: 'low' | 'medium' | 'high';
}

function extractReceiptData(text: string): ExtractedReceipt {
  const result: ExtractedReceipt = { confidence: 'low' };

  // Extract total (look for "TOTAL", "AMOUNT DUE", "GRAND TOTAL")
  const totalMatch = text.match(
    /(?:grand\s*total|total\s*(?:due|amount)?|amount\s*due|balance\s*due)[:\s]*[\$J]*\s*([\d,]+\.?\d{0,2})/i
  );
  if (totalMatch) {
    result.total = parseFloat(totalMatch[1].replace(/,/g, ''));
    result.confidence = 'medium';
  }

  // Extract GCT/tax
  const gctMatch = text.match(
    /(?:gct|g\.c\.t\.|tax|vat)[:\s]*[\$J]*\s*([\d,]+\.?\d{0,2})/i
  );
  if (gctMatch) {
    result.gctAmount = parseFloat(gctMatch[1].replace(/,/g, ''));
  }

  // Extract subtotal
  const subtotalMatch = text.match(
    /(?:sub\s*total|subtotal|net\s*amount)[:\s]*[\$J]*\s*([\d,]+\.?\d{0,2})/i
  );
  if (subtotalMatch) {
    result.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
  }

  // Extract date (DD/MM/YYYY or other formats)
  const dateMatch = text.match(
    /(?:date|dated?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  ) || text.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
  );
  if (dateMatch) {
    result.date = dateMatch[1];
  }

  // Try to extract vendor name (first line or after "FROM:" or business name patterns)
  const lines = text.split(/\n/).filter((l) => l.trim().length > 2);
  if (lines.length > 0) {
    // First non-empty line is often the vendor name
    result.vendor = lines[0].trim().substring(0, 100);
  }

  // Detect payment method
  const pmText = text.toLowerCase();
  if (pmText.includes('cash')) result.paymentMethod = 'CASH';
  else if (pmText.includes('visa') || pmText.includes('mastercard') || pmText.includes('card')) result.paymentMethod = 'CREDIT_CARD';
  else if (pmText.includes('transfer') || pmText.includes('eft')) result.paymentMethod = 'BANK_TRANSFER';
  else if (pmText.includes('jamdex') || pmText.includes('lynk')) result.paymentMethod = 'MOBILE_MONEY';

  // If we got total and at least one other field, confidence is higher
  if (result.total && (result.gctAmount || result.date || result.vendor)) {
    result.confidence = 'high';
  }

  return result;
}

// ─── POST Handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'expenses:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const ocrText = formData.get('ocrText') as string | null;

    // Option 1: Client-side OCR — client sends pre-extracted text
    if (ocrText) {
      const extracted = extractReceiptData(ocrText);
      return NextResponse.json({
        message: 'Receipt data extracted',
        source: 'client-ocr',
        extracted,
      });
    }

    // Option 2: Server-side OCR with Claude Vision
    if (!image) {
      return badRequest('Either image file or ocrText is required');
    }

    // ── File upload validation ───────────────────────────────────────
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (image.size > MAX_FILE_SIZE) {
      return badRequest(`File too large. Maximum size is 5 MB (received ${(image.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return badRequest(`Invalid file type "${image.type}". Accepted: JPEG, PNG, WebP, PDF.`);
    }

    // ── Resolve AI provider — require user's own API key for Vision ──
    const providerConfig = await resolveAIProvider(companyId!);

    if (!providerConfig || providerConfig.source !== 'user') {
      return NextResponse.json({
        message: 'AI-powered receipt scanning requires your own API key.',
        hint: 'Add your Anthropic API key in Settings > Integrations to unlock receipt scanning, image analysis, and other advanced AI features.',
        extracted: { confidence: 'low' as const },
        requiresApiKey: true,
      }, { status: 402 });
    }

    if (providerConfig.provider !== 'anthropic') {
      return NextResponse.json({
        message: 'Receipt scanning currently requires an Anthropic (Claude) API key for Vision capabilities.',
        hint: 'Add an Anthropic API key in Settings > Integrations.',
        extracted: { confidence: 'low' as const },
        requiresApiKey: true,
      }, { status: 402 });
    }

    // ── Process image with Claude Vision ──
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64 = imageBuffer.toString('base64');

    // Map MIME type to Claude's supported media types
    const mediaType = image.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const client = createAnthropicClient(providerConfig.apiKey);

    const response = await client.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `You are a receipt scanner for a Jamaican accounting application. Extract the following fields from this receipt image. Return ONLY a valid JSON object with these fields (omit any you can't find):

{
  "vendor": "Business/vendor name",
  "date": "YYYY-MM-DD format",
  "subtotal": 0.00,
  "gctAmount": 0.00,
  "total": 0.00,
  "items": [{"description": "item name", "amount": 0.00}],
  "paymentMethod": "CASH|CREDIT_CARD|DEBIT_CARD|BANK_TRANSFER|MOBILE_MONEY|CHEQUE",
  "currency": "JMD|USD",
  "receiptNumber": "receipt/invoice number if visible"
}

Notes:
- GCT = General Consumption Tax (Jamaica's VAT, usually 15%)
- Look for JMD/$ amounts. If currency isn't clear, assume JMD.
- For payment method, look for words like cash, visa, mastercard, debit, lynk, jamdex
- Extract line items if visible
- Return ONLY the JSON, no additional text`,
          },
        ],
      }],
    });

    // Parse Claude's response
    const responseText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as unknown as { text: string }).text)
      .join('');

    let extracted: ExtractedReceipt & { currency?: string; receiptNumber?: string };
    try {
      // Try to parse as JSON — Claude should return clean JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extracted = {
          vendor: parsed.vendor || undefined,
          date: parsed.date || undefined,
          subtotal: parsed.subtotal ? Number(parsed.subtotal) : undefined,
          gctAmount: parsed.gctAmount ? Number(parsed.gctAmount) : undefined,
          total: parsed.total ? Number(parsed.total) : undefined,
          items: parsed.items || undefined,
          paymentMethod: parsed.paymentMethod || undefined,
          currency: parsed.currency || 'JMD',
          receiptNumber: parsed.receiptNumber || undefined,
          confidence: 'high',
        };
      } else {
        extracted = { confidence: 'low' };
      }
    } catch {
      // If JSON parsing fails, fall back to regex extraction on the text
      extracted = { ...extractReceiptData(responseText), confidence: 'medium' };
    }

    return NextResponse.json({
      message: 'Receipt scanned successfully with AI Vision',
      source: 'claude-vision',
      extracted,
    });
  } catch (error) {
    console.error('[Scan Receipt] Error:', error);
    return internalError(error instanceof Error ? error.message : 'Failed to scan receipt');
  }
}
