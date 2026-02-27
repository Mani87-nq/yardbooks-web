'use client';

import { useEffect, useState } from 'react';

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourSpotlightProps {
  /** Bounding rect of the target element (viewport-relative) */
  targetRect: SpotlightRect | null;
  /** Whether this step should have a glowing highlight */
  highlight?: boolean;
  /** Click handler for the backdrop (typically to dismiss) */
  onBackdropClick?: () => void;
}

const PADDING = 8;
const BORDER_RADIUS = 10;

export function TourSpotlight({ targetRect, highlight, onBackdropClick }: TourSpotlightProps) {
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (windowSize.w === 0) return null;

  const { w, h } = windowSize;

  // If no target, show full overlay
  if (!targetRect) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/60 dark:bg-black/75 transition-opacity duration-300"
        onClick={onBackdropClick}
      />
    );
  }

  // Calculate cutout dimensions with padding
  const cx = targetRect.x - PADDING;
  const cy = targetRect.y - PADDING;
  const cw = targetRect.width + PADDING * 2;
  const ch = targetRect.height + PADDING * 2;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg
        width={w}
        height={h}
        className="absolute inset-0"
        style={{ pointerEvents: 'auto' }}
        onClick={onBackdropClick}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White = visible (dark overlay), Black = transparent (cutout) */}
            <rect x={0} y={0} width={w} height={h} fill="white" />
            <rect
              x={cx}
              y={cy}
              width={cw}
              height={ch}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="black"
              className="transition-all duration-300 ease-out"
            />
          </mask>
        </defs>

        {/* Dark overlay with cutout */}
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          className="fill-black/60 dark:fill-black/75"
          mask="url(#tour-spotlight-mask)"
        />

        {/* Spotlight border ring */}
        <rect
          x={cx}
          y={cy}
          width={cw}
          height={ch}
          rx={BORDER_RADIUS}
          ry={BORDER_RADIUS}
          fill="none"
          stroke={highlight ? '#10b981' : '#d1d5db'}
          strokeWidth={highlight ? 2.5 : 1.5}
          className="transition-all duration-300 ease-out"
          style={{ pointerEvents: 'none' }}
        />

        {/* Optional glow effect for highlighted steps */}
        {highlight && (
          <rect
            x={cx - 4}
            y={cy - 4}
            width={cw + 8}
            height={ch + 8}
            rx={BORDER_RADIUS + 4}
            ry={BORDER_RADIUS + 4}
            fill="none"
            stroke="#10b981"
            strokeWidth={1}
            opacity={0.4}
            className="transition-all duration-300 ease-out"
            style={{ pointerEvents: 'none' }}
          >
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* Transparent clickable area over the target (allows clicking through to the target) */}
      <div
        className="absolute"
        style={{
          left: cx,
          top: cy,
          width: cw,
          height: ch,
          borderRadius: BORDER_RADIUS,
          pointerEvents: 'auto',
          zIndex: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
