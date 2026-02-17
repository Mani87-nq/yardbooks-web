'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { Employee, PayrollRun, PayrollEntry } from '@/types';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  UserGroupIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
];

const PAY_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// Jamaica statutory deductions (2024-2026 rates per TAJ)
const NIS_RATE = 0.03; // 3% employee, 3% employer
const NIS_ANNUAL_CEILING = 5000000; // JMD 5M annual ceiling for NIS contributions
const NHT_RATE = 0.02; // 2% employee, 3% employer
const EDUCATION_TAX_RATE = 0.0225; // 2.25%
const PAYE_ANNUAL_THRESHOLD = 1902360; // Annual tax-free threshold (updated 2024)

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const { employees, addEmployee, updateEmployee, deleteEmployee, payrollRuns, addPayrollRun, activeCompany } = useAppStore();

  const [employeeForm, setEmployeeForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    employmentType: 'full_time' as Employee['employmentType'],
    paymentFrequency: 'monthly' as Employee['paymentFrequency'],
    baseSalary: '',
    bankAccountNumber: '',
    bankName: '',
    trnNumber: '',
    nisNumber: '',
    hireDate: new Date().toISOString().split('T')[0],
  });

  const [payrollForm, setPayrollForm] = useState({
    payPeriodStart: '',
    payPeriodEnd: '',
    payDate: '',
    selectedEmployees: [] as string[],
  });

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = !searchQuery ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleOpenEmployeeModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setEmployeeForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email || '',
        phone: employee.phone || '',
        department: employee.department || '',
        position: employee.position || '',
        employmentType: employee.employmentType || 'full_time',
        paymentFrequency: employee.paymentFrequency || 'monthly',
        baseSalary: employee.baseSalary?.toString() || '',
        bankAccountNumber: employee.bankAccountNumber || '',
        bankName: employee.bankName || '',
        trnNumber: employee.trnNumber || '',
        nisNumber: employee.nisNumber || '',
        hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingEmployee(null);
      setEmployeeForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        department: '',
        position: '',
        employmentType: 'full_time',
        paymentFrequency: 'monthly',
        baseSalary: '',
        bankAccountNumber: '',
        bankName: '',
        trnNumber: '',
        nisNumber: '',
        hireDate: new Date().toISOString().split('T')[0],
      });
    }
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = () => {
    if (!employeeForm.firstName.trim() || !employeeForm.lastName.trim()) {
      alert('Please enter employee name');
      return;
    }

    const employeeData = {
      firstName: employeeForm.firstName,
      lastName: employeeForm.lastName,
      email: employeeForm.email || undefined,
      phone: employeeForm.phone || undefined,
      department: employeeForm.department || undefined,
      position: employeeForm.position || 'Employee',
      employmentType: employeeForm.employmentType,
      paymentFrequency: employeeForm.paymentFrequency,
      baseSalary: employeeForm.baseSalary ? parseFloat(employeeForm.baseSalary) : 0,
      bankAccountNumber: employeeForm.bankAccountNumber || undefined,
      bankName: employeeForm.bankName || undefined,
      trnNumber: employeeForm.trnNumber || '',
      nisNumber: employeeForm.nisNumber || '',
      hireDate: employeeForm.hireDate ? new Date(employeeForm.hireDate) : new Date(),
      dateOfBirth: new Date('1990-01-01'),
      isActive: true,
      updatedAt: new Date(),
    };

    if (editingEmployee) {
      updateEmployee(editingEmployee.id, employeeData);
    } else {
      const employeeNumber = `EMP-${Date.now().toString().slice(-6)}`;
      addEmployee({
        id: uuidv4(),
        companyId: activeCompany?.id || '',
        employeeNumber,
        ...employeeData,
        createdAt: new Date(),
      });
    }
    setShowEmployeeModal(false);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      deleteEmployee(id);
    }
  };

  const handleOpenPayrollModal = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setPayrollForm({
      payPeriodStart: firstDay.toISOString().split('T')[0],
      payPeriodEnd: lastDay.toISOString().split('T')[0],
      payDate: today.toISOString().split('T')[0],
      selectedEmployees: employees.filter(e => e.isActive).map(e => e.id),
    });
    setShowPayrollModal(true);
  };

  const calculateDeductions = (grossPay: number) => {
    // NIS: capped at annual ceiling (JMD 5M), so monthly cap = ceiling / 12
    const nisCappedGross = Math.min(grossPay, NIS_ANNUAL_CEILING / 12);
    const nis = nisCappedGross * NIS_RATE;
    const nht = grossPay * NHT_RATE;
    const eduTax = grossPay * EDUCATION_TAX_RATE;

    // Jamaica PAYE income tax (2024-2026 rates per TAJ)
    const annualGross = grossPay * 12;
    let paye = 0;
    if (annualGross > PAYE_ANNUAL_THRESHOLD) {
      const taxable = annualGross - PAYE_ANNUAL_THRESHOLD;
      if (taxable <= 6000000) {
        paye = (taxable * 0.25) / 12;
      } else {
        paye = ((6000000 * 0.25) + ((taxable - 6000000) * 0.30)) / 12;
      }
    }

    return { nis, nht, eduTax, paye, total: nis + nht + eduTax + paye };
  };

  const handleRunPayroll = () => {
    if (!payrollForm.payPeriodStart || !payrollForm.payPeriodEnd || !payrollForm.payDate) {
      alert('Please fill in all pay period fields');
      return;
    }
    if (payrollForm.selectedEmployees.length === 0) {
      alert('Please select at least one employee');
      return;
    }

    const runId = uuidv4();
    const selectedEmps = employees.filter(e => payrollForm.selectedEmployees.includes(e.id));
    let totalGross = 0;
    let totalNet = 0;
    let totalDeductions = 0;
    let totalEmployerContributions = 0;

    const entries: PayrollEntry[] = selectedEmps.map(emp => {
      const gross = emp.baseSalary || 0;
      const deductions = calculateDeductions(gross);
      const employerNis = gross * NIS_RATE;
      const employerNht = gross * NHT_RATE;
      const employerEduTax = gross * EDUCATION_TAX_RATE;
      const heartContribution = gross * 0.03;
      const empContributions = employerNis + employerNht + employerEduTax + heartContribution;

      totalGross += gross;
      totalDeductions += deductions.total;
      totalNet += gross - deductions.total;
      totalEmployerContributions += empContributions;

      return {
        id: uuidv4(),
        payrollRunId: runId,
        employeeId: emp.id,
        employee: emp,
        basicSalary: gross,
        overtime: 0,
        bonus: 0,
        commission: 0,
        allowances: 0,
        grossPay: gross,
        paye: deductions.paye,
        nis: deductions.nis,
        nht: deductions.nht,
        educationTax: deductions.eduTax,
        otherDeductions: 0,
        totalDeductions: deductions.total,
        netPay: gross - deductions.total,
        employerNis,
        employerNht,
        employerEducationTax: employerEduTax,
        heartContribution,
        totalEmployerContributions: empContributions,
      };
    });

    const payrollRun: PayrollRun = {
      id: runId,
      companyId: activeCompany?.id || '',
      periodStart: new Date(payrollForm.payPeriodStart),
      periodEnd: new Date(payrollForm.payPeriodEnd),
      payDate: new Date(payrollForm.payDate),
      status: 'draft',
      entries,
      totalGross,
      totalDeductions,
      totalNet,
      totalEmployerContributions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addPayrollRun(payrollRun);
    setShowPayrollModal(false);
    alert('Payroll run created successfully!');
  };

  // Stats
  const activeEmployees = employees.filter(e => e.isActive);
  const totalMonthlyPayroll = activeEmployees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500">Manage employees and process payroll</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'employees' ? (
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenEmployeeModal()}>
              Add Employee
            </Button>
          ) : (
            <Button icon={<PlayIcon className="w-4 h-4" />} onClick={handleOpenPayrollModal}>
              Run Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'employees'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserGroupIcon className="w-4 h-4 inline mr-2" />
          Employees
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'payroll'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BanknotesIcon className="w-4 h-4 inline mr-2" />
          Payroll Runs
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{activeEmployees.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Monthly Payroll</p>
            <p className="text-2xl font-bold text-blue-600">{formatJMD(totalMonthlyPayroll)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Payroll Runs</p>
            <p className="text-2xl font-bold text-gray-900">{payrollRuns.length}</p>
          </div>
        </Card>
      </div>

      {/* Content */}
      {activeTab === 'employees' ? (
        <>
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />
          </div>

          {/* Employee Table */}
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                      <p className="mb-4">No employees found</p>
                      <Button onClick={() => handleOpenEmployeeModal()}>Add your first employee</Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {employee.firstName} {employee.lastName}
                          </p>
                          {employee.email && (
                            <p className="text-sm text-gray-500">{employee.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500">{employee.department || '-'}</TableCell>
                      <TableCell className="text-gray-500">{employee.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {employee.employmentType?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {employee.baseSalary ? formatJMD(employee.baseSalary) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? 'success' : 'default'}>
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEmployeeModal(employee)}>
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEmployee(employee.id)}>
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        /* Payroll Runs Table */
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run #</TableHead>
                <TableHead>Pay Period</TableHead>
                <TableHead>Pay Date</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                    <p className="mb-4">No payroll runs yet</p>
                    <Button onClick={handleOpenPayrollModal}>
                      <PlayIcon className="w-4 h-4 mr-1" />
                      Run First Payroll
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                payrollRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-gray-600">{run.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                    </TableCell>
                    <TableCell className="text-gray-500">{formatDate(run.payDate)}</TableCell>
                    <TableCell>{run.entries.length}</TableCell>
                    <TableCell className="font-medium">{formatJMD(run.totalGross)}</TableCell>
                    <TableCell className="font-medium text-emerald-600">
                      {formatJMD(run.totalNet)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === 'paid' ? 'success' :
                          run.status === 'approved' ? 'warning' :
                          'default'
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Employee Modal */}
      <Modal
        isOpen={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                value={employeeForm.firstName}
                onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
              />
              <Input
                label="Last Name *"
                value={employeeForm.lastName}
                onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
              />
              <Input
                label="Phone"
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Department"
                value={employeeForm.department}
                onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
              />
              <Input
                label="Position"
                value={employeeForm.position}
                onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  value={employeeForm.employmentType}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, employmentType: e.target.value as Employee['employmentType'] })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pay Frequency</label>
                <select
                  value={employeeForm.paymentFrequency}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, paymentFrequency: e.target.value as Employee['paymentFrequency'] })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {PAY_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Base Salary"
                type="number"
                value={employeeForm.baseSalary}
                onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Bank Name"
                value={employeeForm.bankName}
                onChange={(e) => setEmployeeForm({ ...employeeForm, bankName: e.target.value })}
              />
              <Input
                label="Bank Account"
                value={employeeForm.bankAccountNumber}
                onChange={(e) => setEmployeeForm({ ...employeeForm, bankAccountNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="TRN"
                value={employeeForm.trnNumber}
                onChange={(e) => setEmployeeForm({ ...employeeForm, trnNumber: e.target.value })}
              />
              <Input
                label="NIS Number"
                value={employeeForm.nisNumber}
                onChange={(e) => setEmployeeForm({ ...employeeForm, nisNumber: e.target.value })}
              />
              <Input
                label="Hire Date"
                type="date"
                value={employeeForm.hireDate}
                onChange={(e) => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowEmployeeModal(false)}>Cancel</Button>
          <Button onClick={handleSaveEmployee}>{editingEmployee ? 'Update' : 'Create'}</Button>
        </ModalFooter>
      </Modal>

      {/* Payroll Run Modal */}
      <Modal
        isOpen={showPayrollModal}
        onClose={() => setShowPayrollModal(false)}
        title="Run Payroll"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Pay Period Start *"
                type="date"
                value={payrollForm.payPeriodStart}
                onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodStart: e.target.value })}
              />
              <Input
                label="Pay Period End *"
                type="date"
                value={payrollForm.payPeriodEnd}
                onChange={(e) => setPayrollForm({ ...payrollForm, payPeriodEnd: e.target.value })}
              />
              <Input
                label="Pay Date *"
                type="date"
                value={payrollForm.payDate}
                onChange={(e) => setPayrollForm({ ...payrollForm, payDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {employees.filter(e => e.isActive).map((emp) => (
                  <label key={emp.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                    <input
                      type="checkbox"
                      checked={payrollForm.selectedEmployees.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPayrollForm({
                            ...payrollForm,
                            selectedEmployees: [...payrollForm.selectedEmployees, emp.id],
                          });
                        } else {
                          setPayrollForm({
                            ...payrollForm,
                            selectedEmployees: payrollForm.selectedEmployees.filter(id => id !== emp.id),
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                      <p className="text-sm text-gray-500">{emp.position || emp.department}</p>
                    </div>
                    <span className="text-sm font-medium">
                      {emp.baseSalary ? formatJMD(emp.baseSalary) : '-'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Selected Employees:</span>
                <span className="font-medium">{payrollForm.selectedEmployees.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estimated Gross:</span>
                <span className="font-medium">
                  {formatJMD(
                    employees
                      .filter(e => payrollForm.selectedEmployees.includes(e.id))
                      .reduce((sum, e) => sum + (e.baseSalary || 0), 0)
                  )}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">Jamaica Statutory Deductions</p>
              <ul className="space-y-1 text-blue-600">
                <li>NIS: 3% employee / 3% employer</li>
                <li>NHT: 2% employee / 3% employer</li>
                <li>Education Tax: 2.25%</li>
                <li>PAYE: Based on tax bands</li>
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowPayrollModal(false)}>Cancel</Button>
          <Button onClick={handleRunPayroll}>
            <PlayIcon className="w-4 h-4 mr-1" />
            Process Payroll
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
