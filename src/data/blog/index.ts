export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  author: { name: string; role: string };
  publishedAt: string;
  updatedAt?: string;
  category: 'Market Insights' | 'Compliance' | 'Product' | 'Guides';
  tags: string[];
  readingTime: string;
  featured: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'caribbean-market-opportunity-accounting-software',
    title: 'The Massive Opportunity in Caribbean Accounting Software',
    description:
      'With 425,000 MSMEs in Jamaica and 82% of failures linked to poor accounting, the Caribbean market is ripe for locally-built financial software.',
    excerpt:
      'Jamaica alone has over 425,000 micro, small, and medium enterprises, yet the vast majority still rely on paper records, spreadsheets, or nothing at all. The gap between what foreign accounting software offers and what Caribbean businesses actually need has never been wider.',
    author: { name: 'YaadBooks Team', role: 'Market Research' },
    publishedAt: '2026-02-10T09:00:00Z',
    category: 'Market Insights',
    tags: [
      'caribbean',
      'accounting software',
      'Jamaica',
      'MSMEs',
      'small business',
      'market opportunity',
    ],
    readingTime: '8 min read',
    featured: true,
  },
  {
    slug: 'payroll-compliance-jamaica-guide',
    title: 'Payroll Compliance in Jamaica: What Every Employer Must Know',
    description:
      'A complete guide to Jamaican payroll deductions including PAYE, NIS, NHT, Education Tax, and HEART contributions with rates, deadlines, and best practices.',
    excerpt:
      'Running payroll in Jamaica means navigating five separate statutory deductions, each with its own rates, caps, and filing deadlines. Getting any of them wrong can result in penalties from TAJ. Here is what every Jamaican employer needs to understand.',
    author: { name: 'YaadBooks Team', role: 'Compliance' },
    publishedAt: '2026-02-14T09:00:00Z',
    category: 'Compliance',
    tags: [
      'payroll',
      'Jamaica',
      'PAYE',
      'NIS',
      'NHT',
      'Education Tax',
      'HEART',
      'compliance',
    ],
    readingTime: '10 min read',
    featured: true,
  },
  {
    slug: 'caribbean-business-software-landscape-2026',
    title: 'The State of Business Software in the Caribbean: 2026 Report',
    description:
      'An in-depth look at cloud software adoption, payment infrastructure, and digital readiness across Jamaica and the wider Caribbean in 2026.',
    excerpt:
      'Cloud SaaS adoption among Caribbean small businesses sits at just 8 to 15 percent, far below the 50 to 60 percent seen in North America. Understanding why reveals both the challenges and the enormous upside for the right solution.',
    author: { name: 'YaadBooks Team', role: 'Market Research' },
    publishedAt: '2026-02-18T09:00:00Z',
    category: 'Market Insights',
    tags: [
      'caribbean',
      'SaaS',
      'cloud software',
      'digital transformation',
      '2026',
      'market report',
    ],
    readingTime: '9 min read',
    featured: false,
  },
  {
    slug: 'accounting-features-your-business-needs',
    title: '10 Accounting Features Your Growing Business Actually Needs',
    description:
      'From bank reconciliation to audit trails, discover the must-have accounting software features that separate basic tools from serious business platforms.',
    excerpt:
      'Not all accounting software is built equal. While basic tools handle invoices and expenses, growing businesses need bank reconciliation, AR/AP aging, budgeting, and proper audit trails. Here is how to evaluate what you actually need.',
    author: { name: 'YaadBooks Team', role: 'Product' },
    publishedAt: '2026-02-22T09:00:00Z',
    category: 'Product',
    tags: [
      'accounting features',
      'bank reconciliation',
      'invoicing',
      'reporting',
      'small business',
      'software comparison',
    ],
    readingTime: '9 min read',
    featured: false,
  },
  {
    slug: 'taj-tax-compliance-guide-jamaica',
    title: 'TAJ Tax Compliance Guide: GCT, PAYE, and Filing Requirements for Jamaica',
    description:
      'Everything Jamaican businesses need to know about TAJ compliance, including GCT rates, filing deadlines, record-keeping rules, and penalty avoidance.',
    excerpt:
      'Tax Administration Jamaica requires electronic filing for most returns, strict record-keeping for at least six years, and timely payment of GCT and payroll taxes. Missing a deadline can cost your business thousands in penalties and interest.',
    author: { name: 'YaadBooks Team', role: 'Compliance' },
    publishedAt: '2026-02-26T09:00:00Z',
    category: 'Guides',
    tags: [
      'TAJ',
      'GCT',
      'tax compliance',
      'Jamaica',
      'filing deadlines',
      'PAYE',
      'record keeping',
    ],
    readingTime: '11 min read',
    featured: true,
  },
];

// Lazy content loaders – keyed by slug so blog/[slug]/page.tsx can
// dynamically import only the content that's needed at render time.
export const blogContentMap: Record<
  string,
  () => Promise<{ default: React.ComponentType }>
> = {
  'caribbean-market-opportunity-accounting-software': () =>
    import('./caribbean-market-opportunity'),
  'payroll-compliance-jamaica-guide': () =>
    import('./payroll-compliance-jamaica'),
  'caribbean-business-software-landscape-2026': () =>
    import('./caribbean-business-software-2026'),
  'accounting-features-your-business-needs': () =>
    import('./accounting-features-comparison'),
  'taj-tax-compliance-guide-jamaica': () =>
    import('./taj-tax-compliance-guide'),
};

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getAllSlugs(): string[] {
  return blogPosts.map((post) => post.slug);
}
