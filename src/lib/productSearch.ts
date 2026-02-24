/**
 * Fuzzy product search utility for POS SmartSearch component.
 * Stateless — caller handles debouncing.
 */

export interface SearchableProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  category?: string;
}

export type MatchType = 'barcode' | 'sku' | 'exact' | 'partial';

export interface SearchResult {
  product: SearchableProduct;
  matchType: MatchType;
  score: number;
}

interface SearchOptions {
  limit?: number;
  minScore?: number;
}

/**
 * Search products by query — matches name, SKU, or barcode.
 * Results are sorted by relevance score (highest first).
 */
export function searchProducts(
  products: SearchableProduct[],
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { limit = 10, minScore = 0.1 } = options;

  if (!query.trim()) return [];

  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  for (const product of products) {
    const name = product.name.toLowerCase();
    const sku = product.sku.toLowerCase();
    const barcode = (product.barcode || '').toLowerCase();

    let matchType: MatchType = 'partial';
    let score = 0;

    // 1. Exact barcode match (highest priority)
    if (barcode && barcode === q) {
      matchType = 'barcode';
      score = 1.0;
    }
    // 2. Exact SKU match
    else if (sku === q) {
      matchType = 'sku';
      score = 0.95;
    }
    // 3. SKU starts with query
    else if (sku.startsWith(q)) {
      matchType = 'sku';
      score = 0.85;
    }
    // 4. Exact name match
    else if (name === q) {
      matchType = 'exact';
      score = 0.9;
    }
    // 5. Name starts with query
    else if (name.startsWith(q)) {
      matchType = 'partial';
      score = 0.75;
    }
    // 6. Name contains query (word boundary)
    else if (name.includes(` ${q}`) || name.includes(`-${q}`)) {
      matchType = 'partial';
      score = 0.6;
    }
    // 7. Name contains query anywhere
    else if (name.includes(q)) {
      matchType = 'partial';
      score = 0.4;
    }
    // 8. SKU contains query
    else if (sku.includes(q)) {
      matchType = 'sku';
      score = 0.35;
    }
    // 9. Barcode contains query
    else if (barcode && barcode.includes(q)) {
      matchType = 'barcode';
      score = 0.3;
    }
    // 10. Fuzzy: split query into words and match all
    else {
      const words = q.split(/\s+/);
      const allMatch = words.every((w) => name.includes(w) || sku.includes(w));
      if (allMatch) {
        matchType = 'partial';
        score = 0.2;
      }
    }

    if (score >= minScore) {
      results.push({ product, matchType, score });
    }
  }

  // Sort by score descending, then alphabetically
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  return results.slice(0, limit);
}
