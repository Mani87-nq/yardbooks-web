import Link from 'next/link';
import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import CallToAction from '@/components/marketing/CallToAction';
import JsonLd from '@/components/marketing/JsonLd';
import { buildProductSchema, buildBreadcrumbSchema } from '@/lib/seo/json-ld';

export const metadata: Metadata = {
  title: 'Payroll Software for Jamaica | NIS NHT PAYE Compliant | YaadBooks',
  description:
    'Payroll software that auto-calculates PAYE, NIS, NHT, Education Tax, and HEART contributions for Jamaican businesses. Generate TAJ-ready reports. Start free.',
  keywords: [
    'payroll software Jamaica',
    'NIS NHT calculator Jamaica',
    'PAYE payroll Jamaica',
    'Jamaica payroll compliance',
    'Education Tax calculator',
    'HEART contribution Jamaica',
  ],
  alternates: { canonical: 'https://yaadbooks.com/payroll-software-jamaica' },
  openGraph: {
    title: 'Payroll Software for Jamaica | YaadBooks',
    description:
      'Payroll software that auto-calculates PAYE, NIS, NHT, Education Tax, and HEART for Jamaican businesses.',
    url: 'https://yaadbooks.com/payroll-software-jamaica',
    type: 'website',
    locale: 'en_JM',
    siteName: 'YaadBooks',
  },
};

const DEDUCTIONS = [
  {
    name: 'PAYE',
    fullName: 'Pay As You Earn',
    rate: '25% over threshold',
    description:
      'Income tax deducted at source. YaadBooks applies the annual tax-free threshold automatically and calculates the correct amount every pay period.',
  },
  {
    name: 'NIS',
    fullName: 'National Insurance Scheme',
    rate: '3% employee + 3% employer',
    description:
      'Social security contributions with a ceiling. YaadBooks tracks the maximum insurable wage and stops deductions at the cap.',
  },
  {
    name: 'NHT',
    fullName: 'National Housing Trust',
    rate: '2% employee + 3% employer',
    description:
      'Housing fund contributions on gross emoluments. Auto-calculated on every payslip with proper employer matching.',
  },
  {
    name: 'Education Tax',
    fullName: 'Education Tax',
    rate: '2.25% employee + 3.5% employer',
    description:
      'Calculated on gross emoluments after NIS. YaadBooks applies the correct rate for both employee and employer portions.',
  },
  {
    name: 'HEART',
    fullName: 'HEART/NSTA Trust',
    rate: '3% employer only',
    description:
      'Training levy paid entirely by the employer. Calculated on total gross payroll and included in your employer cost reports.',
  },
];

const FEATURES = [
  {
    title: 'Auto-Calculate All 5 Deductions',
    description:
      'PAYE, NIS, NHT, Education Tax, and HEART are computed instantly for every employee, every pay period. No spreadsheets needed.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'TAJ-Ready Reports',
    description:
      'Generate SO1, SO2, and annual returns in the exact format Tax Administration Jamaica requires. Download and file directly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Payslip Generation',
    description:
      'Professional payslips showing gross pay, all deductions with rates, net pay, and year-to-date totals. Email or print.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Leave & Attendance',
    description:
      'Track vacation days, sick leave, and attendance. Automatically adjust pay for absences and calculate pro-rated deductions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Multi-Pay Schedules',
    description:
      'Run weekly, fortnightly, or monthly payroll — or mix schedules for different employee groups. Each run auto-calculates correctly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Employee Self-Service',
    description:
      'Let employees view payslips, check leave balances, and update personal details. Reduce HR admin time significantly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function PayrollSoftwareJamicaPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <JsonLd
        data={buildProductSchema({
          name: 'YaadBooks Payroll Software',
          description:
            'Payroll software with automatic PAYE, NIS, NHT, Education Tax, and HEART calculation for Jamaican businesses.',
          url: 'https://yaadbooks.com/payroll-software-jamaica',
          features: FEATURES.map((f) => f.title),
        })}
      />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://yaadbooks.com' },
          {
            name: 'Payroll Software Jamaica',
            url: 'https://yaadbooks.com/payroll-software-jamaica',
          },
        ])}
      />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6">
            Jamaica Payroll Compliance
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Payroll Software
            <br />
            <span className="text-emerald-600">with Jamaican Compliance</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Stop spending hours on spreadsheets calculating PAYE, NIS, NHT,
            Education Tax, and HEART. YaadBooks handles all five statutory
            deductions automatically, every pay run.
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

      {/* Deductions breakdown */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              All 5 Jamaican Statutory Deductions — Automated
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every Jamaican employer must calculate and remit these deductions.
              YaadBooks handles the math so you never miss a rate or deadline.
            </p>
          </div>

          <div className="space-y-4">
            {DEDUCTIONS.map((deduction) => (
              <div
                key={deduction.name}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-emerald-200 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="md:w-32">
                    <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-sm">
                      {deduction.name}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">
                      {deduction.fullName}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({deduction.rate})
                      </span>
                    </h3>
                    <p className="text-gray-600 text-sm">{deduction.description}</p>
                  </div>
                </div>
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
              Payroll Features Built for Jamaica
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From hire to retire, manage your entire payroll process with
              confidence and compliance.
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
            YaadBooks vs. Manual Payroll Spreadsheets
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 pr-4 text-gray-600 font-medium">Task</th>
                  <th className="py-4 px-4 text-emerald-600 font-bold">YaadBooks</th>
                  <th className="py-4 pl-4 text-gray-400 font-medium">Spreadsheets</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['PAYE Calculation', 'Automatic with threshold', 'Manual formula'],
                  ['NIS/NHT/EdTax', 'Auto with caps & rates', 'Error-prone formulas'],
                  ['HEART Contribution', 'Auto-calculated', 'Often forgotten'],
                  ['Payslip Generation', 'One click', '30+ min per run'],
                  ['TAJ Reports (SO1/SO2)', 'Auto-generated', 'Manual preparation'],
                  ['Year-End Returns', 'One click', 'Days of work'],
                  ['Audit Trail', 'Complete history', 'None'],
                  ['Rate Updates', 'Automatic', 'Manual updates'],
                ].map(([task, yb, manual]) => (
                  <tr key={task} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{task}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{yb}</td>
                    <td className="py-3 pl-4 text-gray-500">{manual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CallToAction heading="Switch to Payroll Software That Knows Jamaica" />
      <MarketingFooter />
    </div>
  );
}
