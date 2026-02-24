'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Input, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, ModalBody, ModalFooter,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { usePosStore } from '@/store/posStore';
import type { TaxSettings, TaxRate } from '@/types';
import {
  BuildingOfficeIcon,
  UserCircleIcon,
  UsersIcon,
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
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';

// ============================================
// CONSTANTS
// ============================================

const CURRENCIES = [
  { code: 'JMD', name: 'Jamaican Dollar', symbol: '$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00a3' },
];

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
  'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
  'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
];

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin', description: 'Full access except ownership transfer' },
  { value: 'ACCOUNTANT', label: 'Accountant', description: 'Financial operations & approvals' },
  { value: 'STAFF', label: 'Staff', description: 'Create & edit records' },
  { value: 'READ_ONLY', label: 'Read Only', description: 'View access only' },
] as const;

const ROLE_HIERARCHY = ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'] as const;

type TeamRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY';

// ============================================
// TEAM MEMBER TYPE
// ============================================

interface TeamMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
}

interface TeamMeta {
  totalMembers: number;
  maxMembers: number;
  planId: string;
}

// ============================================
// HELPERS
// ============================================

function getRoleBadgeVariant(role: TeamRole): 'success' | 'info' | 'warning' | 'default' | 'danger' {
  switch (role) {
    case 'OWNER': return 'warning';      // Gold/amber
    case 'ADMIN': return 'info';          // Purple/blue
    case 'ACCOUNTANT': return 'info';     // Blue
    case 'STAFF': return 'success';       // Green
    case 'READ_ONLY': return 'default';   // Gray
    default: return 'default';
  }
}

function getRoleLevel(role: TeamRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

function canManageTeam(role: string | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-JM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================
// TEAM TAB COMPONENT
// ============================================

function TeamTab() {
  const { user, userRole } = useAppStore();
  const currentUserRole = (userRole || (user as { role?: string } | null)?.role) as TeamRole | undefined;
  const isManager = canManageTeam(currentUserRole);

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [meta, setMeta] = useState<TeamMeta>({ totalMembers: 0, maxMembers: 1, planId: 'starter' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('STAFF');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Remove confirmation modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Fetch team members
  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('yaadbooks_access_token');
      const res = await fetch('/api/v1/team', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load team members');
      }
      const json = await res.json();
      setMembers(json.data);
      setMeta(json.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Invite handler
  const handleInvite = async () => {
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const token = localStorage.getItem('yaadbooks_access_token');
      const res = await fetch('/api/v1/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to invite member');
      }
      setInviteSuccess(json.message || 'Member added successfully!');
      setInviteEmail('');
      setInviteRole('STAFF');
      fetchTeam();
      // Close modal after short delay
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviteLoading(false);
    }
  };

  // Role change handler
  const handleRoleChange = async (member: TeamMember, newRole: TeamRole) => {
    setActionLoading(member.id);
    try {
      const token = localStorage.getItem('yaadbooks_access_token');
      const res = await fetch(`/api/v1/team/${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to update role');
      }
      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  // Remove handler
  const handleRemove = async () => {
    if (!memberToRemove) return;
    setActionLoading(memberToRemove.id);
    try {
      const token = localStorage.getItem('yaadbooks_access_token');
      const res = await fetch(`/api/v1/team/${memberToRemove.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to remove member');
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMeta((prev) => ({ ...prev, totalMembers: prev.totalMembers - 1 }));
      setShowRemoveModal(false);
      setMemberToRemove(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  // Determine which roles the current user can assign
  const assignableRoles = ROLE_OPTIONS.filter((opt) => {
    if (!currentUserRole) return false;
    return getRoleLevel(opt.value as TeamRole) < getRoleLevel(currentUserRole);
  });

  const atUserLimit = meta.maxMembers !== -1 && meta.totalMembers >= meta.maxMembers;

  const planDisplayName: Record<string, string> = {
    solo: 'Solo',
    team: 'Team',
    starter: 'Starter',
    business: 'Business',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <div className="space-y-6">
      {/* Plan usage banner */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Team Members</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">{meta.totalMembers}</span>
                <span className="text-gray-500">
                  of {meta.maxMembers === -1 ? 'Unlimited' : meta.maxMembers} users
                </span>
                <Badge variant="outline" size="sm">
                  {planDisplayName[meta.planId] || meta.planId} Plan
                </Badge>
              </div>
              {/* Progress bar */}
              {meta.maxMembers !== -1 && (
                <div className="mt-2 w-64">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        atUserLimit ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min((meta.totalMembers / meta.maxMembers) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {atUserLimit && (
                <Button variant="outline" size="sm">
                  Upgrade Plan
                </Button>
              )}
              {isManager && (
                <Button
                  size="sm"
                  onClick={() => {
                    setInviteError(null);
                    setInviteSuccess(null);
                    setInviteEmail('');
                    setInviteRole('STAFF');
                    setShowInviteModal(true);
                  }}
                  disabled={atUserLimit}
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Invite Member
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-limit warning */}
      {atUserLimit && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">You have reached your plan limit of {meta.maxMembers} team member(s).</p>
            <p className="text-sm">Upgrade your plan to add more members to your team.</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchTeam}>
            Retry
          </Button>
        </div>
      )}

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-gray-500">Loading team members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No team members found.</p>
              {isManager && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowInviteModal(true)}
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Invite your first team member
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                    {isManager && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isCurrentUser = member.userId === (user as { id?: string } | null)?.id;
                    const isOwner = member.role === 'OWNER';
                    const canModify =
                      isManager &&
                      !isCurrentUser &&
                      !isOwner &&
                      getRoleLevel(member.role) < getRoleLevel(currentUserRole!);

                    return (
                      <TableRow key={member.id}>
                        {/* Member info */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700 flex-shrink-0">
                              {getInitials(member.firstName, member.lastName)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                                {isCurrentUser && (
                                  <span className="text-xs text-gray-400 ml-1">(you)</span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          {canModify ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member, e.target.value as TeamRole)}
                              disabled={actionLoading === member.id}
                              className="text-sm rounded-md border border-gray-300 bg-white px-2 py-1 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              {/* Always show the current role */}
                              <option value={member.role}>{member.role}</option>
                              {assignableRoles
                                .filter((r) => r.value !== member.role)
                                .map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                              {member.role}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Joined */}
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {formatDate(member.joinedAt)}
                          </span>
                        </TableCell>

                        {/* Last active */}
                        <TableCell>
                          <span className="text-sm text-gray-500">
                            {formatRelativeDate(member.lastLoginAt)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        {isManager && (
                          <TableCell className="text-right">
                            {canModify ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setMemberToRemove(member);
                                  setShowRemoveModal(true);
                                }}
                                disabled={actionLoading === member.id}
                              >
                                Remove
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {isCurrentUser ? 'You' : isOwner ? 'Owner' : ''}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Team Member"
      >
        <ModalBody>
          <div className="space-y-4">
            {inviteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm">
                {inviteSuccess}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteLoading}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                disabled={inviteLoading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              >
                {assignableRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {/* Role description */}
              {assignableRoles.find((r) => r.value === inviteRole) && (
                <p className="text-xs text-gray-500 mt-1">
                  {assignableRoles.find((r) => r.value === inviteRole)?.description}
                </p>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              <p>The user must have an existing YaadBooks account. They will immediately be added to your team and see this company in their account.</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowInviteModal(false)} disabled={inviteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
          >
            {inviteLoading ? 'Inviting...' : 'Add to Team'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setMemberToRemove(null);
        }}
        title="Remove Team Member"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-lg">
              <p className="font-medium">Are you sure?</p>
              <p className="text-sm mt-1">
                This will remove{' '}
                <span className="font-medium">
                  {memberToRemove?.firstName} {memberToRemove?.lastName}
                </span>{' '}
                ({memberToRemove?.email}) from your team. They will lose access to this company&apos;s data immediately.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowRemoveModal(false);
              setMemberToRemove(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRemove}
            disabled={actionLoading === memberToRemove?.id}
          >
            {actionLoading === memberToRemove?.id ? 'Removing...' : 'Remove Member'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ============================================
// MAIN SETTINGS PAGE
// ============================================

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

  // Default tax rates for Jamaica GCT (15% standard rate)
  const defaultTaxRates: TaxRate[] = [
    { id: 'standard', name: 'Standard', rate: 0.15, description: 'Standard GCT rate for most goods and services (15%)', isDefault: true },
    { id: 'zero', name: 'Zero-rated', rate: 0, description: 'Zero-rated items (exports, basic food items)', isDefault: false },
  ];

  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    enabled: activeCompany?.taxSettings?.enabled ?? true,
    taxName: activeCompany?.taxSettings?.taxName || 'GCT',
    defaultRate: activeCompany?.taxSettings?.defaultRate ?? 0.15,
    rates: activeCompany?.taxSettings?.rates || defaultTaxRates,
    showTaxOnReceipts: activeCompany?.taxSettings?.showTaxOnReceipts ?? true,
    showTaxBreakdown: activeCompany?.taxSettings?.showTaxBreakdown ?? true,
    taxIncludedInPrice: activeCompany?.taxSettings?.taxIncludedInPrice ?? false,
  });

  const [printerSettings, setPrinterSettings] = useState({
    receiptPaperWidth: (activeCompany?.printerSettings?.receiptPaperWidth as '58' | '80') || '80',
    receiptPrinterName: activeCompany?.printerSettings?.receiptPrinterName || '',
    autoPrintReceipts: activeCompany?.printerSettings?.autoPrintReceipts ?? true,
    documentPaperSize: (activeCompany?.printerSettings?.documentPaperSize as 'letter' | 'a4') || 'letter',
    documentPrinterName: activeCompany?.printerSettings?.documentPrinterName || '',
    defaultCopies: activeCompany?.printerSettings?.defaultCopies || 1,
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

  const handleSaveTaxSettings = () => {
    if (activeCompany) {
      setActiveCompany({
        ...activeCompany,
        taxSettings: taxSettings,
        updatedAt: new Date(),
      });
      alert('Tax settings saved!');
    }
  };

  const handleSavePrinterSettings = () => {
    if (activeCompany) {
      setActiveCompany({
        ...activeCompany,
        printerSettings: {
          receiptPaperWidth: printerSettings.receiptPaperWidth,
          receiptPrinterName: printerSettings.receiptPrinterName,
          autoPrintReceipts: printerSettings.autoPrintReceipts,
          documentPaperSize: printerSettings.documentPaperSize,
          documentPrinterName: printerSettings.documentPrinterName,
          defaultCopies: printerSettings.defaultCopies,
        },
        updatedAt: new Date(),
      });
      alert('Printer settings saved!');
    }
  };

  const handleTestPrint = () => {
    const testContent = `
      <html>
        <head>
          <title>Test Print</title>
          <style>
            @page {
              size: ${printerSettings.receiptPaperWidth === '58' ? '58mm' : '80mm'} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              width: ${printerSettings.receiptPaperWidth === '58' ? '48mm' : '72mm'};
              padding: 5mm;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            h2 { margin: 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2>TEST PRINT</h2>
            <p>${activeCompany?.businessName || 'YaadBooks POS'}</p>
          </div>
          <div class="divider"></div>
          <p>Paper Width: ${printerSettings.receiptPaperWidth}mm</p>
          <p>Printer: ${printerSettings.receiptPrinterName || 'Default'}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <div class="divider"></div>
          <p class="center">If you can read this, your printer is working correctly!</p>
          <div class="divider"></div>
          <p class="center">*** END TEST ***</p>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(testContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
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
    a.download = `yaadbooks-backup-${new Date().toISOString().split('T')[0]}.json`;
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
    { id: 'tax', name: 'Tax / GCT', icon: CalculatorIcon },
    { id: 'printers', name: 'Printers', icon: PrinterIcon },
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'team', name: 'Team', icon: UsersIcon },
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

          {activeTab === 'tax' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tax / GCT Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tax Enable/Disable */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Enable Tax Collection</p>
                      <p className="text-sm text-gray-500">Apply tax to products and services</p>
                    </div>
                    <button
                      onClick={() => setTaxSettings({ ...taxSettings, enabled: !taxSettings.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        taxSettings.enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          taxSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {taxSettings.enabled && (
                    <>
                      {/* Tax Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tax Name
                        </label>
                        <Input
                          value={taxSettings.taxName}
                          onChange={(e) => setTaxSettings({ ...taxSettings, taxName: e.target.value })}
                          placeholder="GCT"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This name appears on invoices and receipts (e.g., GCT, VAT, Sales Tax)
                        </p>
                      </div>

                      {/* Default Tax Rate */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Default Tax Rate (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={(taxSettings.defaultRate * 100).toFixed(2)}
                          onChange={(e) => setTaxSettings({
                            ...taxSettings,
                            defaultRate: parseFloat(e.target.value) / 100
                          })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Default rate for new products (Jamaica standard: 15%)
                        </p>
                      </div>

                      {/* Tax Display Options */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="showTaxOnReceipts"
                            checked={taxSettings.showTaxOnReceipts}
                            onChange={(e) => setTaxSettings({ ...taxSettings, showTaxOnReceipts: e.target.checked })}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="showTaxOnReceipts" className="text-sm text-gray-700 dark:text-gray-300">
                            Show tax on receipts and invoices
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="showTaxBreakdown"
                            checked={taxSettings.showTaxBreakdown}
                            onChange={(e) => setTaxSettings({ ...taxSettings, showTaxBreakdown: e.target.checked })}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="showTaxBreakdown" className="text-sm text-gray-700 dark:text-gray-300">
                            Show detailed tax breakdown
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="taxIncludedInPrice"
                            checked={taxSettings.taxIncludedInPrice}
                            onChange={(e) => setTaxSettings({ ...taxSettings, taxIncludedInPrice: e.target.checked })}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="taxIncludedInPrice" className="text-sm text-gray-700 dark:text-gray-300">
                            Tax included in price (prices shown are tax-inclusive)
                          </label>
                        </div>
                      </div>

                      {/* Jamaica GCT Info */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          <strong>Jamaica GCT Rates (2024-2026):</strong> Standard rate is 15% for most goods.
                          Zero-rated items include basic food items and exports. Ensure compliance with TAJ regulations.
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveTaxSettings}>Save Tax Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'printers' && (
            <Card>
              <CardHeader>
                <CardTitle>Printer Settings</CardTitle>
                <p className="text-sm text-gray-500 mt-2">
                  Configure your receipt and document printers. Your browser will show a print dialog when printing.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Browser Print Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Browser-Based Printing:</strong> Your browser handles printer selection through the print dialog. 
                    Most browsers remember the last printer you selected, so after choosing your receipt printer once, 
                    it should remain selected for future prints. The printer name fields below are for your reference to help staff identify which printer to choose.
                  </p>
                </div>

                {/* Receipt Printer */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Receipt Printer</h3>
                  <p className="text-sm text-gray-500">
                    Configure your receipt printer for POS transactions. Receipts are printed using your browser's print dialog.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paper Width</label>
                      <select
                        value={printerSettings?.receiptPaperWidth || '80'}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, receiptPaperWidth: e.target.value as '58' | '80' })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="80">80mm (Standard)</option>
                        <option value="58">58mm (Compact)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Most receipt printers use 80mm paper. Select 58mm for smaller portable printers.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Printer Name (Reference)</label>
                      <Input
                        value={printerSettings?.receiptPrinterName || ''}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, receiptPrinterName: e.target.value })}
                        placeholder="e.g., Epson TM-T20III"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter your printer name as a reminder. Select this printer in your browser's print dialog when printing receipts.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoPrintReceipts"
                      checked={printerSettings?.autoPrintReceipts ?? true}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, autoPrintReceipts: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="autoPrintReceipts" className="text-sm text-gray-700">
                      Auto-print receipts after completing sale
                    </label>
                  </div>
                </div>

                {/* Document Printer */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Document Printer</h3>
                  <p className="text-sm text-gray-500">
                    Configure your document printer for invoices, quotations, and reports.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
                      <select
                        value={printerSettings?.documentPaperSize || 'letter'}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, documentPaperSize: e.target.value as 'letter' | 'a4' })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="letter">Letter (8.5" × 11")</option>
                        <option value="a4">A4 (210mm × 297mm)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Printer Name (Reference)</label>
                      <Input
                        value={printerSettings?.documentPrinterName || ''}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, documentPrinterName: e.target.value })}
                        placeholder="e.g., HP LaserJet Pro"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Copies</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={printerSettings?.defaultCopies || 1}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, defaultCopies: parseInt(e.target.value) || 1 })}
                      className="w-32"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <Button variant="outline" onClick={handleTestPrint}>
                    Test Receipt Print
                  </Button>
                  <Button onClick={handleSavePrinterSettings}>
                    Save Printer Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
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

          {activeTab === 'team' && <TeamTab />}

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
                        <p className="font-medium text-emerald-800">Current Plan</p>
                        <p className="text-sm text-emerald-600">All features included</p>
                      </div>
                      <Button variant="outline">Manage Subscription</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Available Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { name: 'Solo', price: '$19.99/mo', features: ['1 user', '1 company', 'All features included', 'Email support'] },
                        { name: 'Team', price: '$14.99/user/mo', features: ['Unlimited users', 'Unlimited companies', 'All features included', 'Priority support'] },
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
