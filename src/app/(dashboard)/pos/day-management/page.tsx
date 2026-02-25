'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter } from '@/components/ui';
import {
  useBusinessDays,
  useOpenBusinessDay,
  useCloseBusinessDay,
  usePosSessions,
  useAddCashMovement,
  type ApiBusinessDay,
  type ApiEndOfDayReport,
} from '@/hooks/api/usePos';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import {
  SunIcon,
  MoonIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  BanknotesIcon,
  ClockIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-JM', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CLOSING_SOON: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  FORCE_CLOSED: 'bg-red-100 text-red-700',
};

export default function DayManagementPage() {
  const { fc } = useCurrency();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashOpModal, setShowCashOpModal] = useState<'drop' | 'payout' | 'float' | null>(null);
  const [showEodModal, setShowEodModal] = useState<ApiEndOfDayReport | null>(null);
  const [openingNotes, setOpeningNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [forceClose, setForceClose] = useState(false);
  const [cashOpAmount, setCashOpAmount] = useState('');
  const [cashOpReason, setCashOpReason] = useState('');

  // Queries
  const { data: daysData, isLoading } = useBusinessDays({ limit: 30 });
  const { data: openDaysData } = useBusinessDays({ status: 'OPEN', limit: 1 });
  const { data: openSessionsData } = usePosSessions({ status: 'OPEN', limit: 20 });

  // Mutations
  const openDay = useOpenBusinessDay();
  const closeDay = useCloseBusinessDay();
  const addCashMovement = useAddCashMovement();

  const days = daysData?.data ?? [];
  const currentDay: ApiBusinessDay | null = openDaysData?.data?.[0] ?? null;
  const openSessions = openSessionsData?.data ?? [];
  const isStoreOpen = !!currentDay;

  // Handle open day
  const handleOpenDay = async () => {
    try {
      await openDay.mutateAsync({
        date: todayISO(),
        openingNotes: openingNotes || undefined,
      });
      setShowOpenModal(false);
      setOpeningNotes('');
    } catch {
      // Error displayed via mutation state
    }
  };

  // Handle close day
  const handleCloseDay = async () => {
    if (!currentDay) return;
    try {
      await closeDay.mutateAsync({
        id: currentDay.id,
        closingNotes: closingNotes || undefined,
        forceClose: forceClose || undefined,
      });
      setShowCloseModal(false);
      setClosingNotes('');
      setForceClose(false);
    } catch {
      // Error displayed via mutation state
    }
  };

  // Handle cash operation
  const handleCashOp = async () => {
    if (!showCashOpModal || !openSessions[0]) return;
    const amount = parseFloat(cashOpAmount);
    if (!amount || amount <= 0 || !cashOpReason.trim()) return;

    const typeMap = { drop: 'DROP' as const, payout: 'PAYOUT' as const, float: 'ADJUSTMENT' as const };
    try {
      await addCashMovement.mutateAsync({
        sessionId: openSessions[0].id,
        type: typeMap[showCashOpModal],
        amount,
        reason: cashOpReason.trim(),
      });
      setShowCashOpModal(null);
      setCashOpAmount('');
      setCashOpReason('');
    } catch {
      // Error displayed via mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(todayISO())} &middot; Manage store hours, daily open/close, and cash reconciliation
          </p>
        </div>
        <div className="flex gap-2">
          {!isStoreOpen ? (
            <Button onClick={() => setShowOpenModal(true)}>
              <SunIcon className="w-4 h-4 mr-2" />
              Open Store
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setShowCloseModal(true)}>
              <MoonIcon className="w-4 h-4 mr-2" />
              Close Store
            </Button>
          )}
        </div>
      </div>

      {/* Current Day Status */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center',
              isStoreOpen ? 'bg-emerald-100' : 'bg-gray-100'
            )}>
              {isStoreOpen ? (
                <SunIcon className="w-7 h-7 text-emerald-600" />
              ) : (
                <MoonIcon className="w-7 h-7 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isStoreOpen ? 'Store is Open' : 'Store is Closed'}
                </h2>
                {currentDay && (
                  <Badge className={statusColors[currentDay.status] ?? 'bg-gray-100 text-gray-700'}>
                    {currentDay.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {isStoreOpen
                  ? `Opened at ${formatTime(currentDay!.actualOpenTime)} · ${currentDay!.activeSessionCount} active session(s)`
                  : 'No business day is currently open.'}
              </p>
            </div>
            {isStoreOpen && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCashOpModal('drop')}
                  disabled={openSessions.length === 0}
                >
                  <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                  Cash Drop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCashOpModal('payout')}
                  disabled={openSessions.length === 0}
                >
                  <ArrowUpTrayIcon className="w-4 h-4 mr-1" />
                  Payout
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCashOpModal('float')}
                  disabled={openSessions.length === 0}
                >
                  <BanknotesIcon className="w-4 h-4 mr-1" />
                  Add Float
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Stats (when open) */}
      {isStoreOpen && currentDay && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Net Sales', value: fc(currentDay.netSales), color: 'text-emerald-600' },
            { label: 'Transactions', value: String(currentDay.totalTransactions), color: 'text-gray-900' },
            { label: 'Active Sessions', value: String(currentDay.activeSessionCount), color: 'text-blue-600' },
            { label: 'Refunds', value: fc(currentDay.totalRefunds), color: 'text-red-600' },
            { label: 'Cash Variance', value: fc(currentDay.totalCashVariance), color: currentDay.hasVariance ? 'text-red-600' : 'text-emerald-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent>
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active Sessions */}
      {isStoreOpen && openSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {openSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {session.terminalName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.cashierName} &middot; Since {formatTime(session.openedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-emerald-600 text-sm">{fc(session.totalSales)}</p>
                    <p className="text-xs text-gray-500">{session._count?.orders ?? 0} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Business Days */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Business Days</CardTitle>
            <Link href="/pos/reports" className="text-sm text-emerald-600 hover:underline">
              View Reports
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDaysIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No business days recorded yet.</p>
              <p className="text-sm mt-1">Open the store to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left font-medium text-gray-500 px-6 py-2">Date</th>
                    <th className="text-left font-medium text-gray-500 px-3 py-2">Status</th>
                    <th className="text-left font-medium text-gray-500 px-3 py-2">Hours</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2">Net Sales</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2">Txns</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2">Variance</th>
                    <th className="text-right font-medium text-gray-500 px-6 py-2">EOD</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{formatDate(day.date)}</td>
                      <td className="px-3 py-3">
                        <Badge className={cn('text-xs', statusColors[day.status] ?? 'bg-gray-100 text-gray-700')}>
                          {day.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {formatTime(day.actualOpenTime)} – {formatTime(day.actualCloseTime)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{fc(day.netSales)}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{day.totalTransactions}</td>
                      <td className={cn('px-3 py-3 text-right font-medium', day.hasVariance ? 'text-red-600' : 'text-emerald-600')}>
                        {fc(day.totalCashVariance)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {day.eodReport ? (
                          <button
                            onClick={() => setShowEodModal(day.eodReport as ApiEndOfDayReport)}
                            className="text-emerald-600 hover:text-emerald-700 text-xs font-medium hover:underline"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== MODALS ====== */}

      {/* Open Store Modal */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Open Store" size="sm">
        <ModalBody>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center">
                <SunIcon className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-gray-600 text-sm">
                Open the store for <span className="font-semibold">{formatDate(todayISO())}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Notes (optional)</label>
              <Input
                placeholder="e.g. Early opening for sale"
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
              />
            </div>
            {openDay.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {openDay.error instanceof Error ? openDay.error.message : 'Failed to open store'}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowOpenModal(false)}>Cancel</Button>
          <Button onClick={handleOpenDay} disabled={openDay.isPending}>
            {openDay.isPending ? (
              <><ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />Opening...</>
            ) : (
              <><SunIcon className="w-4 h-4 mr-2" />Open Store</>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Close Store Modal */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Store" size="md">
        <ModalBody>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <MoonIcon className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-600 text-sm">
                Close the store for <span className="font-semibold">{currentDay ? formatDate(currentDay.date) : 'today'}</span>
              </p>
            </div>

            {/* Quick summary */}
            {currentDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Net Sales</p>
                  <p className="font-semibold text-gray-900">{fc(currentDay.netSales)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="font-semibold text-gray-900">{currentDay.totalTransactions}</p>
                </div>
              </div>
            )}

            {/* Warning about open sessions */}
            {openSessions.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {openSessions.length} session(s) still open
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Close all sessions manually for accurate cash counts, or force close to suspend them.
                    </p>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={forceClose}
                        onChange={(e) => setForceClose(e.target.checked)}
                        className="rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <span className="text-sm text-yellow-800">Force close (suspend active sessions)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing Notes (optional)</label>
              <Input
                placeholder="e.g. Normal close, no issues"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
              />
            </div>

            {closeDay.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {closeDay.error instanceof Error ? closeDay.error.message : 'Failed to close store'}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCloseModal(false)}>Cancel</Button>
          <Button
            onClick={handleCloseDay}
            disabled={closeDay.isPending || (openSessions.length > 0 && !forceClose)}
          >
            {closeDay.isPending ? (
              <><ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />Closing...</>
            ) : (
              <><MoonIcon className="w-4 h-4 mr-2" />Close Store</>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cash Operation Modal */}
      <Modal
        isOpen={!!showCashOpModal}
        onClose={() => { setShowCashOpModal(null); setCashOpAmount(''); setCashOpReason(''); }}
        title={
          showCashOpModal === 'drop' ? 'Cash Drop' :
          showCashOpModal === 'payout' ? 'Cash Payout' :
          'Add Float'
        }
        size="sm"
      >
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {showCashOpModal === 'drop' && 'Remove cash from the drawer for safe deposit.'}
              {showCashOpModal === 'payout' && 'Record a cash payout from the drawer (e.g. supplier payment, petty cash).'}
              {showCashOpModal === 'float' && 'Add additional cash to the drawer.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <Input
                type="number"
                placeholder="0.00"
                value={cashOpAmount}
                onChange={(e) => setCashOpAmount(e.target.value)}
                leftIcon={<span className="text-gray-400">$</span>}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <Input
                placeholder="e.g. Safe deposit, Supplier payment"
                value={cashOpReason}
                onChange={(e) => setCashOpReason(e.target.value)}
              />
            </div>
            {addCashMovement.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {addCashMovement.error instanceof Error ? addCashMovement.error.message : 'Operation failed'}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowCashOpModal(null); setCashOpAmount(''); setCashOpReason(''); }}>
            Cancel
          </Button>
          <Button
            onClick={handleCashOp}
            disabled={addCashMovement.isPending || !cashOpAmount || parseFloat(cashOpAmount) <= 0 || !cashOpReason.trim()}
          >
            {addCashMovement.isPending ? (
              <><ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              'Confirm'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* EOD Report Modal */}
      <Modal
        isOpen={!!showEodModal}
        onClose={() => setShowEodModal(null)}
        title={showEodModal ? `EOD Report — ${formatDate(showEodModal.date)}` : ''}
        size="lg"
      >
        {showEodModal && (
          <>
            <ModalBody>
              <div className="space-y-6">
                {/* Report Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Report #{showEodModal.reportNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTime(showEodModal.openTime)} – {formatTime(showEodModal.closeTime)} &middot; {showEodModal.sessionCount} session(s)
                    </p>
                  </div>
                  {showEodModal.approved ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Approved</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>
                  )}
                </div>

                {/* Sales Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Sales Summary</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Gross Sales', value: fc(showEodModal.grossSales) },
                      { label: 'Discounts', value: `-${fc(showEodModal.totalDiscounts)}`, color: 'text-red-600' },
                      { label: 'Refunds', value: `-${fc(showEodModal.totalRefunds)}`, color: 'text-red-600' },
                      { label: 'Voids', value: `-${fc(showEodModal.totalVoids)}`, color: 'text-red-600' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={row.color ?? 'text-gray-900'}>{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                      <span>Net Sales</span>
                      <span className="text-emerald-600">{fc(showEodModal.netSales)}</span>
                    </div>
                  </div>
                </div>

                {/* GCT Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">GCT Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Taxable Amount</span>
                      <span>{fc(showEodModal.taxableAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">GCT Rate</span>
                      <span>{Math.round(Number(showEodModal.gctRate) * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-100">
                      <span>GCT Collected</span>
                      <span>{fc(showEodModal.gctCollected)}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Reconciliation */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Cash Reconciliation</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Opening Cash', value: fc(showEodModal.totalOpeningCash) },
                      { label: '+ Cash Sales', value: fc(showEodModal.totalCashSales) },
                      { label: '- Cash Refunds', value: fc(showEodModal.totalCashRefunds), color: 'text-red-600' },
                      { label: '- Payouts', value: fc(showEodModal.totalPayouts), color: 'text-red-600' },
                      { label: '- Drops', value: fc(showEodModal.totalDrops), color: 'text-red-600' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={row.color ?? 'text-gray-900'}>{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="text-gray-500">Expected Cash</span>
                      <span className="font-medium">{fc(showEodModal.expectedCash)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Actual Cash</span>
                      <span className="font-medium">{fc(showEodModal.actualCash)}</span>
                    </div>
                    <div className={cn(
                      'flex justify-between text-sm font-semibold pt-2 border-t border-gray-100',
                      showEodModal.cashStatus === 'balanced' ? 'text-emerald-600' :
                      showEodModal.cashStatus === 'over' ? 'text-blue-600' : 'text-red-600'
                    )}>
                      <span>Variance</span>
                      <span>{fc(showEodModal.cashVariance)} ({showEodModal.cashStatus})</span>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                {Object.keys(showEodModal.paymentBreakdown).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Breakdown</h3>
                    <div className="space-y-2">
                      {Object.entries(showEodModal.paymentBreakdown).map(([method, data]) => (
                        <div key={method} className="flex justify-between text-sm">
                          <span className="text-gray-500">{method.replace(/_/g, ' ')}</span>
                          <span>{fc(data.amount)} <span className="text-gray-400">({data.count} txns)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowEodModal(null)}>Close</Button>
              <Button variant="outline" onClick={() => window.print()}>
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
