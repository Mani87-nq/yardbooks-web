import Link from 'next/link';
import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import CallToAction from '@/components/marketing/CallToAction';
import JsonLd from '@/components/marketing/JsonLd';
import { buildProductSchema, buildBreadcrumbSchema } from '@/lib/seo/json-ld';

export const metadata: Metadata = {
  title: 'POS System for Jamaica | Point of Sale Software | YaadBooks',
  description:
    'Affordable POS system built for Jamaican businesses. GCT-ready receipts, inventory tracking, offline mode, and JMD support. Perfect for retail shops, restaurants, and salons.',
  keywords: [
    'POS system Jamaica',
    'point of sale Jamaica',
    'retail POS Jamaica',
    'restaurant POS Jamaica',
    'Jamaica cash register software',
    'GCT POS system',
  ],
  alternates: { canonical: 'https://yaadbooks.com/pos-system-jamaica' },
  openGraph: {
    title: 'POS System for Jamaica | YaadBooks',
    description:
      'Affordable POS system built for Jamaican businesses. GCT-ready receipts, inventory tracking, offline mode.',
    url: 'https://yaadbooks.com/pos-system-jamaica',
    type: 'website',
    locale: 'en_JM',
    siteName: 'YaadBooks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'POS System for Jamaica | YaadBooks',
    description:
      'Affordable POS system built for Jamaican businesses. GCT-ready receipts, inventory tracking, offline mode.',
    creator: '@yaadbooks',
  },
};

const FEATURES = [
  {
    title: 'GCT-Ready Receipts',
    description:
      'Every receipt automatically shows GCT breakdown at the correct rate — 15% standard, 25% telephone, 10% tourism. TRN included on every printout.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Inventory',
    description:
      'Track stock levels across multiple locations. Get low-stock alerts, automatic reorder points, and barcode scanning support.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: 'Works Offline',
    description:
      'Keep ringing up sales even when internet drops. All transactions sync automatically when connection returns — no lost sales.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
      </svg>
    ),
  },
  {
    title: 'Multi-Payment Support',
    description:
      'Accept cash (JMD & USD), credit/debit cards, and mobile payments. Split payments across methods on a single transaction.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: 'Staff Management',
    description:
      'Individual cashier logins, shift tracking, and sales performance reports. Know who sold what and when.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Sales Analytics',
    description:
      'Daily, weekly, and monthly sales reports. Track best-selling items, peak hours, and revenue trends at a glance.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function PosSystemJamicaPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <JsonLd
        data={buildProductSchema({
          name: 'YaadBooks POS System',
          description:
            'Point of sale system built for Jamaican businesses with GCT-ready receipts and offline mode.',
          url: 'https://yaadbooks.com/pos-system-jamaica',
          features: FEATURES.map((f) => f.title),
        })}
      />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://yaadbooks.com' },
          {
            name: 'POS System Jamaica',
            url: 'https://yaadbooks.com/pos-system-jamaica',
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
            POS System
            <br />
            <span className="text-emerald-600">for Jamaican Businesses</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Stop struggling with imported cash registers that can&apos;t handle GCT
            or print proper receipts. YaadBooks POS works the way Jamaican
            businesses actually operate.
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
              Why Jamaican Shops Need a Local POS
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Imported POS terminals and foreign software were not built for
              Jamaica&apos;s tax system or daily business reality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problem: 'No GCT on Receipts',
                detail:
                  'Foreign POS systems don\'t print proper GCT breakdowns. Your customers can\'t claim input tax credits and you risk TAJ penalties.',
              },
              {
                problem: 'Online-Only Systems',
                detail:
                  'Most cloud POS solutions stop working the moment your Wi-Fi goes down. In Jamaica, that means lost sales every week.',
              },
              {
                problem: 'USD Pricing',
                detail:
                  'Square, Shopify POS, and others charge in USD and process in USD. Your JMD business ends up paying exchange rate premiums on software fees.',
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
              Everything Your Shop Needs to Sell Smarter
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A complete point of sale system designed for Jamaican retail shops,
              restaurants, and service businesses.
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
            YaadBooks POS vs. Square for Jamaica
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 pr-4 text-gray-600 font-medium">Feature</th>
                  <th className="py-4 px-4 text-emerald-600 font-bold">YaadBooks POS</th>
                  <th className="py-4 pl-4 text-gray-400 font-medium">Square</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['GCT Receipts', 'Automatic (all rates)', 'Not supported'],
                  ['Offline Sales', 'Full offline mode', 'Limited'],
                  ['JMD Currency', 'Native', 'USD only'],
                  ['Inventory Tracking', 'Built-in with alerts', 'Basic'],
                  ['Staff Management', 'Per-cashier tracking', 'Add-on cost'],
                  ['Receipt Printing', 'Thermal + digital', 'Digital only'],
                  ['Local Support', '876-613-9119', 'US-based'],
                  ['Pricing', 'From FREE', 'From US$29/mo + fees'],
                ].map(([feature, yb, sq]) => (
                  <tr key={feature} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{feature}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{yb}</td>
                    <td className="py-3 pl-4 text-gray-500">{sq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Built for Every Type of Jamaican Business
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                type: 'Retail Shops',
                description:
                  'Barcode scanning, inventory management, and quick checkout for supermarkets, hardware stores, and boutiques across Jamaica.',
                icon: '🏪',
              },
              {
                type: 'Restaurants & Bars',
                description:
                  'Table management, kitchen display, split bills, and tip tracking for restaurants from Kingston to Montego Bay.',
                icon: '🍽️',
              },
              {
                type: 'Service Businesses',
                description:
                  'Appointment booking, service menus, and customer tracking for salons, barbershops, and auto shops.',
                icon: '✂️',
              },
            ].map((useCase) => (
              <div
                key={useCase.type}
                className="bg-white rounded-xl p-6 border border-gray-200"
              >
                <span className="text-3xl mb-4 block">{useCase.icon}</span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {useCase.type}
                </h3>
                <p className="text-gray-600 text-sm">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related articles */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Insights for Jamaican Business Owners
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Link
              href="/blog/caribbean-market-opportunity-accounting-software"
              className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-emerald-200 hover:shadow-md transition-all"
            >
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-3">
                Market Insights
              </span>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                The Massive Opportunity in Caribbean Accounting Software
              </h3>
              <p className="text-gray-600 text-sm">
                Why 425,000 Jamaican MSMEs need locally-built business software.
              </p>
            </Link>
            <Link
              href="/blog/caribbean-business-software-landscape-2026"
              className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-emerald-200 hover:shadow-md transition-all"
            >
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-3">
                Market Insights
              </span>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                The State of Business Software in the Caribbean: 2026 Report
              </h3>
              <p className="text-gray-600 text-sm">
                Cloud adoption, payment infrastructure, and digital readiness across the region.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <CallToAction heading="Switch to a POS System That Understands Jamaica" />
      <MarketingFooter />
    </div>
  );
}
