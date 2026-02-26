'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api, ApiRequestError } from '@/lib/api-client';
import { EnvelopeIcon } from '@heroicons/react/24/outline';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/api/auth/forgot-password', { email }, { skipAuth: true });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) {
          setError('Too many requests. Please wait a few minutes and try again.');
        } else {
          setError(err.detail ?? 'Something went wrong. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 to-emerald-800 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-600 font-bold text-xl">
              YB
            </div>
            <span className="text-2xl font-bold text-white">YaadBooks</span>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Reset your password
          </h1>
          <p className="text-emerald-100 text-lg">
            No worries, it happens to the best of us. We&apos;ll send you a link to get back into your account.
          </p>
        </div>

        <div className="text-emerald-200 text-sm">
          Made with love in Jamaica
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 dark:bg-gray-900">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl">
              YB
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">YaadBooks</span>
          </div>

          {submitted ? (
            /* Success State */
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-6">
                <EnvelopeIcon className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                If an account exists with <strong className="text-gray-700 dark:text-gray-300">{email}</strong>, you&apos;ll receive a password reset link shortly. The link expires in 1 hour.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  try again
                </button>
              </p>
              <Link
                href="/login"
                className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
              >
                Back to Sign in
              </Link>
            </div>
          ) : (
            /* Form State */
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Forgot your password?</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="you@example.com"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Remember your password?{' '}
                <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
