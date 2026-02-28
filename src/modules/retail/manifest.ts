import type { ModuleManifest } from '../types';

export const manifest: ModuleManifest = {
  id: 'retail',
  name: 'Retail & Loyalty',
  version: '1.0.0',
  description:
    'Loyalty programs, promotions, customer segmentation, and advanced retail analytics for shops and stores.',
  icon: 'ShoppingBagIcon',
  color: 'blue',
  category: 'industry',

  dependencies: [],
  coreDependencies: ['customers', 'products', 'pos'],

  requiredPlan: 'PROFESSIONAL',
  trialDays: 14,
  pricing: { monthly: 0, currency: 'JMD' },

  navigation: [
    {
      label: 'Loyalty Programs',
      href: 'loyalty',
      icon: 'StarIcon',
      permission: 'retail:loyalty:read',
    },
    {
      label: 'Promotions',
      href: 'promotions',
      icon: 'TagIcon',
      permission: 'retail:promotions:read',
    },
    {
      label: 'Member Cards',
      href: 'members',
      icon: 'IdentificationIcon',
      permission: 'retail:members:read',
    },
    {
      label: 'Customer Segments',
      href: 'segments',
      icon: 'UsersIcon',
      permission: 'retail:segments:read',
    },
  ],

  dashboardWidgets: [
    {
      id: 'retail-active-promotions',
      component: 'modules/retail/components/ActivePromotions',
      title: 'Active Promotions',
      defaultEnabled: true,
      minRole: 'STAFF',
    },
    {
      id: 'retail-loyalty-overview',
      component: 'modules/retail/components/LoyaltyOverview',
      title: 'Loyalty Program Overview',
      defaultEnabled: true,
      minRole: 'ADMIN',
    },
    {
      id: 'retail-top-members',
      component: 'modules/retail/components/TopMembers',
      title: 'Top Loyalty Members',
      defaultEnabled: false,
      minRole: 'STAFF',
    },
  ],

  settingsPanels: [
    {
      id: 'retail-settings',
      title: 'Retail & Loyalty Settings',
      component: 'modules/retail/settings/SettingsPanel',
      minRole: 'ADMIN',
      icon: 'CogIcon',
    },
  ],

  // ---- Kiosk (Employee Portal) Extension Points ----
  kioskNavigation: [
    {
      label: 'Register',
      href: 'pos',
      icon: 'CalculatorIcon',
      priority: 10,
    },
  ],
  kioskHomeWidgets: [
    {
      id: 'kiosk-pos-new-sale',
      component: 'components/kiosk/pos/NewSaleWidget',
      title: 'Quick Sale',
      priority: 5,
      gridSpan: 2,
    },
    {
      id: 'kiosk-pos-recent-orders',
      component: 'components/kiosk/pos/RecentOrdersWidget',
      title: 'Recent Orders',
      priority: 15,
      gridSpan: 2,
    },
  ],

  eventsPublished: [
    {
      name: 'retail.loyalty.points_earned',
      description: 'A customer earned loyalty points from a purchase.',
    },
    {
      name: 'retail.loyalty.reward_redeemed',
      description: 'A customer redeemed a loyalty reward.',
    },
    {
      name: 'retail.promotion.activated',
      description: 'A promotion became active.',
    },
    {
      name: 'retail.promotion.expired',
      description: 'A promotion has expired.',
    },
    {
      name: 'retail.member.created',
      description: 'A new loyalty member card was created.',
    },
  ],

  eventsSubscribed: [
    'pos.order.completed',
    'customer.created',
    'customer.updated',
    'payment.received',
  ],

  permissions: [
    // Loyalty
    { key: 'retail:loyalty:read', label: 'View loyalty programs', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:loyalty:create', label: 'Create loyalty programs', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'retail:loyalty:update', label: 'Edit loyalty programs', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'retail:loyalty:delete', label: 'Delete loyalty programs', defaultRoles: ['OWNER'] },

    // Promotions
    { key: 'retail:promotions:read', label: 'View promotions', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:promotions:create', label: 'Create promotions', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:promotions:update', label: 'Edit promotions', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:promotions:delete', label: 'Delete promotions', defaultRoles: ['ADMIN', 'OWNER'] },

    // Members
    { key: 'retail:members:read', label: 'View member cards', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:members:create', label: 'Create member cards', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:members:update', label: 'Edit member cards', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:members:delete', label: 'Delete member cards', defaultRoles: ['ADMIN', 'OWNER'] },

    // Segments
    { key: 'retail:segments:read', label: 'View customer segments', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'retail:segments:create', label: 'Create customer segments', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'retail:segments:update', label: 'Edit customer segments', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'retail:segments:delete', label: 'Delete customer segments', defaultRoles: ['OWNER'] },

    // Settings
    { key: 'retail:settings:read', label: 'View retail settings', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'retail:settings:update', label: 'Modify retail settings', defaultRoles: ['ADMIN', 'OWNER'] },
  ],

  hasSchema: true,
};
