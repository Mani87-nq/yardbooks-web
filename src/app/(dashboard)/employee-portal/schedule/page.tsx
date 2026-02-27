'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────
interface ScheduledShift {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
  schedule: {
    id: string;
    weekStartDate: string;
    isPublished: boolean;
  };
}

// ── Constants ────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

// ── Component ────────────────────────────────────────────────────
export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const currentSunday = useMemo(() => {
    const sunday = new Date(currentMonday);
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  }, [currentMonday]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentMonday]);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: ScheduledShift[] }>(
        `/api/employee/me/schedule?weeks=4`
      );
      setShifts(response.data);
    } catch {
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Group shifts by date for the current week
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ScheduledShift[]>();
    shifts.forEach((shift) => {
      const dateKey = shift.shiftDate.split('T')[0];
      const existing = map.get(dateKey) || [];
      existing.push(shift);
      map.set(dateKey, existing);
    });
    return map;
  }, [shifts]);

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const weekLabel = `${currentMonday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} - ${currentSunday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View your scheduled shifts
          </p>
        </div>
      </div>

      {/* Week navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-2"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="font-medium text-gray-900 dark:text-white">{weekLabel}</p>
              {weekOffset === 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400">Current Week</p>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-2"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* Schedule grid */
        <div className="space-y-3">
          {weekDays.map((day) => {
            const dateKey = day.toISOString().split('T')[0];
            const dayShifts = shiftsByDate.get(dateKey) || [];
            const today = isToday(day);

            return (
              <Card
                key={dateKey}
                className={`${
                  today ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                          today
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-xs font-medium leading-none">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="text-lg font-bold leading-none mt-0.5">
                          {day.getDate()}
                        </span>
                      </div>

                      <div>
                        <p className={`font-medium ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {DAYS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                          {today && <span className="ml-2 text-xs">(Today)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {dayShifts.length === 0 && (
                      <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                        No shift
                      </span>
                    )}
                  </div>

                  {dayShifts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                        >
                          <CalendarDaysIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {shift.startTime} - {shift.endTime}
                            </p>
                            {shift.role && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {shift.role}
                              </p>
                            )}
                            {shift.notes && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                                {shift.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Back link */}
      <div className="text-center">
        <a
          href="/employee-portal"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; Back to Employee Portal
        </a>
      </div>
    </div>
  );
}
