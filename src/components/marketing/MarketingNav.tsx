import Link from 'next/link';

interface MarketingNavProps {
  /** Highlight the active link in the nav */
  activeLink?: 'features' | 'pricing' | 'blog' | 'contact';
}

export default function MarketingNav({ activeLink }: MarketingNavProps) {
  const linkClass = (key: string) =>
    `hidden md:inline-block font-medium transition-colors ${
      activeLink === key
        ? 'text-emerald-600'
        : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg">
              YB
            </div>
            <span className="text-xl font-bold text-gray-900">YaadBooks</span>
          </Link>

          {/* Center links */}
          <div className="flex items-center gap-8">
            <a href="/#features" className={linkClass('features')}>
              Features
            </a>
            <a href="/#pricing" className={linkClass('pricing')}>
              Pricing
            </a>
            <Link href="/blog" className={linkClass('blog')}>
              Blog
            </Link>
            <Link href="/contact" className={linkClass('contact')}>
              Contact
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
