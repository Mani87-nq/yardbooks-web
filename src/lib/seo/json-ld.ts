/**
 * JSON-LD schema builder functions for YaadBooks SEO.
 *
 * Each function returns a plain object ready to be serialized
 * as JSON-LD via the <JsonLd> component.
 */

import type { BlogPost } from '@/data/blog';

// ============================================
// ORGANIZATION (Homepage)
// ============================================

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'YaadBooks',
    url: 'https://yaadbooks.com',
    logo: 'https://yaadbooks.com/icons/icon-512x512.png',
    description: "Jamaica's Complete Business Management Solution",
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kingston',
      addressCountry: 'JM',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-876-613-9119',
      contactType: 'customer service',
      email: 'support@yaadbooks.com',
      availableLanguage: 'English',
    },
    sameAs: [
      'https://twitter.com/yaadbooks',
      'https://facebook.com/yaadbooks',
      'https://instagram.com/yaadbooks',
      'https://linkedin.com/company/yaadbooks',
    ],
  };
}

// ============================================
// SOFTWARE APPLICATION (Homepage)
// ============================================

export function buildSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'YaadBooks',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://yaadbooks.com',
    description:
      'All-in-one business management software for Jamaica: accounting, POS, payroll, invoicing, inventory.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '149.99',
      offerCount: '4',
    },
    featureList: [
      'Invoicing with GCT',
      'Point of Sale',
      'Payroll with NIS/NHT/PAYE',
      'Inventory Management',
      'Bank Reconciliation',
      'Offline Mode',
    ],
  };
}

// ============================================
// ARTICLE (Blog posts)
// ============================================

export function buildArticleSchema(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'YaadBooks',
      logo: {
        '@type': 'ImageObject',
        url: 'https://yaadbooks.com/icons/icon-512x512.png',
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    mainEntityOfPage: `https://yaadbooks.com/blog/${post.slug}`,
    image: `https://yaadbooks.com/blog/${post.slug}/opengraph-image`,
  };
}

// ============================================
// LOCAL BUSINESS (Contact page)
// ============================================

export function buildLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'YaadBooks',
    description: "Jamaica's Complete Business Management Solution",
    url: 'https://yaadbooks.com',
    telephone: '+1-876-613-9119',
    email: 'support@yaadbooks.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kingston',
      addressCountry: 'JM',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '09:00',
        closes: '13:00',
      },
    ],
  };
}

// ============================================
// FAQ PAGE (Contact page)
// ============================================

export function buildFaqSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ============================================
// PRODUCT (SEO Landing pages)
// ============================================

export function buildProductSchema(product: {
  name: string;
  description: string;
  url: string;
  features: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url: product.url,
    brand: { '@type': 'Brand', name: 'YaadBooks' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '149.99',
    },
    additionalProperty: product.features.map((f) => ({
      '@type': 'PropertyValue',
      name: 'Feature',
      value: f,
    })),
  };
}

// ============================================
// BREADCRUMB (Any page)
// ============================================

export function buildBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
