import Link from 'next/link';
import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import CallToAction from '@/components/marketing/CallToAction';
import JsonLd from '@/components/marketing/JsonLd';
import { buildProductSchema, buildBreadcrumbSchema } from '@/lib/seo/json-ld';

export const metadata: Metadata = {
  title: 'Invoicing Software for Jamaica | GCT Invoices | YaadBooks',
  description:
    'Professional invoicing software for Jamaican businesses. Create GCT-compliant invoices with TRN, track payments in JMD, send reminders, and manage accounts receivable.',
  keywords: [
    'invoicing software Jamaica',
    'GCT invoice Jamaica',
    'Jamaica invoice generator',
    'professional invoicing Jamaica',
    'accounts receivable Jamaica',
    'invoice tracking JMD',
  ],
  alternates: { canonical: 'https://yaadbooks.com/invoicing-software-jamaica' },
  openGraph: {
    title: 'Invoicing Software for Jamaica | YaadBooks',
    description:
      'Professional invoicing software with GCT compliance, JMD support, and payment tracking for Jamaican businesses.',
    url: 'https://yaadbooks.com/invoicing-software-jamaica',
    type: 'website',
    locale: 'en_JM',
    siteName: 'YaadBooks',
  },
};

const FEATURES = [
  {
    title: 'GCT-Compliant Invoices',
    description:
      'Every invoice includes your TRN, applies the correct GCT rate, and shows the tax breakdown required by TAJ regulations.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Payment Tracking',
    description:
      'See which invoices are paid, overdue, or pending at a glance. Track partial payments and outstanding balances in real time.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Automatic Reminders',
    description:
      'Set up payment reminders that go out automatically when invoices are due or overdue. Get paid faster without awkward follow-ups.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: 'Multi-Currency Invoicing',
    description:
      'Bill in JMD, USD, GBP, or CAD. Perfect for businesses that work with international clients or tourism customers.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Professional Templates',
    description:
      'Choose from clean, professional invoice templates. Add your logo, brand colours, and custom payment terms.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    title: 'Recurring Invoices',
    description:
      'Set up recurring invoices for retainer clients or monthly services. They go out automatically on your schedule.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
];

export default function InvoicingSoftwareJamicaPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <JsonLd
        data={buildProductSchema({
          name: 'YaadBooks Invoicing Software',
          description:
            'Professional invoicing software with GCT compliance and JMD support for Jamaican businesses.',
          url: 'https://yaadbooks.com/invoicing-software-jamaica',
          features: FEATURES.map((f) => f.title),
        })}
      />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://yaadbooks.com' },
          {
            name: 'Invoicing Software Jamaica',
            url: 'https://yaadbooks.com/invoicing-software-jamaica',
          },
        ])}
      />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6">
            Professional Invoicing
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Professional Invoicing
            <br />
            <span className="text-emerald-600">for Jamaican Businesses</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Stop sending invoices from Word documents and Excel templates. Create
            GCT-compliant, professional invoices in seconds and get paid faster.
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
              Why Your Current Invoicing Process Is Costing You Money
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Manual invoicing leads to errors, late payments, and GCT
              non-compliance that can trigger TAJ penalties.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problem: 'GCT Errors',
                detail:
                  'Manually calculating GCT on every invoice leads to mistakes. Wrong rates, missing TRN numbers, and incorrect totals put your TAJ compliance at risk.',
              },
              {
                problem: 'Late Payments',
                detail:
                  'Without automatic tracking and reminders, invoices fall through the cracks. The average small business in Jamaica waits 45+ days for payment.',
              },
              {
                problem: 'Unprofessional Appearance',
                detail:
                  'Word documents and handwritten invoices don\'t inspire confidence. Professional invoicing signals credibility and encourages prompt payment.',
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
              Create, Send, and Track Invoices with Ease
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage your invoicing professionally and
              stay GCT-compliant.
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

      {/* Invoice walkthrough */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Create a Professional Invoice in 3 Steps
          </h2>
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Add Your Client & Items',
                description:
                  'Select a saved client or add a new one. Add line items with quantities, prices, and the correct GCT rate. YaadBooks does the math.',
              },
              {
                step: '2',
                title: 'Review & Send',
                description:
                  'Preview your professional invoice with logo, TRN, GCT breakdown, and payment terms. Send via email or download as PDF.',
              },
              {
                step: '3',
                title: 'Track & Get Paid',
                description:
                  'Monitor payment status in real time. Automatic reminders go out on your schedule. Record payments when they arrive.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-6 items-start"
              >
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            YaadBooks vs. Manual Invoicing
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 pr-4 text-gray-600 font-medium">Feature</th>
                  <th className="py-4 px-4 text-emerald-600 font-bold">YaadBooks</th>
                  <th className="py-4 pl-4 text-gray-400 font-medium">Word/Excel</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['GCT Calculation', 'Automatic (all rates)', 'Manual & error-prone'],
                  ['TRN on Invoice', 'Auto-included', 'Often forgotten'],
                  ['Payment Tracking', 'Real-time dashboard', 'Manual spreadsheet'],
                  ['Payment Reminders', 'Automatic emails', 'Manual follow-up'],
                  ['Multi-Currency', 'JMD, USD, GBP, CAD', 'Manual conversion'],
                  ['Recurring Invoices', 'Automatic', 'Copy & paste each time'],
                  ['Professional Design', 'Branded templates', 'Basic formatting'],
                  ['Reports', 'AR aging, revenue', 'Not available'],
                ].map(([feature, yb, manual]) => (
                  <tr key={feature} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{feature}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{yb}</td>
                    <td className="py-3 pl-4 text-gray-500">{manual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CallToAction heading="Start Sending Professional Invoices Today" />
      <MarketingFooter />
    </div>
  );
}
