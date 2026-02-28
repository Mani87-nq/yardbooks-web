import type { ModuleManifest } from '../types';

export const manifest: ModuleManifest = {
  id: 'salon',
  name: 'Salon & Spa',
  version: '1.0.0',
  description:
    'Appointment booking, stylist management, service catalog, and walk-in queue for salons and spas.',
  icon: 'ScissorsIcon',
  color: 'pink',
  category: 'industry',

  dependencies: [],
  coreDependencies: ['customers', 'invoices'],

  requiredPlan: 'PROFESSIONAL',
  trialDays: 14,
  pricing: { monthly: 0, currency: 'JMD' },

  navigation: [
    {
      label: 'Appointments',
      href: 'appointments',
      icon: 'CalendarDaysIcon',
      permission: 'salon:appointments:read',
    },
    {
      label: 'Services',
      href: 'services',
      icon: 'SparklesIcon',
      permission: 'salon:services:read',
    },
    {
      label: 'Stylists',
      href: 'stylists',
      icon: 'UserGroupIcon',
      permission: 'salon:stylists:read',
    },
    {
      label: 'Walk-ins',
      href: 'walk-ins',
      icon: 'ArrowRightStartOnRectangleIcon',
      permission: 'salon:walkins:read',
    },
  ],

  dashboardWidgets: [
    {
      id: 'salon-today-appointments',
      component: 'modules/salon/components/TodayAppointments',
      title: "Today's Appointments",
      defaultEnabled: true,
      minRole: 'STAFF',
    },
    {
      id: 'salon-stylist-utilization',
      component: 'modules/salon/components/StylistUtilization',
      title: 'Stylist Utilization',
      defaultEnabled: true,
      minRole: 'ADMIN',
    },
    {
      id: 'salon-walkin-queue',
      component: 'modules/salon/components/WalkInQueue',
      title: 'Walk-in Queue',
      defaultEnabled: false,
      minRole: 'STAFF',
    },
  ],

  settingsPanels: [
    {
      id: 'salon-settings',
      title: 'Salon & Spa Settings',
      component: 'modules/salon/settings/SettingsPanel',
      minRole: 'ADMIN',
      icon: 'CogIcon',
    },
  ],

  // ---- Kiosk (Employee Portal) Extension Points ----
  kioskNavigation: [
    {
      label: 'Salon',
      href: 'salon',
      icon: 'SparklesIcon',
      priority: 15,
    },
  ],
  kioskHomeWidgets: [
    {
      id: 'kiosk-salon-today-appointments',
      component: 'components/kiosk/salon/TodayAppointmentsWidget',
      title: "Today's Appointments",
      priority: 10,
      gridSpan: 2,
    },
    {
      id: 'kiosk-salon-walkin-queue',
      component: 'components/kiosk/salon/WalkInQueueWidget',
      title: 'Walk-in Queue',
      priority: 20,
      gridSpan: 1,
    },
    {
      id: 'kiosk-salon-my-clients',
      component: 'components/kiosk/salon/MyClientsWidget',
      title: 'My Clients Today',
      priority: 25,
      gridSpan: 1,
    },
  ],

  eventsPublished: [
    {
      name: 'salon.appointment.created',
      description: 'A new appointment was booked.',
    },
    {
      name: 'salon.appointment.confirmed',
      description: 'An appointment was confirmed by the stylist.',
    },
    {
      name: 'salon.appointment.completed',
      description: 'An appointment was completed and is ready for invoicing.',
    },
    {
      name: 'salon.appointment.cancelled',
      description: 'An appointment was cancelled.',
    },
    {
      name: 'salon.appointment.no_show',
      description: 'A customer did not show up for their appointment.',
    },
    {
      name: 'salon.walkin.queued',
      description: 'A walk-in customer was added to the queue.',
    },
    {
      name: 'salon.walkin.served',
      description: 'A walk-in customer was seated with a stylist.',
    },
  ],

  eventsSubscribed: [
    'payment.received',
    'invoice.created',
    'customer.created',
    'customer.updated',
  ],

  permissions: [
    // Appointments
    { key: 'salon:appointments:read', label: 'View salon appointments', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:appointments:create', label: 'Create salon appointments', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:appointments:update', label: 'Edit salon appointments', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:appointments:delete', label: 'Cancel salon appointments', defaultRoles: ['ACCOUNTANT', 'ADMIN', 'OWNER'] },

    // Services
    { key: 'salon:services:read', label: 'View service catalog', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:services:create', label: 'Add services', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'salon:services:update', label: 'Edit services', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'salon:services:delete', label: 'Remove services', defaultRoles: ['ADMIN', 'OWNER'] },

    // Stylists
    { key: 'salon:stylists:read', label: 'View stylists', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:stylists:create', label: 'Add stylists', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'salon:stylists:update', label: 'Edit stylist profiles', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'salon:stylists:delete', label: 'Remove stylists', defaultRoles: ['OWNER'] },

    // Walk-ins
    { key: 'salon:walkins:read', label: 'View walk-in queue', defaultRoles: ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:walkins:create', label: 'Add walk-ins to queue', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },
    { key: 'salon:walkins:update', label: 'Update walk-in status', defaultRoles: ['STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] },

    // Settings
    { key: 'salon:settings:read', label: 'View salon settings', defaultRoles: ['ADMIN', 'OWNER'] },
    { key: 'salon:settings:update', label: 'Modify salon settings', defaultRoles: ['ADMIN', 'OWNER'] },
  ],

  hasSchema: true,
};
