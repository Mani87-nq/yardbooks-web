import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/invoices/',
          '/customers/',
          '/expenses/',
          '/inventory/',
          '/payroll/',
          '/banking/',
          '/accounting/',
          '/reports/',
          '/settings/',
          '/profile/',
          '/pos/',
          '/quotations/',
          '/fixed-assets/',
          '/notifications/',
        ],
      },
    ],
    sitemap: 'https://yaadbooks.com/sitemap.xml',
  };
}
