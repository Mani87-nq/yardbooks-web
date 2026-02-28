import Link from 'next/link';
import type { Metadata } from 'next';
import { blogPosts } from '@/data/blog';

export const metadata: Metadata = {
  title: 'Blog | YaadBooks — Business Insights for Jamaica',
  description:
    'Expert articles on accounting, payroll compliance, POS systems, and business management for Jamaican businesses.',
  alternates: { canonical: 'https://yaadbooks.com/blog' },
  openGraph: {
    title: 'Blog | YaadBooks — Business Insights for Jamaica',
    description:
      'Expert articles on accounting, payroll compliance, POS systems, and business management for Jamaican businesses.',
    url: 'https://yaadbooks.com/blog',
    type: 'website',
    locale: 'en_JM',
    siteName: 'YaadBooks',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Market Insights': 'bg-blue-100 text-blue-700',
  Compliance: 'bg-amber-100 text-amber-700',
  Product: 'bg-emerald-100 text-emerald-700',
  Guides: 'bg-purple-100 text-purple-700',
};

export default function BlogListingPage() {
  // Sort: featured first, then by date descending
  const sortedPosts = [...blogPosts].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const featured = sortedPosts.find((p) => p.featured);
  const rest = sortedPosts.filter((p) => p !== featured);

  return (
    <div className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            YaadBooks Blog
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Insights on accounting, compliance, and running a successful
            business in Jamaica and the Caribbean.
          </p>
        </div>

        {/* Featured post */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block mb-16 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-8 md:p-12 hover:shadow-lg transition-shadow"
          >
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                CATEGORY_COLORS[featured.category] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {featured.category}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 group-hover:text-emerald-600 transition-colors">
              {featured.title}
            </h2>
            <p className="text-lg text-gray-600 mb-6 max-w-3xl">
              {featured.excerpt}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{featured.author.name}</span>
              <span>&middot;</span>
              <time dateTime={featured.publishedAt}>
                {new Date(featured.publishedAt).toLocaleDateString('en-JM', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <span>&middot;</span>
              <span>{featured.readingTime}</span>
            </div>
          </Link>
        )}

        {/* Post grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                  CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {post.category}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors line-clamp-2">
                {post.title}
              </h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {post.excerpt}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-JM', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                <span>&middot;</span>
                <span>{post.readingTime}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
