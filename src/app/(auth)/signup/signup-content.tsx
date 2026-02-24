'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api, setAccessToken, ApiRequestError } from '@/lib/api-client';
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const INDUSTRIES = [
  'Agriculture',
  'Construction',
  'Education',
  'Food & Beverage',
  'Healthcare',
  'Manufacturing',
  'Professional Services',
  'Retail',
  'Technology',
  'Tourism & Hospitality',
  'Transportation',
  'Other',
];

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
  'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
  'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
];

const BUSINESS_TYPES = [
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_COMPANY', label: 'Limited Company' },
  { value: 'NGO', label: 'Non-Profit / NGO' },
  { value: 'OTHER', label: 'Other' },
];

const PLANS: Record<string, { name: string; priceMonthly: string; priceAnnual: string }> = {
  solo: { name: 'Solo', priceMonthly: '$19.99/mo after trial', priceAnnual: '$199.99/yr after trial' },
  team: { name: 'Team', priceMonthly: '$14.99/user/mo after trial', priceAnnual: '$149.99/user/yr after trial' },
};

// Google Icon SVG
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    activeCompanyId: string | null;
  };
  company: {
    id: string;
    businessName: string;
  } | null;
  accessToken: string;
}

export default function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setActiveCompany } = useAppStore();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Get selected plan and billing interval from URL
  const selectedPlan = searchParams.get('plan') || 'solo';
  const billingInterval = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly';
  const planData = PLANS[selectedPlan] || PLANS.solo;
  const planInfo = {
    name: planData.name,
    price: billingInterval === 'annual' ? planData.priceAnnual : planData.priceMonthly,
  };

  const [formData, setFormData] = useState({
    // Step 1: Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // Step 2: Business Info
    businessName: '',
    tradingName: '',
    businessType: 'SOLE_PROPRIETOR',
    industry: '',
    parish: '',
    trnNumber: '',
  });

  const handleNext = () => {
    setError('');
    setFieldErrors({});

    if (step === 1) {
      const errors: Record<string, string[]> = {};

      if (!formData.firstName.trim()) {
        errors.firstName = ['First name is required'];
      }
      if (!formData.lastName.trim()) {
        errors.lastName = ['Last name is required'];
      }
      if (!formData.email.trim()) {
        errors.email = ['Email is required'];
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = ['Please enter a valid email address'];
      }
      if (!formData.password) {
        errors.password = ['Password is required'];
      } else if (formData.password.length < 12) {
        errors.password = ['Password must be at least 12 characters'];
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = ['Passwords do not match'];
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    if (!formData.businessName.trim()) {
      setFieldErrors({ businessName: ['Business name is required'] });
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Create account
      const data = await api.post<RegisterResponse>('/api/auth/register', {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        companyName: formData.businessName,
        businessType: formData.businessType,
      });

      // Store access token in memory (cookie is already set by the server response)
      setAccessToken(data.accessToken);

      // Set user in store
      setUser({
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: 'admin',
        createdAt: new Date(),
      });

      // Set active company
      if (data.company) {
        setActiveCompany({
          id: data.company.id,
          businessName: data.company.businessName,
          tradingName: formData.tradingName,
          trnNumber: formData.trnNumber,
          email: formData.email,
          phone: formData.phone,
          address: '',
          parish: formData.parish,
          industry: formData.industry,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 14-day free trial — send to onboarding to complete company setup
      router.push('/dashboard/onboarding');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (err.status === 429) {
          setError('Too many registration attempts. Please wait a moment and try again.');
        } else if (err.errors) {
          setFieldErrors(err.errors);
          if (err.errors.password) {
            setStep(1); // Go back to step 1 if password error
          }
        } else {
          setError(err.detail ?? 'Registration failed. Please try again.');
        }
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldError = (field: string) => fieldErrors[field]?.[0];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 to-emerald-800 p-12 flex-col justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-200 hover:text-white transition-colors mb-8">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Pricing
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-600 font-bold text-xl">
              YB
            </div>
            <span className="text-2xl font-bold text-white">YaadBooks</span>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Start managing your<br />business today
          </h1>
          <p className="text-emerald-100 text-lg mb-8">
            Join thousands of Jamaican businesses using YaadBooks to streamline their operations.
          </p>

          {/* Selected Plan Display */}
          <div className="bg-emerald-700/50 rounded-xl p-4 mb-8">
            <p className="text-emerald-200 text-sm mb-1">Selected Plan</p>
            <p className="text-white text-xl font-bold">{planInfo.name} — {planInfo.price}</p>
            <Link href="/#pricing" className="text-emerald-300 text-sm hover:text-white">
              Change plan →
            </Link>
          </div>

          <div className="space-y-4">
            {[
              '14-day free trial, no credit card required',
              'Cancel anytime',
              'Jamaica-specific features',
              'GCT & tax compliance built-in',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-emerald-200 text-sm">
          Made with love in Jamaica
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile: Back to Pricing */}
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-6">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Pricing
          </Link>

          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl">
              YB
            </div>
            <span className="text-2xl font-bold text-gray-900">YaadBooks</span>
          </div>

          {/* Mobile: Selected Plan */}
          <div className="lg:hidden bg-emerald-50 rounded-xl p-4 mb-6">
            <p className="text-emerald-600 text-sm mb-1">Selected Plan</p>
            <p className="text-gray-900 text-lg font-bold">{planInfo.name} — {planInfo.price}</p>
            <Link href="/#pricing" className="text-emerald-600 text-sm hover:underline">
              Change plan →
            </Link>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step ? 'w-8 bg-emerald-600' : s < step ? 'w-8 bg-emerald-200' : 'w-8 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 1 ? 'Create your account' : 'Set up your business'}
          </h2>
          <p className="text-gray-500 mb-8">
            {step === 1 ? 'Enter your personal information' : 'Tell us about your business'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          getFieldError('firstName') ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="John"
                      />
                    </div>
                    {getFieldError('firstName') && (
                      <p className="mt-1 text-xs text-red-600">{getFieldError('firstName')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        getFieldError('lastName') ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Brown"
                    />
                    {getFieldError('lastName') && (
                      <p className="mt-1 text-xs text-red-600">{getFieldError('lastName')}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        getFieldError('email') ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {getFieldError('email') && (
                    <p className="mt-1 text-xs text-red-600">{getFieldError('email')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PhoneIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="876-xxx-xxxx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockClosedIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        getFieldError('password') ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Min. 12 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {getFieldError('password') && (
                    <p className="mt-1 text-xs text-red-600">{getFieldError('password')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      getFieldError('confirmPassword') ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Re-enter password"
                  />
                  {getFieldError('confirmPassword') && (
                    <p className="mt-1 text-xs text-red-600">{getFieldError('confirmPassword')}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Continue
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        getFieldError('businessName') ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Your Company Ltd."
                    />
                  </div>
                  {getFieldError('businessName') && (
                    <p className="mt-1 text-xs text-red-600">{getFieldError('businessName')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trading Name
                  </label>
                  <input
                    type="text"
                    value={formData.tradingName}
                    onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="DBA / Trade As name (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>{bt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parish
                    </label>
                    <select
                      value={formData.parish}
                      onChange={(e) => setFormData({ ...formData, parish: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select parish</option>
                      {PARISHES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TRN (Tax Registration Number)
                  </label>
                  <input
                    type="text"
                    value={formData.trnNumber}
                    onChange={(e) => setFormData({ ...formData, trnNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="XXX-XXX-XXX (optional)"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Creating account...' : 'Start Free Trial'}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Google Sign In — show on step 1 only */}
          {step === 1 && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.href = '/api/auth/oauth/google'}
                disabled={isLoading}
                className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <GoogleIcon className="w-5 h-5" />
                Sign up with Google
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign in
            </Link>
          </p>

          {step === 1 && (
            <p className="mt-4 text-center text-xs text-gray-400">
              By signing up, you agree to our{' '}
              <Link href="/legal/terms" className="text-emerald-600">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/legal/privacy" className="text-emerald-600">Privacy Policy</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
