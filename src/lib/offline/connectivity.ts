/**
 * Connectivity detection and management for offline-first POS.
 *
 * Three states:
 * - ONLINE: Full connectivity, all features available
 * - DEGRADED: Slow/intermittent connection, some features limited
 * - OFFLINE: No connectivity, cash-only mode
 *
 * Uses navigator.onLine + heartbeat ping for accurate detection.
 * navigator.onLine alone is unreliable (reports true on captive portals).
 */

export type ConnectivityStatus = 'online' | 'degraded' | 'offline';

interface ConnectivityState {
  status: ConnectivityStatus;
  lastOnlineAt: number | null;
  lastCheckedAt: number;
  latencyMs: number | null;
  pendingSyncCount: number;
}

type ConnectivityListener = (state: ConnectivityState) => void;

const HEARTBEAT_URL = '/api/health';
const HEARTBEAT_INTERVAL_ONLINE = 30_000;    // 30s when online
const HEARTBEAT_INTERVAL_OFFLINE = 10_000;   // 10s when offline (check more often)
const DEGRADED_THRESHOLD_MS = 3_000;         // >3s latency = degraded
const HEARTBEAT_TIMEOUT_MS = 5_000;          // 5s timeout = offline

class ConnectivityManager {
  private state: ConnectivityState = {
    status: 'online',
    lastOnlineAt: Date.now(),
    lastCheckedAt: Date.now(),
    latencyMs: null,
    pendingSyncCount: 0,
  };

  private listeners = new Set<ConnectivityListener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Start monitoring connectivity.
   * Call once when the app initializes.
   */
  start(): void {
    if (this.isRunning || typeof window === 'undefined') return;
    this.isRunning = true;

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleBrowserOnline);
    window.addEventListener('offline', this.handleBrowserOffline);

    // Initial check
    this.checkConnectivity();

    // Start heartbeat
    this.scheduleHeartbeat();
  }

  /**
   * Stop monitoring.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Subscribe to connectivity changes.
   */
  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current connectivity state.
   */
  getState(): ConnectivityState {
    return { ...this.state };
  }

  /**
   * Force an immediate connectivity check.
   */
  async forceCheck(): Promise<ConnectivityState> {
    await this.checkConnectivity();
    return this.getState();
  }

  /**
   * Update the pending sync count (shown in UI).
   */
  setPendingSyncCount(count: number): void {
    if (this.state.pendingSyncCount !== count) {
      this.state = { ...this.state, pendingSyncCount: count };
      this.notifyListeners();
    }
  }

  // ─── Private Methods ──────────────────────────────────────────

  private handleBrowserOnline = (): void => {
    // Browser says we're online — verify with heartbeat
    this.checkConnectivity();
  };

  private handleBrowserOffline = (): void => {
    this.updateState('offline', null);
  };

  private scheduleHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    const interval = this.state.status === 'offline'
      ? HEARTBEAT_INTERVAL_OFFLINE
      : HEARTBEAT_INTERVAL_ONLINE;

    this.heartbeatTimer = setInterval(() => {
      this.checkConnectivity();
    }, interval);
  }

  private async checkConnectivity(): Promise<void> {
    // If browser says offline, trust it
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('offline', null);
      return;
    }

    // Ping the health endpoint
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);

      const response = await fetch(HEARTBEAT_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const latency = Math.round(performance.now() - start);

      if (response.ok) {
        if (latency > DEGRADED_THRESHOLD_MS) {
          this.updateState('degraded', latency);
        } else {
          this.updateState('online', latency);
        }
      } else {
        this.updateState('degraded', latency);
      }
    } catch {
      this.updateState('offline', null);
    }
  }

  private updateState(status: ConnectivityStatus, latencyMs: number | null): void {
    const prevStatus = this.state.status;
    const now = Date.now();

    this.state = {
      ...this.state,
      status,
      lastCheckedAt: now,
      latencyMs,
      lastOnlineAt: status !== 'offline' ? now : this.state.lastOnlineAt,
    };

    // Reschedule heartbeat if status changed
    if (prevStatus !== status) {
      this.scheduleHeartbeat();
    }

    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[Connectivity] Listener error:', err);
      }
    }
  }
}

// Singleton instance
export const connectivity = new ConnectivityManager();

// ─── React Hook ─────────────────────────────────────────────────

import { useState, useEffect } from 'react';

/**
 * React hook for connectivity state.
 *
 * @example
 * const { status, lastOnlineAt, pendingSyncCount } = useConnectivity();
 * if (status === 'offline') showOfflineBanner();
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(connectivity.getState());

  useEffect(() => {
    connectivity.start();
    const unsubscribe = connectivity.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}
