'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api-client';
import {
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface OnboardingData {
  // Step 1: Company Info
  businessName: string;
  trn: string;
  gctNumber: string;
  industry: string;
  street: string;
  city: string;
  parish: string;
  phone: string;
  // Step 2: Financial Settings
  fiscalYearStart: string;
  currency: string;
  gctRate: string;
  defaultPaymentTerms: string;
  // Step 3: First Customer (optional)
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
  'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
  'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
];

const INDUSTRIES = [
  'Retail & Wholesale', 'Food & Beverage', 'Professional Services',
  'Construction', 'Manufacturing', 'Agriculture', 'Tourism & Hospitality',
  'Technology', 'Transportation', 'Healthcare', 'Education', 'Real Estate', 'Other',
];

const steps = [
  { title: 'Company Info', icon: BuildingOffice2Icon, description: 'Tell us about your business' },
  { title: 'Financial Setup', icon: CurrencyDollarIcon, description: 'Configure your accounting' },
  { title: 'First Customer', icon: UserGroupIcon, description: 'Add your first customer (optional)' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { activeCompany } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<OnboardingData>({
    businessName: activeCompany?.businessName ?? '',
    trn: '',
    gctNumber: '',
    industry: '',
    street: '',
    city: '',
    parish: '',
    phone: '',
    fiscalYearStart: '01',
    currency: 'JMD',
    gctRate: '15',
    defaultPaymentTerms: '30',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });

  const updateField = useCallback(<K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleNext = () => {
    setError('');
    if (currentStep === 0) {
      if (!data.businessName.trim()) {
        setError('Business name is required');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Update company details
      if (activeCompany) {
        await api.put(`/api/v1/companies/${activeCompany.id}`, {
          businessName: data.businessName,
          trn: data.trn || undefined,
          gctNumber: data.gctNumber || undefined,
          industry: data.industry || undefined,
          street: data.street || undefined,
          city: data.city || undefined,
          parish: data.parish || undefined,
          phone: data.phone || undefined,
          fiscalYearStart: parseInt(data.fiscalYearStart),
          currency: data.currency,
          defaultPaymentTerms: parseInt(data.defaultPaymentTerms),
        });
      }

      // Create first customer if provided
      if (data.customerName.trim()) {
        await api.post('/api/v1/customers', {
          name: data.customerName,
          email: data.customerEmail || undefined,
          phone: data.customerPhone || undefined,
        });
      }

      // Mark onboarding complete
      if (activeCompany) {
        await api.put(`/api/v1/companies/${activeCompany.id}`, {
          onboardingCompleted: true,
        });
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg">
              YB
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Welcome to YaadBooks</h1>
              <p className="text-sm text-gray-500">Let&apos;s set up your business in a few steps</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.title}>
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    index === currentStep
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : index < currentStep
                        ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                        : 'text-gray-400'
                  }`}
                  disabled={index > currentStep}
                >
                  {index < currentStep ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${index < currentStep ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Company Info */}
        {currentStep === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-500 mt-1">Basic details about your business</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Dolphy's Auto Parts Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TRN (Tax Registration Number)</label>
                <input
                  type="text"
                  value={data.trn}
                  onChange={(e) => updateField('trn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="000-000-000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GCT Registration Number</label>
                <input
                  type="text"
                  value={data.gctNumber}
                  onChange={(e) => updateField('gctNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={data.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="876-000-0000"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={data.street}
                  onChange={(e) => updateField('street', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="123 King Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={data.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Kingston"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parish</label>
                <select
                  value={data.parish}
                  onChange={(e) => updateField('parish', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select parish</option>
                  {PARISHES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Financial Settings */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Financial Settings</h2>
              <p className="text-sm text-gray-500 mt-1">Configure your accounting defaults</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start Month</label>
                <select
                  value={data.fiscalYearStart}
                  onChange={(e) => updateField('fiscalYearStart', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={data.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="JMD">JMD - Jamaican Dollar</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GCT Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.gctRate}
                  onChange={(e) => updateField('gctRate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-gray-400 mt-1">Jamaica standard rate is 15%</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms (days)</label>
                <select
                  value={data.defaultPaymentTerms}
                  onChange={(e) => updateField('defaultPaymentTerms', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="0">Due on receipt</option>
                  <option value="7">Net 7</option>
                  <option value="14">Net 14</option>
                  <option value="30">Net 30</option>
                  <option value="60">Net 60</option>
                  <option value="90">Net 90</option>
                </select>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-emerald-800 mb-2">Jamaica-Specific Defaults</h3>
              <ul className="text-sm text-emerald-700 space-y-1">
                <li>&#8226; Chart of accounts pre-loaded with Jamaica standard GL codes</li>
                <li>&#8226; GCT rates configured for standard (15%), telecom (25%), and tourism (10%)</li>
                <li>&#8226; Parish-based customer/vendor addresses</li>
                <li>&#8226; JMD currency with support for USD transactions</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 3: First Customer */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add Your First Customer</h2>
              <p className="text-sm text-gray-500 mt-1">
                Optional — you can add customers later from the Customers page
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={data.customerName}
                  onChange={(e) => updateField('customerName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. ABC Hardware Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={data.customerEmail}
                  onChange={(e) => updateField('customerEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={data.customerPhone}
                  onChange={(e) => updateField('customerPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="876-000-0000"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">What&apos;s next?</h3>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>&#8226; Create your first invoice from the Invoices page</li>
                <li>&#8226; Set up your POS terminal for walk-in sales</li>
                <li>&#8226; Add your products and inventory</li>
                <li>&#8226; Invite team members from Settings &rarr; Team</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Setting up...' : 'Complete Setup'}
              <CheckCircleIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Skip link */}
        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
