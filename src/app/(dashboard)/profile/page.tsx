'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import {
  CheckIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  CameraIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

// Role display labels
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  user: 'User',
  staff: 'Staff',
};

// Role badge colors
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  staff: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function ProfilePage() {
  const user = useAppStore((state) => state.user);
  const updateAppUser = useAppStore((state) => state.updateUser);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Populate form fields from user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAvatarUrl((user as any).avatarUrl || null);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setAvatarError('');
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`/api/auth/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setAvatarError(err.error || 'Failed to upload photo');
        return;
      }

      const data = await res.json();
      setAvatarUrl(data.avatarUrl);
      updateAppUser({ avatarUrl: data.avatarUrl } as any);
      setProfileSuccess('Photo updated!');
    } catch {
      setAvatarError('Network error uploading photo.');
    } finally {
      setAvatarUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Avatar remove handler
  const handleAvatarRemove = async () => {
    if (!user?.id) return;
    setAvatarError('');
    setAvatarUploading(true);

    try {
      const res = await fetch(`/api/auth/users/${user.id}/avatar`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        setAvatarError(err.error || 'Failed to remove photo');
        return;
      }
      setAvatarUrl(null);
      updateAppUser({ avatarUrl: null } as any);
      setProfileSuccess('Photo removed.');
    } catch {
      setAvatarError('Network error.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Validation helpers
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidPhone = (v: string) => !v || /^[+]?[\d\s()-]{7,20}$/.test(v);

  // Save profile
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

      // Update app store
      const updates = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
        phone: trimmedPhone,
        updatedAt: new Date().toISOString(),
      };

      updateAppUser(updates);
      setProfileSuccess('Profile updated successfully!');
    } catch {
      setProfileError('Network error. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // No user state
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

  const role = user.role || 'user';
  const roleLabel = ROLE_LABELS[role] || role;
  const roleBadgeColor = ROLE_COLORS[role] || ROLE_COLORS.user;
  const initials = `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400">Edit your personal information</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PencilSquareIcon className="w-5 h-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Avatar + Role */}
          <div className="flex items-center gap-4 mb-6">
            {/* Uploadable Avatar */}
            <div className="relative group flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${user.firstName}'s photo`}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {initials}
                  </span>
                </div>
              )}
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CameraIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
              />
              {/* Remove button (when photo exists) */}
              {avatarUrl && !avatarUploading && (
                <button
                  onClick={handleAvatarRemove}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                  title="Remove photo"
                >
                  <TrashIcon className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
            <div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${roleBadgeColor}`}>
                {roleLabel}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Click photo to change
              </p>
              {avatarError && (
                <p className="text-xs text-red-500 mt-1">{avatarError}</p>
              )}
              {user.createdAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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

      {/* Info notice */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Your role and status can only be changed by an administrator.
        </p>
      </div>
    </div>
  );
}
