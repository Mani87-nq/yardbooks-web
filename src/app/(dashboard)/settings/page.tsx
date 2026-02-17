'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { usePosStore } from '@/store/posStore';
import {
  BuildingOfficeIcon,
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  PrinterIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  ArrowPathIcon,
  TrashIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  DocumentTextIcon,
  SwatchIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const CURRENCIES = [
  { code: 'JMD', name: 'Jamaican Dollar', symbol: '$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
  'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
  'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [showResetModal, setShowResetModal] = useState(false);

  const { activeCompany, setActiveCompany, user, updateUser } = useAppStore();
  const { settings: posSettings, updateSettings: updatePosSettings } = usePosStore();

  const getAddressString = (addr?: string | { street?: string; city?: string; parish?: string; country?: string }) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [addr.street, addr.city, addr.parish, addr.country].filter(Boolean).join(', ');
  };

  const [companyForm, setCompanyForm] = useState({
    businessName: activeCompany?.businessName || '',
    tradingName: activeCompany?.tradingName || '',
    trnNumber: activeCompany?.trnNumber || '',
    gctNumber: activeCompany?.gctNumber || '',
    email: activeCompany?.email || '',
    phone: activeCompany?.phone || '',
    address: getAddressString(activeCompany?.address),
    parish: activeCompany?.parish || '',
    website: activeCompany?.website || '',
    industry: activeCompany?.industry || '',
  });

  const [userForm, setUserForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    lowStockAlerts: true,
    paymentReminders: true,
    dailySummary: false,
    weeklyReport: true,
  });

  const [displaySettings, setDisplaySettings] = useState({
    currency: 'JMD',
    dateFormat: 'DD/MM/YYYY',
    language: 'en',
    darkMode: false,
    compactMode: false,
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    prefix: activeCompany?.invoiceSettings?.prefix || 'INV-',
    nextNumber: activeCompany?.invoiceSettings?.nextNumber || 1001,
    template: activeCompany?.invoiceSettings?.template || 'modern',
    primaryColor: activeCompany?.invoiceSettings?.primaryColor || '#059669',
    accentColor: activeCompany?.invoiceSettings?.accentColor || '#10b981',
    showLogo: activeCompany?.invoiceSettings?.showLogo ?? true,
    footer: activeCompany?.invoiceSettings?.footer || '',
    termsAndConditions: activeCompany?.invoiceSettings?.termsAndConditions || 'Payment is due within 30 days of invoice date.',
    notes: activeCompany?.invoiceSettings?.notes || '',
  });

  const handleSaveCompany = () => {
    if (activeCompany) {
      setActiveCompany({
        ...activeCompany,
        ...companyForm,
        updatedAt: new Date(),
      });
      alert('Company settings saved!');
    }
  };

  const handleSaveInvoiceSettings = () => {
    if (activeCompany) {
      setActiveCompany({
        ...activeCompany,
        invoiceSettings: {
          prefix: invoiceSettings.prefix,
          nextNumber: invoiceSettings.nextNumber,
          template: invoiceSettings.template as 'classic' | 'modern' | 'minimal' | 'professional',
          primaryColor: invoiceSettings.primaryColor,
          accentColor: invoiceSettings.accentColor,
          showLogo: invoiceSettings.showLogo,
          footer: invoiceSettings.footer,
          termsAndConditions: invoiceSettings.termsAndConditions,
          notes: invoiceSettings.notes,
        },
        updatedAt: new Date(),
      });
      alert('Invoice settings saved!');
    }
  };

  const handleSaveUser = () => {
    if (user) {
      updateUser({
        ...userForm,
      });
      alert('Profile settings saved!');
    }
  };

  const handleExportData = () => {
    const data = {
      company: activeCompany,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardbooks-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const tabs = [
    { id: 'company', name: 'Company', icon: BuildingOfficeIcon },
    { id: 'invoices', name: 'Invoices', icon: DocumentTextIcon },
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'display', name: 'Display', icon: PaintBrushIcon },
    { id: 'billing', name: 'Billing', icon: CreditCardIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'data', name: 'Data', icon: CloudArrowUpIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <Card padding="none">
            <nav className="divide-y divide-gray-100">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-emerald-50 text-emerald-600 border-l-4 border-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Business Name *"
                      value={companyForm.businessName}
                      onChange={(e) => setCompanyForm({ ...companyForm, businessName: e.target.value })}
                    />
                    <Input
                      label="Trading Name"
                      value={companyForm.tradingName}
                      onChange={(e) => setCompanyForm({ ...companyForm, tradingName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="TRN (Tax Registration Number)"
                      value={companyForm.trnNumber}
                      onChange={(e) => setCompanyForm({ ...companyForm, trnNumber: e.target.value })}
                      placeholder="XXX-XXX-XXX"
                    />
                    <Input
                      label="GCT Number"
                      value={companyForm.gctNumber}
                      onChange={(e) => setCompanyForm({ ...companyForm, gctNumber: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Email"
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    />
                    <Input
                      label="Phone"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    />
                  </div>
                  <Input
                    label="Address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parish</label>
                      <select
                        value={companyForm.parish}
                        onChange={(e) => setCompanyForm({ ...companyForm, parish: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select parish</option>
                        {PARISHES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Website"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    />
                  </div>
                  <Input
                    label="Industry"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    placeholder="e.g., Retail, Agriculture, Services"
                  />
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveCompany}>Save Changes</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-6">
              {/* Template Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { id: 'classic', name: 'Classic', desc: 'Traditional professional layout' },
                      { id: 'modern', name: 'Modern', desc: 'Clean contemporary design' },
                      { id: 'minimal', name: 'Minimal', desc: 'Simple and elegant' },
                      { id: 'professional', name: 'Professional', desc: 'Formal business style' },
                    ].map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setInvoiceSettings({ ...invoiceSettings, template: template.id as 'classic' | 'modern' | 'minimal' | 'professional' })}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          invoiceSettings.template === template.id
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="h-20 bg-gray-100 rounded mb-3 flex items-center justify-center">
                          <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="font-medium text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500">{template.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Colors & Branding */}
              <Card>
                <CardHeader>
                  <CardTitle>Colors & Branding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={invoiceSettings.primaryColor}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                            className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                          />
                          <Input
                            value={invoiceSettings.primaryColor}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={invoiceSettings.accentColor}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accentColor: e.target.value })}
                            className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                          />
                          <Input
                            value={invoiceSettings.accentColor}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accentColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center justify-between py-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <PhotoIcon className="w-5 h-5 text-gray-500" />
                        <div>
                          <span className="text-gray-700 font-medium">Show Company Logo</span>
                          <p className="text-sm text-gray-500">Display your logo on invoices</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={invoiceSettings.showLogo}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showLogo: e.target.checked })}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    {/* Color Preview */}
                    <div className="mt-4 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 mb-2">Preview</p>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-32 h-8 rounded"
                          style={{ backgroundColor: invoiceSettings.primaryColor }}
                        />
                        <div
                          className="w-32 h-8 rounded"
                          style={{ backgroundColor: invoiceSettings.accentColor }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Numbering */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Numbering</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Invoice Prefix"
                      value={invoiceSettings.prefix}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })}
                      placeholder="INV-"
                    />
                    <Input
                      label="Next Invoice Number"
                      type="number"
                      value={invoiceSettings.nextNumber}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, nextNumber: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Next invoice will be: <span className="font-medium">{invoiceSettings.prefix}{invoiceSettings.nextNumber}</span>
                  </p>
                </CardContent>
              </Card>

              {/* Default Text */}
              <Card>
                <CardHeader>
                  <CardTitle>Default Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                      <textarea
                        value={invoiceSettings.termsAndConditions}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, termsAndConditions: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
                        placeholder="Enter your default terms and conditions..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Footer</label>
                      <textarea
                        value={invoiceSettings.footer}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                        placeholder="Thank you for your business!"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Notes</label>
                      <textarea
                        value={invoiceSettings.notes}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, notes: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                        placeholder="Additional notes to appear on invoices..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveInvoiceSettings}>Save Invoice Settings</Button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                      <UserCircleIcon className="w-12 h-12 text-emerald-600" />
                    </div>
                    <div>
                      <Button variant="outline" size="sm">Change Photo</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    />
                    <Input
                      label="Last Name"
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Email"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                    <Input
                      label="Phone"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveUser}>Save Profile</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries({
                    emailNotifications: 'Email Notifications',
                    lowStockAlerts: 'Low Stock Alerts',
                    paymentReminders: 'Payment Reminders',
                    dailySummary: 'Daily Summary Email',
                    weeklyReport: 'Weekly Business Report',
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <span className="text-gray-700">{label}</span>
                      <input
                        type="checkbox"
                        checked={notificationSettings[key as keyof typeof notificationSettings]}
                        onChange={(e) => setNotificationSettings({
                          ...notificationSettings,
                          [key]: e.target.checked,
                        })}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  ))}
                  <div className="flex justify-end pt-4">
                    <Button>Save Preferences</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'display' && (
            <Card>
              <CardHeader>
                <CardTitle>Display Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={displaySettings.currency}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, currency: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                      <select
                        value={displaySettings.dateFormat}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, dateFormat: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <label className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div>
                        <span className="text-gray-700 font-medium">Dark Mode</span>
                        <p className="text-sm text-gray-500">Use dark theme for the interface</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={displaySettings.darkMode}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, darkMode: e.target.checked })}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                    <label className="flex items-center justify-between py-3">
                      <div>
                        <span className="text-gray-700 font-medium">Compact Mode</span>
                        <p className="text-sm text-gray-500">Reduce spacing for more data density</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={displaySettings.compactMode}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, compactMode: e.target.checked })}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button>Save Settings</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <Card>
              <CardHeader>
                <CardTitle>Billing & Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-emerald-800">Free Plan</p>
                        <p className="text-sm text-emerald-600">Basic features included</p>
                      </div>
                      <Button variant="outline">Upgrade</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Available Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { name: 'Starter', price: 'Free', features: ['Up to 100 invoices/month', 'Basic POS', '1 User'] },
                        { name: 'Professional', price: '$29/mo', features: ['Unlimited invoices', 'Full POS', '5 Users', 'Advanced reports'] },
                        { name: 'Enterprise', price: '$99/mo', features: ['Everything in Pro', 'Unlimited users', 'API access', 'Priority support'] },
                      ].map((plan) => (
                        <div key={plan.name} className="border rounded-lg p-4">
                          <h4 className="font-medium text-gray-900">{plan.name}</h4>
                          <p className="text-2xl font-bold text-gray-900 my-2">{plan.price}</p>
                          <ul className="space-y-1 text-sm text-gray-600">
                            {plan.features.map((f, i) => (
                              <li key={i}>- {f}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">Change Password</p>
                      <p className="text-sm text-gray-500">Update your account password</p>
                    </div>
                    <Button variant="outline">Change</Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500">Add an extra layer of security</p>
                    </div>
                    <Button variant="outline">Enable</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">Active Sessions</p>
                      <p className="text-sm text-gray-500">Manage your active login sessions</p>
                    </div>
                    <Button variant="outline">View Sessions</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">Export Data</p>
                        <p className="text-sm text-gray-500">Download a backup of all your data</p>
                      </div>
                      <Button variant="outline" onClick={handleExportData}>
                        <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">Import Data</p>
                        <p className="text-sm text-gray-500">Restore from a backup file</p>
                      </div>
                      <Button variant="outline">
                        <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                        Import
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900">Sync Status</p>
                        <p className="text-sm text-gray-500">Last synced: Just now</p>
                      </div>
                      <Button variant="outline">
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Sync Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Reset All Data</p>
                      <p className="text-sm text-gray-500">This action cannot be undone</p>
                    </div>
                    <Button variant="danger" onClick={() => setShowResetModal(true)}>
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Reset Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Reset Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset All Data"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-lg">
              <p className="font-medium">Warning: This action cannot be undone!</p>
              <p className="text-sm mt-1">
                All your data including invoices, customers, products, and settings will be permanently deleted.
              </p>
            </div>
            <p className="text-gray-600">
              Are you sure you want to reset all data? Consider exporting a backup first.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowResetModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleResetData}>
            Yes, Reset Everything
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
