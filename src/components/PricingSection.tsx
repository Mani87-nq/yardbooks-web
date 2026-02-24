'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const soloPriceMonthly = 19.99;
  const soloPriceAnnual = 199.99;
  const teamPriceMonthly = 14.99;
  const teamPriceAnnual = 149.99;

  const soloPrice = isAnnual ? soloPriceAnnual : soloPriceMonthly;
  const teamPrice = isAnnual ? teamPriceAnnual : teamPriceMonthly;

  const soloSuffix = isAnnual ? '/year' : '/month';
  const teamSuffix = isAnnual ? '/user/year' : '/user/month';

  const billingParam = isAnnual ? '&billing=annual' : '';

  // Monthly equivalent for annual
  const soloMonthlyEquiv = (soloPriceAnnual / 12).toFixed(2);
  const teamMonthlyEquiv = (teamPriceAnnual / 12).toFixed(2);

  const soloSavings = ((soloPriceMonthly * 12 - soloPriceAnnual) / (soloPriceMonthly * 12) * 100).toFixed(0);
  const teamSavings = ((teamPriceMonthly * 12 - teamPriceAnnual) / (teamPriceMonthly * 12) * 100).toFixed(0);

  return (
    <section id="pricing" className="py-20 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Every feature included. No hidden fees. Cancel anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                !isAnnual
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                isAnnual
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isAnnual
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                Save {soloSavings}%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Solo Plan */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Solo</h3>
            <p className="text-gray-500 text-sm mt-1">For individual business owners</p>
            <div className="mt-4 mb-2">
              <span className="text-4xl font-bold text-gray-900">
                ${isAnnual ? soloPrice.toFixed(2) : soloPrice.toFixed(2)}
              </span>
              <span className="text-gray-500">{soloSuffix}</span>
            </div>
            {isAnnual && (
              <p className="text-sm text-emerald-600 font-medium mb-4">
                Just ${soloMonthlyEquiv}/mo — 2 months free!
              </p>
            )}
            {!isAnnual && <div className="mb-6" />}
            <div className="text-sm text-gray-500 mb-6">
              1 user &bull; 1 company &bull; All features
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'All features included',
                'Invoicing & Quotations',
                'Point of Sale',
                'Inventory Management',
                'Payroll & Compliance',
                'Bank Reconciliation',
                'GCT & Tax Reports',
                'Email Support',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={`/signup?plan=solo${billingParam}`}
              className="block w-full text-center py-3 rounded-xl font-semibold transition-colors bg-gray-100 text-gray-900 hover:bg-gray-200"
            >
              Get Started
            </Link>
          </div>

          {/* Team Plan */}
          <div className="bg-white rounded-2xl p-8 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full">
              BEST VALUE
            </div>
            <h3 className="text-xl font-bold text-gray-900">Team</h3>
            <p className="text-gray-500 text-sm mt-1">For growing businesses</p>
            <div className="mt-4 mb-2">
              <span className="text-4xl font-bold text-gray-900">
                ${isAnnual ? teamPrice.toFixed(2) : teamPrice.toFixed(2)}
              </span>
              <span className="text-gray-500">{teamSuffix}</span>
            </div>
            {isAnnual && (
              <p className="text-sm text-emerald-600 font-medium mb-4">
                Just ${teamMonthlyEquiv}/mo per user — 2 months free!
              </p>
            )}
            {!isAnnual && <div className="mb-6" />}
            <div className="text-sm text-gray-500 mb-6">
              Unlimited users &bull; Unlimited companies
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Everything in Solo, plus:',
                'Unlimited team members',
                'Unlimited companies',
                'Role-based access control',
                'Priority Support',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={`/signup?plan=team${billingParam}`}
              className="block w-full text-center py-3 rounded-xl font-semibold transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Get Started
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-500 mt-8">
          All prices in USD. JMD payments accepted. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
