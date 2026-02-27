'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBagIcon,
  StarIcon,
  TagIcon,
  IdentificationIcon,
  UsersIcon,
  ArrowRightIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface RetailStats {
  activePrograms: number;
  totalPrograms: number;
  totalMembers: number;
  activePromotions: number;
  totalPromotions: number;
  totalSegments: number;
}

// ============================================
// STAT CARD
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

// ============================================
// NAV CARD
// ============================================

function NavCard({
  icon: Icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer h-full flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color} flex-shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
            <ArrowRightIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function RetailPage() {
  const [stats, setStats] = useState<RetailStats>({
    activePrograms: 0,
    totalPrograms: 0,
    totalMembers: 0,
    activePromotions: 0,
    totalPromotions: 0,
    totalSegments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);

        // Fetch data from all three endpoints in parallel
        const [loyaltyRes, promotionsRes, segmentsRes] = await Promise.allSettled([
          fetch('/api/modules/retail/loyalty?includeInactive=true'),
          fetch('/api/modules/retail/promotions?limit=100'),
          fetch('/api/modules/retail/segments?includeInactive=true'),
        ]);

        let activePrograms = 0;
        let totalPrograms = 0;
        let totalMembers = 0;

        if (loyaltyRes.status === 'fulfilled' && loyaltyRes.value.ok) {
          const data = await loyaltyRes.value.json();
          const programs = data.data || [];
          totalPrograms = programs.length;
          activePrograms = programs.filter((p: { isActive: boolean }) => p.isActive).length;
          totalMembers = programs.reduce(
            (sum: number, p: { _count?: { members?: number } }) =>
              sum + (p._count?.members || 0),
            0
          );
        }

        let activePromotions = 0;
        let totalPromotions = 0;

        if (promotionsRes.status === 'fulfilled' && promotionsRes.value.ok) {
          const data = await promotionsRes.value.json();
          totalPromotions = data.total || 0;
          const promos = data.data || [];
          const now = new Date();
          activePromotions = promos.filter((p: { isActive: boolean; startDate: string; endDate: string | null }) => {
            if (!p.isActive) return false;
            const start = new Date(p.startDate);
            const end = p.endDate ? new Date(p.endDate) : null;
            return start <= now && (!end || end >= now);
          }).length;
        }

        let totalSegments = 0;

        if (segmentsRes.status === 'fulfilled' && segmentsRes.value.ok) {
          const data = await segmentsRes.value.json();
          totalSegments = (data.data || []).length;
        }

        setStats({
          activePrograms,
          totalPrograms,
          totalMembers,
          activePromotions,
          totalPromotions,
          totalSegments,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load retail data');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <XCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Failed to load</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      icon: StarIcon,
      title: 'Loyalty Programs',
      description: 'Create and manage point-based loyalty programs to reward your customers',
      href: '/retail/loyalty',
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: TagIcon,
      title: 'Promotions',
      description: 'Set up discounts, promo codes, and special offers for your products',
      href: '/retail/promotions',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      icon: IdentificationIcon,
      title: 'Member Cards',
      description: 'View and manage loyalty member cards, tiers, and point balances',
      href: '/retail/members',
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
    {
      icon: UsersIcon,
      title: 'Customer Segments',
      description: 'Group customers by behavior and demographics for targeted campaigns',
      href: '/retail/segments',
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingBagIcon className="w-7 h-7 text-emerald-600" />
          Retail & Loyalty
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Loyalty programs, promotions, customer segments, and retail analytics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={StarIcon}
          label="Active Programs"
          value={stats.activePrograms}
          subtext={`${stats.totalPrograms} total`}
          color="bg-emerald-600"
        />
        <StatCard
          icon={IdentificationIcon}
          label="Total Members"
          value={stats.totalMembers.toLocaleString()}
          color="bg-blue-600"
        />
        <StatCard
          icon={TagIcon}
          label="Active Promotions"
          value={stats.activePromotions}
          subtext={`${stats.totalPromotions} total`}
          color="bg-purple-600"
        />
        <StatCard
          icon={UsersIcon}
          label="Customer Segments"
          value={stats.totalSegments}
          color="bg-amber-500"
        />
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {navItems.map((item) => (
            <NavCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              href={item.href}
              color={item.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
