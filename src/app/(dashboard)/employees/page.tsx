'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { PermissionGate } from '@/components/PermissionGate';

// ── Types ────────────────────────────────────────────────────────
interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  avatarColor: string;
  role: string;
  permissions: Record<string, unknown>;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  pin?: string; // Only returned on create
}

const ROLES = [
  { value: 'POS_CASHIER', label: 'Cashier' },
  { value: 'POS_SERVER', label: 'Server' },
  { value: 'SHIFT_MANAGER', label: 'Shift Manager' },
  { value: 'STORE_MANAGER', label: 'Store Manager' },
];

const AVATAR_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const ROLE_LABELS: Record<string, string> = {
  POS_CASHIER: 'Cashier',
  POS_SERVER: 'Server',
  SHIFT_MANAGER: 'Shift Manager',
  STORE_MANAGER: 'Store Manager',
};

const ROLE_COLORS: Record<string, string> = {
  POS_CASHIER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  POS_SERVER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SHIFT_MANAGER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  STORE_MANAGER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// ── Component ────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinEmployeeName, setPinEmployeeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phone: '',
    avatarColor: AVATAR_COLORS[0],
    role: 'POS_CASHIER',
    permissions: {} as Record<string, boolean>,
  });

  // ── Fetch employees ────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      params.set('active', 'true');
      params.set('limit', '200');

      const response = await api.get<{ data: EmployeeProfile[] }>(
        `/api/employees?${params.toString()}`
      );
      setEmployees(response.data);
    } catch {
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Create employee ────────────────────────────────────────────
  const handleCreate = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await api.post<EmployeeProfile>('/api/employees', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: formData.displayName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        avatarColor: formData.avatarColor,
        role: formData.role,
        permissions: formData.permissions,
      });

      setShowAddModal(false);
      resetForm();

      // Show the generated PIN
      if (response.pin) {
        setNewPin(response.pin);
        setPinEmployeeName(`${response.firstName} ${response.lastName}`);
        setShowPinModal(true);
      }

      fetchEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  // ── Update employee ────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    setError('');

    try {
      await api.put(`/api/employees/${editingEmployee.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: formData.displayName || null,
        email: formData.email || null,
        phone: formData.phone || null,
        avatarColor: formData.avatarColor,
        role: formData.role,
        permissions: formData.permissions,
      });

      setShowEditModal(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete (deactivate) employee ───────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) return;

    try {
      await api.delete(`/api/employees/${id}`);
      fetchEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate employee');
    }
  };

  // ── Reset PIN ──────────────────────────────────────────────────
  const handleResetPin = async (employee: EmployeeProfile) => {
    if (!window.confirm(`Reset PIN for ${employee.firstName} ${employee.lastName}?`)) return;

    try {
      const response = await api.post<{ pin: string }>(`/api/employees/${employee.id}/reset-pin`, {});
      setNewPin(response.pin);
      setPinEmployeeName(`${employee.firstName} ${employee.lastName}`);
      setShowPinModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset PIN');
    }
  };

  // ── Form helpers ───────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      displayName: '',
      email: '',
      phone: '',
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      role: 'POS_CASHIER',
      permissions: {},
    });
    setError('');
  };

  const openEditModal = (emp: EmployeeProfile) => {
    setEditingEmployee(emp);
    setFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      displayName: emp.displayName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      avatarColor: emp.avatarColor,
      role: emp.role,
      permissions: (emp.permissions || {}) as Record<string, boolean>,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(newPin);
  };

  // ── Stats ──────────────────────────────────────────────────────
  const stats = {
    total: employees.length,
    cashiers: employees.filter((e) => e.role === 'POS_CASHIER').length,
    servers: employees.filter((e) => e.role === 'POS_SERVER').length,
    managers: employees.filter((e) => ['SHIFT_MANAGER', 'STORE_MANAGER'].includes(e.role)).length,
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS Employees</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage employee profiles for POS and kiosk access
          </p>
        </div>
        <PermissionGate permission="users:create">
          <Button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Employee
          </Button>
        </PermissionGate>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <UserGroupIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <UserGroupIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cashiers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.cashiers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <UserGroupIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Servers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.servers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <ShieldCheckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Managers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.managers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Employee table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <UserGroupIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>No employees found</p>
              <p className="text-sm mt-1">Add your first POS employee to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: emp.avatarColor }}
                          >
                            {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {emp.firstName} {emp.lastName}
                            </p>
                            {emp.displayName && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                &quot;{emp.displayName}&quot;
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[emp.role] || ''}`}>
                          {ROLE_LABELS[emp.role] || emp.role}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          {emp.email && <p className="text-gray-600 dark:text-gray-400">{emp.email}</p>}
                          {emp.phone && <p className="text-gray-500 dark:text-gray-500">{emp.phone}</p>}
                          {!emp.email && !emp.phone && <span className="text-gray-400">--</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {emp.lastLoginAt
                            ? new Date(emp.lastLoginAt).toLocaleDateString()
                            : 'Never'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate permission="users:update">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="users:update">
                            <button
                              onClick={() => handleResetPin(emp)}
                              className="p-2 rounded-lg text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              title="Reset PIN"
                            >
                              <KeyIcon className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="users:delete">
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Deactivate"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Employee Modal ──────────────────────────────────── */}
      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add POS Employee">
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <Input
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <Input
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name (optional)
                </label>
                <Input
                  value={formData.displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Nickname for POS display"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email (optional)
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone (optional)
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avatar Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, avatarColor: color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.avatarColor === color
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'canVoid', label: 'Can void transactions' },
                    { key: 'canRefund', label: 'Can process refunds' },
                    { key: 'canDiscount', label: 'Can apply discounts' },
                    { key: 'canOpenDrawer', label: 'Can open cash drawer (no sale)' },
                    { key: 'canViewReports', label: 'Can view reports' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData.permissions[perm.key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [perm.key]: e.target.checked },
                        })}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.firstName || !formData.lastName || saving}
            >
              {saving ? 'Creating...' : 'Create Employee'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Edit Employee Modal ─────────────────────────────────── */}
      {showEditModal && editingEmployee && (
        <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingEmployee(null); }} title="Edit Employee">
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <Input
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <Input
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <Input
                  value={formData.displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avatar Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, avatarColor: color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.avatarColor === color
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                <div className="space-y-2">
                  {[
                    { key: 'canVoid', label: 'Can void transactions' },
                    { key: 'canRefund', label: 'Can process refunds' },
                    { key: 'canDiscount', label: 'Can apply discounts' },
                    { key: 'canOpenDrawer', label: 'Can open cash drawer (no sale)' },
                    { key: 'canViewReports', label: 'Can view reports' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData.permissions[perm.key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [perm.key]: e.target.checked },
                        })}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setShowEditModal(false); setEditingEmployee(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.firstName || !formData.lastName || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── PIN Display Modal ───────────────────────────────────── */}
      {showPinModal && (
        <Modal isOpen={showPinModal} onClose={() => setShowPinModal(false)} title="Employee PIN">
          <ModalBody>
            <div className="text-center space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This PIN will only be shown once. Share it securely with the employee.
                </p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                PIN for <span className="font-bold">{pinEmployeeName}</span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <div className="text-5xl font-mono font-bold tracking-[0.3em] text-gray-900 dark:text-white">
                  {newPin}
                </div>
                <button
                  onClick={handleCopyPin}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Copy PIN"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowPinModal(false)}>
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
