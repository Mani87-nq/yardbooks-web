'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import {
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export default function VerifyEmailPage() {
  return <VerifyEmailContent />;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>(
    token ? 'loading' : 'no-token'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token || hasVerified.current) return;
    hasVerified.current = true;

    async function verify() {
      try {
        await api.post('/api/auth/verify-email', { token }, { skipAuth: true });
        setStatus('success');
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (err) {
        setStatus('error');
        if (err instanceof ApiRequestError) {
          setErrorMessage(err.detail ?? 'Verification failed. Please try again.');
        } else {
          setErrorMessage('An unexpected error occurred. Please try again.');
        }
      }
    }

    verify();
  }, [token, router]);

  // No token in URL
  if (status === 'no-token') {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
              <XCircleIcon className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Verification Link</h2>
            <p className="text-gray-500 mb-8">
              This verification link is invalid. It may be missing the required token.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Back to Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-500">
              Please wait while we verify your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
              <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-gray-500 mb-8">
              Your email has been verified successfully. Redirecting to sign in...
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Sign in Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex">
      <BrandingPanel />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <MobileLogo />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-6">
            <XCircleIcon className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-gray-500 mb-8">
            {errorMessage || 'The verification link may have expired or is invalid. Please try signing up again.'}
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
          >
            Back to Sign in
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Create a new account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────

function BrandingPanel() {
  return (
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
          Verify your email
        </h1>
        <p className="text-emerald-100 text-lg">
          One quick step to secure your account and get started with YaadBooks.
        </p>
      </div>

      <div className="text-emerald-200 text-sm">
        Made with love in Jamaica
      </div>
    </div>
  );
}

function MobileLogo() {
  return (
    <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl">
        YB
      </div>
      <span className="text-2xl font-bold text-gray-900">YaadBooks</span>
    </div>
  );
}
