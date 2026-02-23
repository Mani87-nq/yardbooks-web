/**
 * POST /api/v1/expenses/scan-receipt
 *
 * Scans a receipt image and extracts expense data using OCR.
 * Uses a simple regex-based extraction for common receipt formats.
 * Can be upgraded to use Claude Vision API, Google Cloud Vision, or
 * AWS Textract for production-grade OCR.
 *
 * Accepts multipart form data with:
 *   - image: The receipt image (JPEG, PNG)
 *
 * Returns extracted data that can be used to pre-fill an expense form.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── Simple receipt text parser (regex-based) ─────────────────────

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

    // Option 2: Server-side OCR with image upload
    if (!image) {
      return badRequest('Either image file or ocrText is required');
    }

    // For now, return instructions for integration.
    // In production, this would call Claude Vision API or Google Cloud Vision:
    //
    // const imageBuffer = Buffer.from(await image.arrayBuffer());
    // const base64 = imageBuffer.toString('base64');
    //
    // Claude Vision API example:
    // const response = await anthropic.messages.create({
    //   model: 'claude-sonnet-4-20250514',
    //   messages: [{
    //     role: 'user',
    //     content: [{
    //       type: 'image',
    //       source: { type: 'base64', media_type: image.type, data: base64 }
    //     }, {
    //       type: 'text',
    //       text: 'Extract vendor name, date, subtotal, GCT amount, total, and payment method from this receipt. Return as JSON.'
    //     }]
    //   }]
    // });

    return NextResponse.json({
      message: 'Receipt image received. Server-side OCR requires an AI Vision API key.',
      hint: 'Set ANTHROPIC_API_KEY in environment to enable Claude Vision receipt scanning.',
      fileName: image.name,
      fileSize: image.size,
      fileType: image.type,
      extracted: {
        confidence: 'low' as const,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to scan receipt');
  }
}
