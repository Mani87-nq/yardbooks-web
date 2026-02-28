import Link from 'next/link';
import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import CallToAction from '@/components/marketing/CallToAction';
import JsonLd from '@/components/marketing/JsonLd';
import { buildProductSchema, buildBreadcrumbSchema } from '@/lib/seo/json-ld';

export const metadata: Metadata = {
  title: 'Accounting Software for Jamaica | GCT Compliant | YaadBooks',
  description:
    'Cloud accounting software built for Jamaican businesses. Automatic GCT calculation, TAJ compliance reports, double-entry bookkeeping, and JMD support. Start free today.',
  keywords: [
    'accounting software Jamaica',
    'GCT accounting software',
    'Jamaica bookkeeping software',
    'TAJ compliant accounting',
    'cloud accounting Jamaica',
    'small business accounting Jamaica',
  ],
  alternates: { canonical: 'https://yaadbooks.com/accounting-software-jamaica' },
  openGraph: {
    title: 'Accounting Software for Jamaica | YaadBooks',
    description:
      'Cloud accounting software built for Jamaican businesses. Automatic GCT, TAJ compliance, JMD support.',
    url: 'https://yaadbooks.com/accounting-software-jamaica',
    type: 'website',
    locale: 'en_JM',
    siteName: 'YaadBooks',
  },
};

const FEATURES = [
  {
    title: 'Automatic GCT Calculation',
    description:
      'YaadBooks handles 15% standard, 25% telephone, and 10% tourism GCT rates automatically on every transaction.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Double-Entry Bookkeeping',
    description:
      'Full chart of accounts with journal entries, trial balance, and financial statements that meet IFRS standards.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'TAJ Compliance Reports',
    description:
      'Generate GCT returns, income tax reports, and annual filings that comply with Tax Administration Jamaica requirements.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Bank Reconciliation',
    description:
      'Connect with major Jamaican banks and automatically match transactions for accurate financial records.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: 'Multi-Currency Support',
    description:
      'Handle JMD, USD, GBP, CAD, and more with automatic exchange rate tracking for international transactions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Works Offline',
    description:
      'Keep working even when internet drops. YaadBooks syncs your data automatically when connection returns.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
      </svg>
    ),
  },
];

export default function AccountingSoftwareJamaicaPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <JsonLd
        data={buildProductSchema({
          name: 'YaadBooks Accounting Software',
          description:
            'Cloud accounting software built for Jamaican businesses with automatic GCT calculation and TAJ compliance.',
          url: 'https://yaadbooks.com/accounting-software-jamaica',
          features: FEATURES.map((f) => f.title),
        })}
      />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://yaadbooks.com' },
          {
            name: 'Accounting Software Jamaica',
            url: 'https://yaadbooks.com/accounting-software-jamaica',
          },
        ])}
      />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6">
            Built for Jamaica
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Accounting Software
            <br />
            <span className="text-emerald-600">Built for Jamaica</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Stop wrestling with foreign accounting tools that don&apos;t understand GCT,
            parishes, or TRN numbers. YaadBooks is built from the ground up for
            Jamaican businesses.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30"
            >
              Start Free — No Card Required
            </Link>
            <Link
              href="/contact"
              className="bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg border border-gray-300 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Jamaican Businesses Need Local Software
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              International accounting tools like QuickBooks and Xero were not
              designed for Jamaica&apos;s unique tax structure and business environment.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problem: 'No GCT Support',
                detail:
                  'QuickBooks doesn\'t understand Jamaica\'s multi-rate GCT system. You end up doing manual calculations for every invoice.',
              },
              {
                problem: 'USD-Centric',
                detail:
                  'Foreign tools default to USD pricing, force currency conversions, and don\'t handle JMD natively.',
              },
              {
                problem: 'No TAJ Reports',
                detail:
                  'You still need an accountant to manually prepare your TAJ filing because your software can\'t generate compliant reports.',
              },
            ].map((item) => (
              <div
                key={item.problem}
                className="bg-red-50 border border-red-100 rounded-xl p-6"
              >
                <h3 className="text-lg font-bold text-red-800 mb-2">
                  {item.problem}
                </h3>
                <p className="text-red-700 text-sm">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Books
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional accounting features designed specifically for
              Jamaican compliance and business practices.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            YaadBooks vs. QuickBooks for Jamaica
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 pr-4 text-gray-600 font-medium">Feature</th>
                  <th className="py-4 px-4 text-emerald-600 font-bold">YaadBooks</th>
                  <th className="py-4 pl-4 text-gray-400 font-medium">QuickBooks</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['GCT Calculation', 'Automatic (15%, 25%, 10%)', 'Manual setup'],
                  ['TAJ Reports', 'Built-in', 'Not available'],
                  ['JMD Currency', 'Native', 'Via conversion'],
                  ['Parish Support', 'Built-in', 'No'],
                  ['TRN/NIS Tracking', 'Built-in', 'Custom fields'],
                  ['Offline Mode', 'Full offline support', 'Online only'],
                  ['Local Support', '876-613-9119', 'US-based'],
                  ['Pricing', 'From FREE', 'From US$35/mo'],
                ].map(([feature, yb, qb]) => (
                  <tr key={feature} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{feature}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{yb}</td>
                    <td className="py-3 pl-4 text-gray-500">{qb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CallToAction heading="Switch to Accounting Software That Understands Jamaica" />
      <MarketingFooter />
    </div>
  );
}
