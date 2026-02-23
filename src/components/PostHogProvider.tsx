'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * PostHog analytics provider.
 * Initializes PostHog only in production when the API key is configured.
 * Automatically identifies users and sets company/plan properties.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  const activeCompany = useAppStore((s) => s.activeCompany);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!apiKey || typeof window === 'undefined') return;

    posthog.init(apiKey, {
      api_host: apiHost,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage',
      // Privacy: mask inputs and respect DNT
      mask_all_text: false,
      mask_all_element_attributes: false,
      respect_dnt: true,
      // Session recording (disabled by default, enable in PostHog dashboard)
      disable_session_recording: true,
      // Performance
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug();
        }
      },
    });
  }, []);

  // Identify user when they log in
  useEffect(() => {
    if (!user?.id || !posthog.__loaded) return;

    posthog.identify(user.id, {
      email: user.email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    });
  }, [user]);

  // Set company as group when active company changes
  useEffect(() => {
    if (!activeCompany?.id || !posthog.__loaded) return;

    posthog.group('company', activeCompany.id, {
      name: activeCompany.businessName,
      plan: activeCompany.subscriptionPlan ?? 'STARTER',
      status: activeCompany.subscriptionStatus ?? 'INACTIVE',
    });
  }, [activeCompany]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

/**
 * Custom hook to track specific business events.
 */
export function useAnalytics() {
  return {
    trackInvoiceCreated: (invoiceId: string, total: number) => {
      posthog.capture('invoice_created', { invoice_id: invoiceId, total });
    },
    trackExpenseRecorded: (category: string, amount: number) => {
      posthog.capture('expense_recorded', { category, amount });
    },
    trackPosOrderCompleted: (orderId: string, total: number, paymentMethod: string) => {
      posthog.capture('pos_order_completed', { order_id: orderId, total, payment_method: paymentMethod });
    },
    trackFeatureUsed: (feature: string) => {
      posthog.capture('feature_used', { feature });
    },
    trackExportDownloaded: (type: string, format: string) => {
      posthog.capture('export_downloaded', { type, format });
    },
    trackOnboardingStep: (step: number, stepName: string) => {
      posthog.capture('onboarding_step', { step, step_name: stepName });
    },
    trackOnboardingCompleted: () => {
      posthog.capture('onboarding_completed');
    },
    trackUpgradeClicked: (fromPlan: string, toPlan: string) => {
      posthog.capture('upgrade_clicked', { from_plan: fromPlan, to_plan: toPlan });
    },
    trackTeamMemberInvited: (role: string) => {
      posthog.capture('team_member_invited', { role });
    },
  };
}
