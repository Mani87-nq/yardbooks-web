/**
 * Terminal ID assignment utility.
 * Persists the assigned terminal ID in localStorage so each device
 * remembers which POS terminal it's assigned to.
 */

const STORAGE_KEY = 'yaadbooks-terminal-id';

/**
 * Get the terminal ID assigned to this device.
 */
export function getAssignedTerminalId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Assign a terminal ID to this device.
 */
export function setAssignedTerminalId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (e.g., private mode)
  }
}

/**
 * Clear the terminal assignment for this device.
 */
export function clearAssignedTerminalId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
