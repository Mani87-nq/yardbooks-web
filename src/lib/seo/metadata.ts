/**
 * Shared metadata helpers for consistent SEO across YaadBooks pages.
 */

import type { Metadata } from 'next';

const BASE_URL = 'https://yaadbooks.com';
const SITE_NAME = 'YaadBooks';

export function createPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
}): Metadata {
  const url = `${BASE_URL}${opts.path}`;

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      type: opts.type || 'website',
      locale: 'en_JM',
      siteName: SITE_NAME,
      ...(opts.publishedTime && { publishedTime: opts.publishedTime }),
      ...(opts.modifiedTime && { modifiedTime: opts.modifiedTime }),
      ...(opts.author && { authors: [opts.author] }),
      ...(opts.tags && { tags: opts.tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      creator: '@yaadbooks',
    },
  };
}
