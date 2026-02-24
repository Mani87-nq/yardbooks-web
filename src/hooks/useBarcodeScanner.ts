'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
}

/**
 * Hook that detects barcode scanner input.
 *
 * Barcode scanners emulate keyboard input — they type characters very quickly
 * (< 50ms between keystrokes) and finish with Enter. This hook differentiates
 * scanner input from normal typing by measuring inter-keystroke timing.
 */
export function useBarcodeScanner(
  optionsOrOnScan: BarcodeScannerOptions | ((barcode: string) => void),
  enabledArg = true
): { isScanning: boolean } {
  // Support both object and positional argument styles
  const options: BarcodeScannerOptions =
    typeof optionsOrOnScan === 'function'
      ? { onScan: optionsOrOnScan, enabled: enabledArg }
      : optionsOrOnScan;

  const { onScan, enabled = true, minLength = 4 } = options;

  const [isScanning, setIsScanning] = useState(false);
  const bufferRef = useRef('');
  const lastKeystrokeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const reset = useCallback(() => {
    bufferRef.current = '';
    lastKeystrokeRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeRef.current;

      // If Enter key pressed and we have a buffer from rapid input
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength && timeSinceLastKey < 100) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(bufferRef.current);
          setIsScanning(false);
          if (scanningTimerRef.current) clearTimeout(scanningTimerRef.current);
        }
        reset();
        return;
      }

      // Only accumulate printable characters
      if (e.key.length !== 1) {
        reset();
        return;
      }

      // If too much time since last keystroke, start fresh
      if (timeSinceLastKey > 80) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
      lastKeystrokeRef.current = now;

      // Show scanning indicator when we have rapid input
      if (bufferRef.current.length >= 2 && timeSinceLastKey < 80) {
        setIsScanning(true);
        if (scanningTimerRef.current) clearTimeout(scanningTimerRef.current);
        scanningTimerRef.current = setTimeout(() => setIsScanning(false), 500);
      }

      // Auto-clear buffer after 200ms of no input (failsafe)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(reset, 200);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      reset();
      if (scanningTimerRef.current) clearTimeout(scanningTimerRef.current);
    };
  }, [enabled, minLength, reset]);

  return { isScanning };
}
