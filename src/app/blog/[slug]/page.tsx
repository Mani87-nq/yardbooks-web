import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { blogPosts, getBlogPost, blogContentMap } from '@/data/blog';
import JsonLd from '@/components/marketing/JsonLd';
import CallToAction from '@/components/marketing/CallToAction';
import { buildArticleSchema, buildBreadcrumbSchema } from '@/lib/seo/json-ld';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate all blog post pages at build time
export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

// Dynamic metadata per post
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | YaadBooks Blog`,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author.name }],
    alternates: { canonical: `https://yaadbooks.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      locale: 'en_JM',
      siteName: 'YaadBooks',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      creator: '@yaadbooks',
    },
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  'Market Insights': 'bg-blue-100 text-blue-700',
  Compliance: 'bg-amber-100 text-amber-700',
  Product: 'bg-emerald-100 text-emerald-700',
  Guides: 'bg-purple-100 text-purple-700',
};

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  // Dynamically import the content component
  const contentLoader = blogContentMap[slug];
  if (!contentLoader) notFound();

  const { default: Content } = await contentLoader();

  // Related posts (same category, excluding current)
  const related = blogPosts
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 2);

  // If not enough same-category, fill with recent posts
  if (related.length < 2) {
    const remaining = blogPosts
      .filter((p) => p.slug !== slug && !related.includes(p))
      .slice(0, 2 - related.length);
    related.push(...remaining);
  }

  return (
    <>
      {/* JSON-LD */}
      <JsonLd data={buildArticleSchema(post)} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://yaadbooks.com' },
          { name: 'Blog', url: 'https://yaadbooks.com/blog' },
          { name: post.title, url: `https://yaadbooks.com/blog/${post.slug}` },
        ])}
      />

      <article className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-emerald-600">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-emerald-600">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate">
              {post.title}
            </span>
          </nav>

          {/* Header */}
          <header className="mb-12">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {post.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-700 font-semibold text-xs">
                    {post.author.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-900 font-medium">
                    {post.author.name}
                  </span>
                  <span className="text-gray-400 mx-1">&middot;</span>
                  <span>{post.author.role}</span>
                </div>
              </div>
              <span className="text-gray-300">|</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-JM', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <span className="text-gray-300">|</span>
              <span>{post.readingTime}</span>
            </div>
          </header>

          {/* Article body */}
          <div className="prose prose-lg prose-emerald max-w-none">
            <Content />
          </div>

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Related Articles
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                      CATEGORY_COLORS[p.category] ||
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {p.category}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {p.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <CallToAction heading="Ready to Modernize Your Business?" />
    </>
  );
}
