/**
 * GET /api/v1/products/categories — Product category suggestions
 *
 * Returns a merged, deduplicated list of:
 *   1. Distinct categories already used by this company's products
 *   2. Industry-appropriate defaults (if fewer than 5 unique categories exist)
 *
 * Used by the product creation form for category autocomplete/dropdown.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';
import { getIndustryCategories } from '@/lib/defaults/industry-categories';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'products:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 1. Get distinct categories from existing products
    const products = await prisma.product.findMany({
      where: {
        companyId: companyId!,
        deletedAt: null,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const existingCategories = products
      .map((p) => p.category)
      .filter((c): c is string => c !== null && c.trim() !== '');

    // 2. If company has fewer than 5 categories, supplement with industry defaults
    let suggestions: string[] = [...existingCategories];

    if (existingCategories.length < 5) {
      // Fetch company industry
      const company = await prisma.company.findUnique({
        where: { id: companyId! },
        select: { industry: true },
      });

      const industryDefaults = getIndustryCategories(company?.industry);

      // Merge, deduplicate (case-insensitive), preserving existing first
      const existingLower = new Set(existingCategories.map((c) => c.toLowerCase()));
      for (const cat of industryDefaults) {
        if (!existingLower.has(cat.toLowerCase())) {
          suggestions.push(cat);
          existingLower.add(cat.toLowerCase());
        }
      }
    }

    return NextResponse.json({ data: suggestions });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to fetch product categories'
    );
  }
}
