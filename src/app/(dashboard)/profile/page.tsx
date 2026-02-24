'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useUserStore } from '@/store/userStore';
import {
  KeyIcon,
  CheckIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

// Role display labels
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  cashier: 'Cashier',
  user: 'User',
  staff: 'Staff',
};

// Role badge colors
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  supervisor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  accountant: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cashier: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  staff: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function ProfilePage() {
  // appStore.user is ALWAYS persisted — this is the reliable source of truth
  const user = useAppStore((state) => state.user);
  const updateAppUser = useAppStore((state) => state.updateUser);
  const { updateUser: updateStoreUser } = useUserStore();

  // ── Profile form state ──
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // ── PIN form state ──
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Populate form fields from appStore user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation helpers ──
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidPhone = (v: string) => !v || /^[+]?[\d\s()-]{7,20}$/.test(v);

  // ── Save profile ──
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirst) {
      setProfileError('First name is required');
      return;
    }
    if (!trimmedLast) {
      setProfileError('Last name is required');
      return;
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setProfileError('Please enter a valid email address');
      return;
    }
    if (!isValidPhone(trimmedPhone)) {
      setProfileError('Phone must be 7-20 characters (digits, spaces, dashes, parentheses)');
      return;
    }

    if (!user?.id) return;

    setProfileSaving(true);
    try {
      const response = await fetch(`/api/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          phone: trimmedPhone,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setProfileError(errData.error || 'Failed to save profile');
        return;
      }

      // Update both stores so the UI reflects changes immediately
      const updates = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
        phone: trimmedPhone,
        updatedAt: new Date(),
      };

      updateAppUser(updates);
      updateStoreUser(user.id, updates);
      setProfileSuccess('Profile updated successfully!');
    } catch {
      setProfileError('Network error. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change PIN ──
  const handleChangePIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (!newPin) {
      setPinError('Please enter a new PIN');
      return;
    }
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('PIN must contain only numbers');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    if (!user?.id) return;

    setPinSaving(true);
    try {
      const response = await fetch(`/api/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setPinError(errData.error || 'Failed to update PIN on server');
        return;
      }

      // PIN is hashed and stored in DB by the API call above.
      // Do NOT store plaintext PIN in client-side state — it creates security issues
      // and causes stale data in the SupervisorPinModal override system.
      updateStoreUser(user.id, { updatedAt: new Date() });
      setPinSuccess('Your PIN has been updated successfully!');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setPinError('Network error. Please try again.');
    } finally {
      setPinSaving(false);
    }
  };

  // ── No user state ──
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Unable to load profile. Please try logging in again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = user.role || 'cashier';
  const roleLabel = ROLE_LABELS[role] || role;
  const roleBadgeColor = ROLE_COLORS[role] || ROLE_COLORS.cashier;
  const initials = `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400">Edit your personal information and PIN</p>
      </div>

      {/* ── Card 1: Profile Information (editable) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PencilSquareIcon className="w-5 h-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Employee ID Badge */}
          {user.employeeNumber && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  #{user.employeeNumber}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee ID</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">#{user.employeeNumber}</p>
              </div>
            </div>
          )}

          {/* Avatar + Role (read-only) */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {initials}
              </span>
            </div>
            <div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${roleBadgeColor}`}>
                {roleLabel}
              </span>
              {user.createdAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Editable form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-600 dark:text-green-400">{profileSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setProfileSuccess(''); }}
                placeholder="First name"
                required
              />
              <Input
                label="Last Name"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setProfileSuccess(''); }}
                placeholder="Last name"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setProfileSuccess(''); }}
              placeholder="you@example.com"
              required
            />

            <Input
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setProfileSuccess(''); }}
              placeholder="+1 (876) 555-1234"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={profileSaving}
                icon={<CheckIcon className="w-4 h-4" />}
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Card 2: Change PIN ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5" />
            Change PIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePIN} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your PIN is used for quick login at the POS terminal. Enter a new 4-6 digit PIN to change it.
            </p>

            {pinError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>
              </div>
            )}

            {pinSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-600 dark:text-green-400">{pinSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="New PIN"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••••"
                maxLength={6}
              />
              <Input
                label="Confirm PIN"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••••"
                maxLength={6}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={pinSaving}
                icon={<CheckIcon className="w-4 h-4" />}
              >
                {pinSaving ? 'Saving...' : 'Update PIN'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Info notices ── */}
      <div className="space-y-3">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Your role and status can only be changed by an administrator.
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Security Notice</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Your PIN should be kept confidential. If you believe someone else knows your PIN, change it immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
