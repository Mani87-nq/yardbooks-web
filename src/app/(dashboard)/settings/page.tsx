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
import api from '@/lib/api-client';
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
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  LockClosedIcon,
  KeyIcon,
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
      const json = await api.get<{ data: TeamMember[]; meta: TeamMeta }>('/api/v1/team');
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
      const json = await api.post<{ message?: string }>('/api/v1/team/invite', { email: inviteEmail, role: inviteRole });
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
      await api.put(`/api/v1/team/${member.id}`, { role: newRole });
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
      await api.delete(`/api/v1/team/${memberToRemove.id}`);
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
// BILLING TAB COMPONENT
// ============================================

interface BillingSubscription {
  isActive: boolean;
  plan: string | null;
  status: string;
  currentPeriodEnd: string | null;
  trialDaysRemaining: number;
}

interface BillingPlan {
  id: string;
  name: string;
  priceUsd: number;
  priceUsdAnnual: number;
  perUser: boolean;
  maxUsers: number;
  maxCompanies: number;
  features: string[];
}

interface BillingData {
  subscription: BillingSubscription;
  plan: BillingPlan | null;
  plans: BillingPlan[];
}

function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'TRIALING': return 'warning';
    case 'PAST_DUE': return 'danger';
    case 'CANCELLED':
    case 'INACTIVE':
    default: return 'default';
  }
}

function BillingTab() {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await api.get<BillingData>('/api/v1/billing');
      setBillingData(data);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to load billing info');
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleUpgrade = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const result = await api.post<{ checkoutUrl: string }>('/api/v1/billing', {
        planId,
        billingInterval: 'month',
        successUrl: `${window.location.origin}/settings?tab=billing&success=true`,
        cancelUrl: `${window.location.origin}/settings?tab=billing`,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (billingLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
            <span className="ml-2 text-gray-500">Loading billing information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (billingError) {
    return (
      <Card>
        <CardContent>
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm">{billingError}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchBilling}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const subscription = billingData?.subscription;
  const currentPlan = billingData?.plan;
  const plans = billingData?.plans ?? [];
  const status = subscription?.status ?? 'INACTIVE';
  const isTrialing = status === 'TRIALING';
  const trialDays = subscription?.trialDaysRemaining ?? 0;
  const TRIAL_LENGTH = 14;
  const trialProgress = TRIAL_LENGTH > 0 ? Math.max(0, Math.min(100, ((TRIAL_LENGTH - trialDays) / TRIAL_LENGTH) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Trial countdown banner */}
      {isTrialing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800">
                  Your free trial ends in {trialDays} day{trialDays !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-yellow-600">
                  Upgrade now to keep using all features without interruption.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => handleUpgrade(currentPlan?.id === 'team' ? 'team' : 'solo')}>
              Upgrade Now
            </Button>
          </div>
          {/* Trial progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-yellow-600 mb-1">
              <span>Trial started</span>
              <span>{trialDays} day{trialDays !== 1 ? 's' : ''} left</span>
            </div>
            <div className="h-2 bg-yellow-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all"
                style={{ width: `${trialProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Current subscription status */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className={`rounded-lg p-4 border ${
              status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200' :
              status === 'TRIALING' ? 'bg-yellow-50 border-yellow-200' :
              status === 'PAST_DUE' ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {currentPlan?.name ?? 'No Plan'} Plan
                    </p>
                    <Badge variant={getStatusBadgeVariant(status)} size="sm">
                      {status === 'TRIALING' ? 'Trial' :
                       status === 'ACTIVE' ? 'Active' :
                       status === 'PAST_DUE' ? 'Past Due' :
                       status === 'CANCELLED' ? 'Cancelled' :
                       'Inactive'}
                    </Badge>
                  </div>
                  {currentPlan && (
                    <p className="text-sm text-gray-600 mt-1">
                      ${currentPlan.priceUsd}/mo{currentPlan.perUser ? ' per user' : ''}
                      {' '}&middot;{' '}
                      {currentPlan.maxUsers === -1 ? 'Unlimited users' : `${currentPlan.maxUsers} user${currentPlan.maxUsers !== 1 ? 's' : ''}`}
                    </p>
                  )}
                  {subscription?.currentPeriodEnd && (
                    <p className="text-sm text-gray-500 mt-1">
                      {isTrialing ? 'Trial ends' : 'Next billing date'}:{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-JM', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison cards */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentPlan?.id === plan.id;
              const annualMonthlyCost = (plan.priceUsdAnnual / 12).toFixed(2);
              const annualSavings = Math.round(((plan.priceUsd * 12 - plan.priceUsdAnnual) / (plan.priceUsd * 12)) * 100);

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-lg border-2 p-6 transition-colors ${
                    isCurrent
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-4">
                      <Badge variant="success" size="sm">Current Plan</Badge>
                    </div>
                  )}

                  <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>

                  <div className="mt-3">
                    <p className="text-3xl font-bold text-gray-900">
                      ${plan.priceUsd}
                      <span className="text-sm font-normal text-gray-500">
                        /{plan.perUser ? 'user/' : ''}mo
                      </span>
                    </p>
                    <p className="text-sm text-emerald-600 font-medium mt-1">
                      or ${plan.priceUsdAnnual}/{plan.perUser ? 'user/' : ''}yr{' '}
                      <span className="text-xs text-gray-500">
                        (~${annualMonthlyCost}/mo &mdash; save {annualSavings}%)
                      </span>
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={checkoutLoading === plan.id}
                      >
                        {checkoutLoading === plan.id
                          ? 'Redirecting...'
                          : currentPlan && plans.indexOf(plan) < plans.indexOf(currentPlan)
                            ? 'Downgrade'
                            : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// SECURITY TAB COMPONENT
// ============================================

interface SessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string; bgColor: string } {
  let score = 0;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'text-red-600', bgColor: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
  if (score <= 3) return { score, label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'text-emerald-600', bgColor: 'bg-emerald-500' };
}

function parseUserAgent(ua: string | null): { device: string; icon: 'desktop' | 'mobile' } {
  if (!ua) return { device: 'Unknown Device', icon: 'desktop' };
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);

  let browser = 'Unknown Browser';
  if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = '';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';

  return {
    device: `${browser}${os ? ` on ${os}` : ''}`,
    icon: isMobile ? 'mobile' : 'desktop',
  };
}

function SecurityTab() {
  // ── Change Password State ──
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);

  // ── 2FA State ──
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'backup'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableTotpCode, setDisableTotpCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // ── Sessions State ──
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);

  // ── Fetch user security info on mount ──
  useEffect(() => {
    async function fetchSecurityInfo() {
      try {
        const res = await api.get<{
          user: {
            passwordChangedAt?: string | null;
            twoFactorEnabled?: boolean;
          };
        }>('/api/auth/me');
        setPasswordChangedAt(res.user.passwordChangedAt ?? null);
        setTwoFactorEnabled(res.user.twoFactorEnabled ?? false);
      } catch {
        // Silently fail — we still show the UI
      }
    }
    fetchSecurityInfo();
  }, []);

  // ── Fetch sessions on mount ──
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await api.get<{ data: SessionItem[] }>('/api/auth/sessions');
      setSessions(res.data);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Password handlers ──
  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangedAt(new Date().toISOString());
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(null);
      }, 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── 2FA handlers ──
  const handleSetup2FA = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      const res = await api.post<{
        secret: string;
        otpauthUrl: string;
        backupCodes: string[];
        message: string;
      }>('/api/auth/2fa/setup');
      setTotpSecret(res.secret);
      setQrCodeUrl(res.otpauthUrl);
      setSetupBackupCodes(res.backupCodes);
      setSetupStep('qr');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setVerifyLoading(true);
    setTwoFactorError(null);
    try {
      await api.post<{ success: boolean; message: string }>('/api/auth/2fa/verify', {
        code: verifyCode,
        action: 'setup',
      });
      setBackupCodes(setupBackupCodes);
      setSetupStep('backup');
      setTwoFactorEnabled(true);
      setVerifyCode('');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setDisableLoading(true);
    setTwoFactorError(null);
    try {
      await api.post<{ success: boolean; message: string }>('/api/auth/2fa/disable', {
        password: disablePassword || undefined,
        totpCode: disableTotpCode || undefined,
      });
      setTwoFactorEnabled(false);
      setShowDisable2FA(false);
      setDisablePassword('');
      setDisableTotpCode('');
      setSetupStep('idle');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleDownloadBackupCodes = () => {
    const text = `YaadBooks Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nEach code can only be used once. Store them securely.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yaadbooks-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Session handlers ──
  const handleRevokeSession = async (sessionId: string) => {
    setRevokeLoading(sessionId);
    try {
      await api.post(`/api/auth/sessions/${sessionId}/revoke`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevokeLoading(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokeAllLoading(true);
    try {
      await api.post<{ message: string; revokedCount: number }>('/api/auth/sessions/revoke-all');
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setRevokeAllLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      {/* ── Change Password Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LockClosedIcon className="w-5 h-5 text-gray-600" />
              <CardTitle>Password</CardTitle>
            </div>
            {!showPasswordForm && (
              <Button variant="outline" size="sm" onClick={() => { setShowPasswordForm(true); setPasswordError(null); setPasswordSuccess(null); }}>
                Change Password
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-1">
            Last changed: {passwordChangedAt ? formatDate(passwordChangedAt) : 'Never'}
          </p>

          {showPasswordForm && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4" />
                  {passwordSuccess}
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Enter your current password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Enter a strong new password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${passwordStrength.bgColor}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.color}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {[
                        { check: newPassword.length >= 12, label: 'At least 12 characters' },
                        { check: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                        { check: /[a-z]/.test(newPassword), label: 'Lowercase letter' },
                        { check: /[0-9]/.test(newPassword), label: 'Number' },
                        { check: /[^A-Za-z0-9]/.test(newPassword), label: 'Special character' },
                      ].map((req) => (
                        <li key={req.label} className={`text-xs flex items-center gap-1.5 ${req.check ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {req.check ? (
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" />
                          )}
                          {req.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      confirmPassword && confirmPassword !== newPassword ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your new password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  disabled={passwordLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleChangePassword}
                  disabled={
                    passwordLoading ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword ||
                    passwordStrength.score < 5
                  }
                >
                  {passwordLoading ? 'Changing...' : 'Update Password'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Two-Factor Authentication Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-gray-600" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            {twoFactorEnabled && (
              <Badge variant="success" size="sm">Enabled</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {twoFactorError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
              {twoFactorError}
            </div>
          )}

          {/* 2FA Not Enabled */}
          {!twoFactorEnabled && setupStep === 'idle' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Add an extra layer of security to your account. When enabled, you will need to enter a code from
                your authenticator app each time you sign in.
              </p>
              <Button
                size="sm"
                onClick={handleSetup2FA}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Enable 2FA'
                )}
              </Button>
            </div>
          )}

          {/* 2FA Setup: QR Code Step */}
          {!twoFactorEnabled && setupStep === 'qr' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Step 1: Scan QR Code</p>
                <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)</p>
              </div>

              {/* QR Code Image */}
              <div className="flex justify-center py-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                    className="rounded"
                  />
                </div>
              </div>

              {/* Manual Entry Secret */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Or enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-sm font-mono break-all select-all">
                    {totpSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(totpSecret)}
                    className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg"
                    title="Copy secret"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Verification Code Input */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Step 2: Enter verification code</p>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="000000"
                    maxLength={6}
                    disabled={verifyLoading}
                  />
                  <Button
                    size="sm"
                    onClick={handleVerify2FA}
                    disabled={verifyLoading || verifyCode.length !== 6}
                  >
                    {verifyLoading ? 'Verifying...' : 'Verify & Enable'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-start pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSetupStep('idle');
                    setQrCodeUrl('');
                    setTotpSecret('');
                    setVerifyCode('');
                    setTwoFactorError(null);
                  }}
                >
                  Cancel Setup
                </Button>
              </div>
            </div>
          )}

          {/* 2FA Setup: Backup Codes Step */}
          {setupStep === 'backup' && backupCodes.length > 0 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">Two-factor authentication has been enabled!</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Save your backup codes</p>
                <p>Store these codes in a safe place. Each code can only be used once. If you lose access to your authenticator app, you can use a backup code to sign in.</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono text-gray-800 bg-white px-3 py-1.5 rounded border border-gray-200 text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyBackupCodes}
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                  Copy Codes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBackupCodes}
                >
                  <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                  Download Codes
                </Button>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSetupStep('idle');
                    setBackupCodes([]);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* 2FA Enabled: Show status and disable option */}
          {twoFactorEnabled && setupStep === 'idle' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Your account is secured with two-factor authentication. You will be prompted for a verification code
                when signing in.
              </p>
              {!showDisable2FA ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDisable2FA(true); setTwoFactorError(null); }}
                >
                  Disable 2FA
                </Button>
              ) : (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700">Confirm your identity to disable 2FA</p>
                  <p className="text-xs text-gray-500">Enter your password or a TOTP code from your authenticator app.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="Your password"
                        disabled={disableLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Or TOTP Code</label>
                      <input
                        type="text"
                        value={disableTotpCode}
                        onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="000000"
                        maxLength={6}
                        disabled={disableLoading}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDisable2FA}
                      disabled={disableLoading || (!disablePassword && disableTotpCode.length !== 6)}
                    >
                      {disableLoading ? 'Disabling...' : 'Confirm Disable'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowDisable2FA(false);
                        setDisablePassword('');
                        setDisableTotpCode('');
                        setTwoFactorError(null);
                      }}
                      disabled={disableLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Active Sessions Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ComputerDesktopIcon className="w-5 h-5 text-gray-600" />
              <CardTitle>Active Sessions</CardTitle>
            </div>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAllSessions}
                disabled={revokeAllLoading}
              >
                {revokeAllLoading ? 'Revoking...' : 'Logout All Other Devices'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading sessions...</span>
            </div>
          ) : sessionsError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {sessionsError}
              <Button variant="outline" size="sm" className="ml-3" onClick={fetchSessions}>Retry</Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No active sessions found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.map((session) => {
                const parsed = parseUserAgent(session.userAgent);
                return (
                  <div key={session.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {parsed.icon === 'mobile' ? (
                          <DevicePhoneMobileIcon className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ComputerDesktopIcon className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{parsed.device}</p>
                          {session.isCurrent && (
                            <Badge variant="success" size="sm">This device</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {session.ipAddress && <span>{session.ipAddress}</span>}
                          <span>Started {formatRelativeDate(session.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokeLoading === session.id}
                      >
                        {revokeLoading === session.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// MAIN SETTINGS PAGE
// ============================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [showResetModal, setShowResetModal] = useState(false);

  const { activeCompany, setActiveCompany, user, updateUser, updateSettings } = useAppStore();
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
    language: 'english',
    darkMode: false,
    compactMode: false,
  });

  // Load display settings from API on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{
          theme: string;
          language: string;
          currency: string;
          dateFormat: string;
          compactMode: boolean;
        }>('/api/v1/user-settings');
        setDisplaySettings({
          currency: data.currency || 'JMD',
          dateFormat: data.dateFormat || 'DD/MM/YYYY',
          language: data.language || 'english',
          darkMode: data.theme === 'dark',
          compactMode: data.compactMode ?? false,
        });
        // Apply dark mode and compact mode classes on load
        if (data.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        if (data.compactMode) {
          document.documentElement.classList.add('compact');
        } else {
          document.documentElement.classList.remove('compact');
        }
      } catch {
        // Silently fall back to defaults if API is unavailable
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load notification settings from API on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{
          enableNotifications: boolean;
          settings: Array<{
            key: string;
            label: string;
            description: string;
            email: boolean;
            push: boolean;
            inApp: boolean;
          }>;
        }>('/api/v1/notifications/settings');
        // Map the API response to our simple toggle format
        const systemSetting = data.settings.find((s) => s.key === 'system');
        const expenseSetting = data.settings.find((s) => s.key === 'expense_status');
        setNotificationSettings({
          emailNotifications: data.enableNotifications,
          lowStockAlerts: data.settings.find((s) => s.key === 'low_stock')?.email ?? true,
          paymentReminders: data.settings.find((s) => s.key === 'payment_received')?.email ?? true,
          dailySummary: expenseSetting?.email ?? false,
          weeklyReport: systemSetting?.email ?? true,
        });
      } catch {
        // Silently fall back to defaults
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const handleSaveCompany = async () => {
    if (!activeCompany) return;
    setIsSavingCompany(true);
    try {
      const updated = await api.put(`/api/v1/companies/${activeCompany.id}`, {
        businessName: companyForm.businessName || undefined,
        tradingName: companyForm.tradingName || undefined,
        trnNumber: companyForm.trnNumber || undefined,
        gctNumber: companyForm.gctNumber || undefined,
        email: companyForm.email || undefined,
        phone: companyForm.phone || undefined,
        address: companyForm.address || undefined,
        parish: companyForm.parish || undefined,
        website: companyForm.website || undefined,
        industry: companyForm.industry || undefined,
      });
      setActiveCompany({ ...activeCompany, ...(updated as any), updatedAt: new Date() });
      alert('Company settings saved!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save company settings');
    } finally {
      setIsSavingCompany(false);
    }
  };

  // ── Company Logo Upload ──
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(
    (activeCompany as any)?.logoUrl || null
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompany) return;
    setLogoError('');
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`/api/v1/companies/${activeCompany.id}/logo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        setLogoError(err.error || 'Failed to upload logo');
        return;
      }
      const data = await res.json();
      setCompanyLogoUrl(data.logoUrl);
      alert('Logo uploaded successfully!');
    } catch {
      setLogoError('Network error uploading logo.');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCompanyLogo = async () => {
    if (!activeCompany) return;
    setLogoError('');
    setLogoUploading(true);
    try {
      const res = await fetch(`/api/v1/companies/${activeCompany.id}/logo`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        setLogoError(err.error || 'Failed to remove logo');
        return;
      }
      setCompanyLogoUrl(null);
      alert('Logo removed.');
    } catch {
      setLogoError('Network error.');
    } finally {
      setLogoUploading(false);
    }
  };

  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const handleSaveInvoiceSettings = async () => {
    if (!activeCompany) return;
    setIsSavingInvoice(true);
    try {
      await api.put(`/api/v1/companies/${activeCompany.id}`, {
        invoicePrefix: invoiceSettings.prefix || undefined,
        invoiceNextNum: invoiceSettings.nextNumber || undefined,
        invoiceTemplate: invoiceSettings.template || undefined,
        primaryColor: invoiceSettings.primaryColor || undefined,
        accentColor: invoiceSettings.accentColor || undefined,
        invoiceShowLogo: invoiceSettings.showLogo,
        invoiceTerms: invoiceSettings.termsAndConditions || undefined,
        invoiceNotes: invoiceSettings.notes || undefined,
        invoiceFooter: invoiceSettings.footer || undefined,
      });
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save invoice settings');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const [isSavingUser, setIsSavingUser] = useState(false);
  const handleSaveUser = async () => {
    if (!user) return;
    setIsSavingUser(true);
    try {
      await api.patch(`/api/auth/users/${(user as any).id || (user as any).sub}`, {
        firstName: userForm.firstName || undefined,
        lastName: userForm.lastName || undefined,
        email: userForm.email || undefined,
        phone: userForm.phone || undefined,
      });
      updateUser({ ...userForm });
      alert('Profile settings saved!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSavingUser(false);
    }
  };

  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const handleSaveDisplay = async () => {
    setIsSavingDisplay(true);
    try {
      await api.put('/api/v1/user-settings', {
        theme: displaySettings.darkMode ? 'dark' : 'light',
        language: displaySettings.language,
        currency: displaySettings.currency,
        dateFormat: displaySettings.dateFormat,
        compactMode: displaySettings.compactMode,
      });
      // Apply dark mode immediately
      if (displaySettings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Apply compact mode immediately
      if (displaySettings.compactMode) {
        document.documentElement.classList.add('compact');
      } else {
        document.documentElement.classList.remove('compact');
      }
      // Also update the app store settings
      updateSettings({
        theme: displaySettings.darkMode ? 'dark' : 'light',
        language: displaySettings.language as 'english' | 'patois' | 'bilingual',
        currency: displaySettings.currency as 'JMD' | 'USD',
        dateFormat: displaySettings.dateFormat as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD',
      });
      alert('Display settings saved!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save display settings');
    } finally {
      setIsSavingDisplay(false);
    }
  };

  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      // Convert our simple toggles to the API format
      const settings = [
        { key: 'invoice_due', label: 'Invoice Due Reminders', description: 'Get notified when invoices are approaching due date', email: notificationSettings.emailNotifications, push: notificationSettings.emailNotifications, inApp: true },
        { key: 'invoice_overdue', label: 'Overdue Invoices', description: 'Alerts for invoices past their due date', email: notificationSettings.emailNotifications, push: notificationSettings.emailNotifications, inApp: true },
        { key: 'payment_received', label: 'Payment Received', description: 'Notification when a payment is recorded', email: notificationSettings.paymentReminders, push: false, inApp: true },
        { key: 'low_stock', label: 'Low Stock Alerts', description: 'When inventory falls below reorder level', email: notificationSettings.lowStockAlerts, push: notificationSettings.lowStockAlerts, inApp: true },
        { key: 'payroll_due', label: 'Payroll Reminders', description: 'Reminders for upcoming payroll runs', email: notificationSettings.emailNotifications, push: true, inApp: true },
        { key: 'expense_status', label: 'Expense Updates', description: 'When expenses are approved or rejected', email: notificationSettings.dailySummary, push: false, inApp: true },
        { key: 'po_received', label: 'New Purchase Orders', description: 'When a new customer PO is received', email: notificationSettings.emailNotifications, push: true, inApp: true },
        { key: 'bank_sync', label: 'Bank Sync Updates', description: 'Status of bank transaction imports', email: false, push: false, inApp: true },
        { key: 'system', label: 'System Notifications', description: 'Important system updates and announcements', email: notificationSettings.weeklyReport, push: false, inApp: true },
      ];
      await api.put('/api/v1/notifications/settings', { settings });
      alert('Notification preferences saved!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save notification preferences');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const [isSavingTax, setIsSavingTax] = useState(false);
  const handleSaveTax = async () => {
    setIsSavingTax(true);
    try {
      await api.put('/api/v1/pos/settings', {
        gctRate: posSettings.gctRate,
        gctRegistrationNumber: posSettings.gctRegistrationNumber || null,
        taxIncludedInPrice: posSettings.taxIncludedInPrice,
        businessTRN: posSettings.businessTRN || null,
      });
      alert('GCT / Tax settings saved!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save tax settings');
    } finally {
      setIsSavingTax(false);
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
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'team', name: 'Team', icon: UsersIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'display', name: 'Display', icon: PaintBrushIcon },
    { id: 'billing', name: 'Billing', icon: CreditCardIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'data', name: 'Data', icon: CloudArrowUpIcon },
    { id: 'tax', name: 'GCT / Tax', icon: CalculatorIcon },
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

                  {/* Company Logo Upload */}
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Company Logo
                    </label>
                    <div className="flex items-center gap-4">
                      {companyLogoUrl ? (
                        <div className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={companyLogoUrl}
                            alt="Company logo"
                            className="w-24 h-24 rounded-lg object-contain border border-gray-200 dark:border-gray-700 bg-white p-1"
                          />
                          <button
                            onClick={handleRemoveCompanyLogo}
                            disabled={logoUploading}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                            title="Remove logo"
                          >
                            <XMarkIcon className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                          <PhotoIcon className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                            className="hidden"
                            onChange={handleCompanyLogoUpload}
                            disabled={logoUploading}
                          />
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                            {logoUploading ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <CloudArrowUpIcon className="w-4 h-4" />
                                {companyLogoUrl ? 'Change Logo' : 'Upload Logo'}
                              </>
                            )}
                          </span>
                        </label>
                        <p className="text-xs text-gray-500">PNG, JPG, SVG, WebP. Max 2 MB.</p>
                        {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveCompany} disabled={isSavingCompany}>
                      {isSavingCompany ? 'Saving...' : 'Save Changes'}
                    </Button>
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
                <Button onClick={handleSaveInvoiceSettings} disabled={isSavingInvoice}>
                  {isSavingInvoice ? 'Saving...' : 'Save Invoice Settings'}
                </Button>
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
                    <Button onClick={handleSaveUser} disabled={isSavingUser}>
                      {isSavingUser ? 'Saving...' : 'Save Profile'}
                    </Button>
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
                    <Button onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                      {isSavingNotifications ? 'Saving...' : 'Save Preferences'}
                    </Button>
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
                        onChange={(e) => {
                          setDisplaySettings({ ...displaySettings, darkMode: e.target.checked });
                          // Apply dark mode immediately on toggle
                          if (e.target.checked) {
                            document.documentElement.classList.add('dark');
                          } else {
                            document.documentElement.classList.remove('dark');
                          }
                        }}
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
                        onChange={(e) => {
                          setDisplaySettings({ ...displaySettings, compactMode: e.target.checked });
                          // Apply compact mode immediately on toggle
                          if (e.target.checked) {
                            document.documentElement.classList.add('compact');
                          } else {
                            document.documentElement.classList.remove('compact');
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveDisplay} disabled={isSavingDisplay}>
                      {isSavingDisplay ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && <BillingTab />}

          {activeTab === 'security' && <SecurityTab />}

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

          {activeTab === 'tax' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalculatorIcon className="w-5 h-5 text-emerald-600" />
                    GCT / Tax Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* GCT Rate */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GCT Rate (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={(posSettings.gctRate * 100).toFixed(2)}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value) / 100;
                            if (!isNaN(rate) && rate >= 0 && rate <= 1) {
                              updatePosSettings({ gctRate: rate });
                            }
                          }}
                          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <span className="text-sm text-gray-500">
                          Current: {(posSettings.gctRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Jamaica&apos;s standard GCT rate is 15%. Set to 0 to disable GCT.
                      </p>
                    </div>

                    {/* GCT Registration Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GCT Registration Number
                      </label>
                      <input
                        type="text"
                        value={posSettings.gctRegistrationNumber || ''}
                        onChange={(e) => updatePosSettings({ gctRegistrationNumber: e.target.value })}
                        placeholder="Enter your GCT registration number"
                        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        This will be displayed on receipts and invoices.
                      </p>
                    </div>

                    {/* Tax Included In Price */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">Tax Included in Prices</p>
                        <p className="text-sm text-gray-500">
                          When enabled, product prices already include GCT
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={posSettings.taxIncludedInPrice}
                          onChange={(e) => updatePosSettings({ taxIncludedInPrice: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                    </div>

                    {/* Business TRN */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business TRN (Tax Registration Number)
                      </label>
                      <input
                        type="text"
                        value={posSettings.businessTRN || ''}
                        onChange={(e) => updatePosSettings({ businessTRN: e.target.value })}
                        placeholder="000-000-000"
                        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Your Jamaica Tax Administration TRN number.
                      </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <Button onClick={handleSaveTax} disabled={isSavingTax}>
                        {isSavingTax ? 'Saving...' : 'Save Tax Settings'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info */}
              <div className="p-4 bg-blue-50 rounded-lg flex items-start gap-3">
                <CalculatorIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-600">
                  <p className="font-medium mb-1">About GCT</p>
                  <p>
                    General Consumption Tax (GCT) is a value-added tax applied to goods and services in Jamaica.
                    Changes here affect all future POS transactions and invoices.
                  </p>
                </div>
              </div>
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
