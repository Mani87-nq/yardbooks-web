import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-16 px-4 border-t border-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg">
                YB
              </div>
              <span className="text-xl font-bold text-white">YaadBooks</span>
            </div>
            <p className="text-gray-500 mb-4">
              The all-in-one business operating system built for Jamaica and the
              Caribbean. Works offline.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2">
              <li>
                <a href="/#features" className="hover:text-white">
                  Core Features
                </a>
              </li>
              <li>
                <a href="/#modules" className="hover:text-white">
                  Industry Modules
                </a>
              </li>
              <li>
                <a href="/#offline" className="hover:text-white">
                  Offline Mode
                </a>
              </li>
              <li>
                <a href="/#pricing" className="hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-2">
              <li>Kingston, Jamaica</li>
              <li>support@yaadbooks.com</li>
              <li>
                <a href="tel:+18766139119" className="hover:text-white">
                  876-613-9119
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm">
            &copy; {new Date().getFullYear()} YaadBooks. Made with love in
            Jamaica.
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
