import type { ModuleManifest } from '../types';

export const manifest: ModuleManifest = {
  id: 'restaurant',
  name: 'Restaurant & Bar',
  version: '1.0.0',
  description:
    'Table management, reservations, kitchen display, order taking, tip tracking, and menu management for restaurants and bars.',
  icon: 'BuildingStorefrontIcon',
  color: 'orange',
  category: 'industry',

  dependencies: [],
  coreDependencies: ['customers', 'invoices', 'pos'],

  requiredPlan: 'PROFESSIONAL',
  trialDays: 14,
  pricing: { monthly: 0, currency: 'JMD' },

  navigation: [
    {
      label: 'Floor Plan',
      href: 'tables',
      icon: 'Squares2X2Icon',
      permission: 'restaurant:tables:read',
    },
    {
      label: 'Reservations',
      href: 'reservations',
      icon: 'CalendarDaysIcon',
      permission: 'restaurant:reservations:read',
    },
    {
      label: 'Menu',
      href: 'menu',
      icon: 'BookOpenIcon',
      permission: 'restaurant:menu:read',
    },
    {
      label: 'Kitchen Display',
      href: 'kitchen',
      icon: 'FireIcon',
      permission: 'restaurant:kitchen:read',
    },
    {
      label: 'Tips',
      href: 'tips',
      icon: 'BanknotesIcon',
      permission: 'restaurant:tips:read',
    },
  ],

  dashboardWidgets: [
    {
      id: 'restaurant-active-tables',
      component: 'modules/restaurant/components/ActiveTables',
      title: 'Active Tables',
      defaultEnabled: true,
      minRole: 'STAFF',
    },
    {
      id: 'restaurant-today-reservations',
      component: 'modules/restaurant/components/TodayReservations',
      title: "Today's Reservations",
      defaultEnabled: true,
      minRole: 'STAFF',
    },
    {
      id: 'restaurant-kitchen-queue',
      component: 'modules/restaurant/components/KitchenQueue',
      title: 'Kitchen Queue',
      defaultEnabled: true,
      minRole: 'STAFF',
    },
    {
      id: 'restaurant-daily-tips',
      component: 'modules/restaurant/components/DailyTips',
      title: "Today's Tips",
      defaultEnabled: false,
      minRole: 'ADMIN',
    },
  ],

  settingsPanels: [
    {
      id: 'restaurant-settings',
      title: 'Restaurant Settings',
      component: 'modules/restaurant/settings/SettingsPanel',
      minRole: 'ADMIN',
      icon: 'CogIcon',
    },
  ],

  eventsPublished: [
    {
      name: 'restaurant.reservation.created',
      description: 'A new reservation was booked.',
    },
    {
      name: 'restaurant.reservation.confirmed',
      description: 'A reservation was confirmed.',
    },
    {
      name: 'restaurant.reservation.cancelled',
      description: 'A reservation was cancelled.',
    },
    {
      name: 'restaurant.table.seated',
      description: 'Guests were seated at a table.',
    },
    {
      name: 'restaurant.table.cleared',
      description: 'A table was cleared after guests left.',
    },
    {
      name: 'restaurant.order.sent_to_kitchen',
      description: 'An order was sent to the kitchen display.',
    },
    {
      name: 'restaurant.order.ready',
      description: 'A kitchen order is ready for pickup.',
    },
    {
      name: 'restaurant.tip.recorded',
      description: 'A tip was recorded for a server.',
    },
  ],

  eventsSubscribed: [
    'pos.order.completed',
    'pos.order.voided',
    'payment.received',
    'customer.created',
  ],

  permissions: [
    // Tables / Floor Plan
    { key: 'restaurant:tables:read', label: 'View floor plan', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:tables:create', label: 'Add tables', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'restaurant:tables:update', label: 'Edit tables & seat guests', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:tables:delete', label: 'Remove tables', defaultRoles: ['ADMIN', 'OWNER'] },

    // Reservations
    { key: 'restaurant:reservations:read', label: 'View reservations', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:reservations:create', label: 'Create reservations', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:reservations:update', label: 'Edit reservations', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:reservations:delete', label: 'Cancel reservations', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },

    // Menu
    { key: 'restaurant:menu:read', label: 'View menu', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:menu:create', label: 'Add menu items', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'restaurant:menu:update', label: 'Edit menu items', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'restaurant:menu:delete', label: 'Remove menu items', defaultRoles: ['ADMIN', 'OWNER'] },

    // Kitchen
    { key: 'restaurant:kitchen:read', label: 'View kitchen display', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:kitchen:update', label: 'Update order status in kitchen', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },

    // Tips
    { key: 'restaurant:tips:read', label: 'View tips', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:tips:create', label: 'Record tips', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:tips:update', label: 'Edit tips', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'restaurant:tips:delete', label: 'Delete tips', defaultRoles: ['ADMIN', 'OWNER'] },

    // Settings
    { key: 'restaurant:settings:read', label: 'View restaurant settings', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'restaurant:settings:update', label: 'Modify restaurant settings', defaultRoles: ['ADMIN', 'OWNER'] },
  ],

  hasSchema: true,
};
