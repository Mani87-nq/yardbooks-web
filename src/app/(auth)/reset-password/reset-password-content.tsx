'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface PasswordRequirement {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 12 characters', test: (pw) => pw.length >= 12 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const requirementResults = useMemo(
    () => PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) })),
    [password]
  );

  const allRequirementsMet = requirementResults.every((r) => r.met);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link. No token found in the URL.');
      return;
    }

    if (!allRequirementsMet) {
      setError('Please ensure your password meets all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/api/auth/reset-password', { token, password }, { skipAuth: true });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) {
          setError('Too many attempts. Please wait a few minutes and try again.');
        } else if (
          err.detail?.toLowerCase().includes('expired') ||
          err.detail?.toLowerCase().includes('invalid')
        ) {
          setIsExpired(true);
          setError(err.detail);
        } else {
          setError(err.detail ?? 'Failed to reset password. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
              <XCircleIcon className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
            <p className="text-gray-500 mb-8">
              This password reset link is invalid. It may be missing the required token. Please request a new password reset.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Request New Reset Link
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Back to Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
              <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
            <p className="text-gray-500 mb-8">
              Your password has been updated. All existing sessions have been logged out for security. You can now sign in with your new password.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Expired / invalid token state
  if (isExpired) {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <MobileLogo />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-6">
              <XCircleIcon className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h2>
            <p className="text-gray-500 mb-8">
              {error || 'This password reset link has expired or is invalid. Please request a new one.'}
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Request New Reset Link
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Back to Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex">
      <BrandingPanel />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <MobileLogo />

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Set a new password</h2>
          <p className="text-gray-500 mb-8">
            Choose a strong password for your YaadBooks account.
          </p>

          {error && !isExpired && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter your new password"
                  autoFocus
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
            </div>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Password Requirements
                </p>
                {requirementResults.map((req) => (
                  <div key={req.label} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={req.met ? 'text-emerald-700' : 'text-gray-500'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-sm text-red-500">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1 text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircleIcon className="h-4 w-4" />
                  Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Back to Sign in
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
          Secure your account
        </h1>
        <p className="text-emerald-100 text-lg">
          Choose a strong, unique password to keep your business data safe.
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
