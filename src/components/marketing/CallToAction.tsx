import Link from 'next/link';

interface CallToActionProps {
  /** Override the heading text */
  heading?: string;
  /** Override the subtitle text */
  subtitle?: string;
}

export default function CallToAction({
  heading = 'Ready to Transform Your Business?',
  subtitle = 'Join hundreds of Jamaican businesses on the platform built for the Caribbean.',
}: CallToActionProps) {
  return (
    <section className="relative py-24 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-center overflow-hidden">
      {/* Subtle accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

      <div className="relative max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          {heading}
        </h2>
        <p className="text-xl text-gray-400 mb-8">{subtitle}</p>
        <Link
          href="/signup"
          className="inline-block bg-emerald-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/30"
        >
          Start Free — No Card Required
        </Link>
        <p className="mt-4 text-gray-500 text-sm">
          Free tier available forever. Upgrade anytime.
        </p>
      </div>
    </section>
  );
}
