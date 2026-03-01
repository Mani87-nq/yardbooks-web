/**
 * Industry-Specific Default Categories
 *
 * Maps business industries (from onboarding) to sensible default product
 * categories. Also provides default menu and service categories for
 * restaurant and salon modules respectively.
 *
 * Used by:
 *   - `/api/v1/products/categories` (suggestions endpoint)
 *   - `seed-categories.ts` event handler (module activation)
 */

// ============================================
// PRODUCT CATEGORIES (by industry)
// ============================================

export const INDUSTRY_PRODUCT_CATEGORIES: Record<string, string[]> = {
  'Retail & Wholesale': [
    'Electronics',
    'Clothing & Apparel',
    'Home & Garden',
    'Health & Beauty',
    'Food & Grocery',
    'Office Supplies',
    'Sports & Outdoors',
    'Toys & Games',
    'Automotive',
    'General Merchandise',
  ],
  'Food & Beverage': [
    'Beverages',
    'Prepared Foods',
    'Snacks',
    'Baked Goods',
    'Frozen Foods',
    'Condiments & Sauces',
    'Dairy',
    'Meat & Seafood',
    'Produce',
    'Dry Goods',
  ],
  'Professional Services': [
    'Consulting',
    'Legal Services',
    'Accounting Services',
    'Marketing',
    'Training & Development',
    'IT Services',
    'Design Services',
    'Administrative',
    'Research',
    'Other Services',
  ],
  Construction: [
    'Building Materials',
    'Tools & Equipment',
    'Lumber',
    'Plumbing Supplies',
    'Electrical Supplies',
    'Paint & Finishing',
    'Hardware',
    'Safety Equipment',
    'Concrete & Masonry',
    'Roofing',
  ],
  Manufacturing: [
    'Raw Materials',
    'Components',
    'Finished Goods',
    'Packaging',
    'Industrial Supplies',
    'Machine Parts',
    'Chemicals',
    'Textiles',
    'Metals',
    'Plastics',
  ],
  Agriculture: [
    'Seeds & Plants',
    'Fertilizer',
    'Pesticides',
    'Farm Equipment',
    'Animal Feed',
    'Livestock',
    'Produce',
    'Dairy Products',
    'Tools',
    'Irrigation Supplies',
  ],
  'Tourism & Hospitality': [
    'Accommodation',
    'Tours & Activities',
    'Food & Beverage',
    'Transportation',
    'Souvenirs & Gifts',
    'Event Services',
    'Spa & Wellness',
    'Equipment Rental',
    'Guide Services',
    'Tickets',
  ],
  Technology: [
    'Software',
    'Hardware',
    'Cloud Services',
    'Networking',
    'Security',
    'Support & Maintenance',
    'Consulting',
    'Training',
    'Data Services',
    'Mobile Solutions',
  ],
  Transportation: [
    'Vehicle Parts',
    'Fuel',
    'Maintenance Services',
    'Freight Charges',
    'Passenger Services',
    'Logistics',
    'Insurance',
    'Permits & Licensing',
    'Storage',
    'Equipment',
  ],
  Healthcare: [
    'Medical Supplies',
    'Pharmaceuticals',
    'Lab Equipment',
    'Personal Protective Equipment',
    'Diagnostic Tools',
    'Patient Care',
    'Therapy Services',
    'Health Supplements',
    'Dental Supplies',
    'First Aid',
  ],
  Education: [
    'Textbooks',
    'School Supplies',
    'Technology',
    'Lab Materials',
    'Art Supplies',
    'Sports Equipment',
    'Uniforms',
    'Tutoring Services',
    'Course Materials',
    'Certifications',
  ],
  'Real Estate': [
    'Property Sales',
    'Property Rentals',
    'Maintenance Services',
    'Renovation Materials',
    'Legal Fees',
    'Appraisal Services',
    'Insurance',
    'Marketing Materials',
    'Staging',
    'Management Fees',
  ],
  Other: ['Products', 'Services', 'Materials', 'Equipment', 'Supplies'],
};

// ============================================
// RESTAURANT MENU CATEGORIES
// ============================================

export const RESTAURANT_DEFAULT_CATEGORIES = [
  { name: 'Appetizers', sortOrder: 1 },
  { name: 'Entrees', sortOrder: 2 },
  { name: 'Sides', sortOrder: 3 },
  { name: 'Soups & Salads', sortOrder: 4 },
  { name: 'Desserts', sortOrder: 5 },
  { name: 'Beverages', sortOrder: 6 },
  { name: 'Specials', sortOrder: 7 },
  { name: 'Kids Menu', sortOrder: 8 },
  { name: 'Breakfast', sortOrder: 9 },
  { name: 'Bar & Cocktails', sortOrder: 10 },
];

// ============================================
// SALON SERVICE CATEGORIES
// ============================================

export const SALON_DEFAULT_CATEGORIES = [
  { name: 'Haircuts', sortOrder: 1 },
  { name: 'Hair Colouring', sortOrder: 2 },
  { name: 'Braids & Extensions', sortOrder: 3 },
  { name: 'Nails', sortOrder: 4 },
  { name: 'Facials & Skincare', sortOrder: 5 },
  { name: 'Waxing', sortOrder: 6 },
  { name: 'Makeup', sortOrder: 7 },
  { name: 'Massage & Spa', sortOrder: 8 },
  { name: 'Treatments', sortOrder: 9 },
  { name: 'Packages', sortOrder: 10 },
];

/**
 * Get product category suggestions for a given industry.
 * Falls back to 'Other' if industry is not recognized.
 */
export function getIndustryCategories(industry: string | null | undefined): string[] {
  if (!industry) return INDUSTRY_PRODUCT_CATEGORIES['Other'];
  return INDUSTRY_PRODUCT_CATEGORIES[industry] ?? INDUSTRY_PRODUCT_CATEGORIES['Other'];
}
