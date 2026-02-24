'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import api, { setAccessToken } from '@/lib/api-client';
import {
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  CheckIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export function Header() {
  const router = useRouter();
  const { setSidebarOpen, user, activeCompany, companies, switchCompany, clearCompanyData } = useAppStore();
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [switchingCompany, setSwitchingCompany] = useState(false);

  const handleSwitchCompany = async (companyId: string) => {
    if (companyId === activeCompany?.id || switchingCompany) return;
    setSwitchingCompany(true);
    setShowCompanyDropdown(false);
    try {
      const res = await api.patch<{ accessToken: string; companyId: string }>(
        '/api/v1/user/active-company',
        { companyId }
      );

      // Update the in-memory access token so subsequent requests use the new one
      setAccessToken(res.accessToken);

      // Update local store state immediately (for optimistic UI)
      switchCompany(companyId);
      clearCompanyData();

      // Full page reload to re-hydrate all company-scoped data with new JWT
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Failed to switch company:', error);
      setSwitchingCompany(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        // Cookies are httpOnly — server cleared them in the logout response.
        // Clear in-memory token and redirect to login.
        setAccessToken(null);
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden -ml-2 p-2 rounded-md hover:bg-gray-100"
        >
          <Bars3Icon className="h-6 w-6 text-gray-600" />
        </button>

        {/* Company Switcher */}
        {companies.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <BuildingOfficeIcon className="h-5 w-5 text-emerald-600" />
              <span className="hidden sm:block text-sm font-medium text-gray-900 max-w-[150px] truncate">
                {activeCompany?.tradingName || activeCompany?.businessName}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            </button>

            {showCompanyDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCompanyDropdown(false)}
                />
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    Switch Company
                  </div>
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      disabled={switchingCompany}
                      onClick={() => handleSwitchCompany(company.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-700 font-medium text-sm">
                          {company.businessName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {company.tradingName || company.businessName}
                        </div>
                        <div className="text-xs text-gray-500">{company.industry}</div>
                      </div>
                      {activeCompany?.id === company.id && (
                        <CheckIcon className="h-5 w-5 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Search */}
        <div className="hidden sm:flex items-center">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices, customers, products..."
              className="w-64 lg:w-96 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Currency Display */}
        <div className="hidden md:flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
          {activeCompany?.currency || 'JMD'}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <BellIcon className="h-6 w-6 text-gray-600" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User Menu with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100"
          >
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
            <div className="hidden lg:block text-left">
              <div className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-gray-500">
                {activeCompany?.businessName}
              </div>
            </div>
            <ChevronDownIcon className="hidden lg:block h-4 w-4 text-gray-500" />
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      router.push('/profile');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <UserIcon className="h-4 w-4" />
                    Your Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </button>
                </div>

                {/* Sign Out */}
                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    {loggingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
