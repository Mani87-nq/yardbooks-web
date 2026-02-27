'use client';

import { useEffect, useState, useRef } from 'react';
import type { TourPlacement } from './tours';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface TooltipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourTooltipProps {
  /** Bounding rect of the target element */
  targetRect: TooltipRect | null;
  /** Step title */
  title: string;
  /** Step content */
  content: string;
  /** Preferred placement */
  placement: TourPlacement;
  /** Current step number (1-indexed for display) */
  stepNumber: number;
  /** Total steps in the tour */
  totalSteps: number;
  /** Is this the first step? */
  isFirst: boolean;
  /** Is this the last step? */
  isLast: boolean;
  /** Callbacks */
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

const TOOLTIP_GAP = 16;
const TOOLTIP_WIDTH = 340;
const MOBILE_BREAKPOINT = 768;

export function TourTooltip({
  targetRect,
  title,
  content,
  placement,
  stepNumber,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState<TourPlacement>(placement);

  useEffect(() => {
    if (!targetRect) {
      // Center in viewport if no target
      setPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
      });
      return;
    }

    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 180;

    // On mobile, always place below
    const effectivePlacement = isMobile ? 'bottom' : placement;

    let top = 0;
    let left = 0;

    switch (effectivePlacement) {
      case 'bottom':
        top = targetRect.y + targetRect.height + TOOLTIP_GAP;
        left = targetRect.x + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'top':
        top = targetRect.y - tooltipHeight - TOOLTIP_GAP;
        left = targetRect.x + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'right':
        top = targetRect.y + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.x + targetRect.width + TOOLTIP_GAP;
        break;
      case 'left':
        top = targetRect.y + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.x - TOOLTIP_WIDTH - TOOLTIP_GAP;
        break;
    }

    // Clamp to viewport
    const padding = 12;
    left = Math.max(padding, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    // If tooltip goes off-screen on the preferred side, flip
    if (effectivePlacement === 'top' && top < padding) {
      top = targetRect.y + targetRect.height + TOOLTIP_GAP;
      setActualPlacement('bottom');
    } else if (effectivePlacement === 'bottom' && top + tooltipHeight > window.innerHeight - padding) {
      top = targetRect.y - tooltipHeight - TOOLTIP_GAP;
      setActualPlacement('top');
    } else {
      setActualPlacement(effectivePlacement);
    }

    setPosition({ top, left });
  }, [targetRect, placement]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl dark:shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <h3 className="text-base font-bold text-gray-900 dark:text-white pr-4 leading-snug">
            {title}
          </h3>
          <button
            onClick={onSkip}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Skip tour"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {content}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700/50">
          {/* Step counter */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === stepNumber - 1
                    ? 'w-4 bg-emerald-500 dark:bg-emerald-400'
                    : i < stepNumber - 1
                      ? 'w-1.5 bg-emerald-300 dark:bg-emerald-600'
                      : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
            <span className="ml-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {stepNumber}/{totalSteps}
            </span>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeftIcon className="h-3 w-3" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onComplete}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Next
                <ChevronRightIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Arrow pointer */}
      {targetRect && actualPlacement === 'bottom' && (
        <div
          className="absolute -top-2 w-4 h-4 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 rotate-45"
          style={{
            left: Math.min(
              Math.max(20, (targetRect.x + targetRect.width / 2) - position.left),
              TOOLTIP_WIDTH - 20
            ),
          }}
        />
      )}
      {targetRect && actualPlacement === 'top' && (
        <div
          className="absolute -bottom-2 w-4 h-4 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 rotate-45"
          style={{
            left: Math.min(
              Math.max(20, (targetRect.x + targetRect.width / 2) - position.left),
              TOOLTIP_WIDTH - 20
            ),
          }}
        />
      )}
    </div>
  );
}
