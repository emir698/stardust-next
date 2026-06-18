/**
 * Stardust Ticket — Brand Identity
 *
 * Mark: ticket stub — outer rounded rect with right-side semicircle notch,
 * inner transparent window. Single compound path, evenodd fill rule.
 * No blend modes. Works at 16px favicon → 512px app icon.
 *
 * Usage:
 *   <StardustTicketMark size={24} />
 *   <StardustWordmark size="sm" />
 *   <StardustLogo layout="horizontal" />   ← sidebar
 *   <StardustLogo layout="stacked" />      ← login / splash
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface MarkProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
}

type WordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// ─────────────────────────────────────────────────────────────
// StardustTicketMark
// ─────────────────────────────────────────────────────────────

/**
 * The Stardust mark: a ticket stub silhouette.
 *
 * Compound path with evenodd fill rule:
 *   1. Outer ticket body (rounded rect, with right-side notch arc)
 *   2. Inner window rect (subtracts under evenodd — creates the "face")
 *
 * currentColor — inherits from parent. Zero hardcoded colors.
 */
export function StardustTicketMark({
  size = 24,
  className,
  style,
  'aria-hidden': ariaHidden,
}: MarkProps) {
  const ratio = 52 / 60;

  return (
    <svg
      width={Math.round(size * ratio)}
      height={size}
      viewBox="0 0 52 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role={ariaHidden ? undefined : 'img'}
      aria-hidden={ariaHidden}
    >
      {!ariaHidden && <title>Stardust</title>}
      {/*
        Outer body: rounded rect, right edge has a concave semicircle notch.
        Path goes clockwise. The inner window goes clockwise too — evenodd
        subtracts it, leaving the frame visible and the center transparent.

        Outer body (CW):
          Top-left corner → top edge → top-right corner
          → right side down to notch top
          → notch: concave arc (sweep-flag=0 = counterclockwise arc →
            the path curves INTO the body, creating the bite)
          → right side from notch bottom → bottom-right corner
          → bottom edge → bottom-left corner → left side → close

        Inner window (CW → evenodd subtracts):
          Simple rounded rect
      */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d={
          // Outer ticket body with right-side notch
          'M8.5 1 H33.5 Q41 1 41 8.5 V20 A10 10 0 0 0 41 40 V51.5 Q41 59 33.5 59 H8.5 Q1 59 1 51.5 V8.5 Q1 1 8.5 1 Z ' +
          // Inner window (evenodd subtracts)
          'M7 16 Q7 11 12 11 H27 Q33 11 33 16 V44 Q33 49 28 49 H12 Q7 49 7 44 Z'
        }
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// StardustWordmark
// ─────────────────────────────────────────────────────────────

const SCALE: Record<WordmarkSize, { primary: number; secondary: number; gap: number }> = {
  xs: { primary: 10, secondary: 7,  gap: 1.5 },
  sm: { primary: 13, secondary: 9,  gap: 2   },
  md: { primary: 16, secondary: 10, gap: 2.5 },
  lg: { primary: 20, secondary: 12, gap: 3   },
  xl: { primary: 28, secondary: 15, gap: 4   },
};

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
  style?: React.CSSProperties;
}

export function StardustWordmark({ size = 'sm', className, style }: WordmarkProps) {
  const s = SCALE[size];
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: s.gap, ...style }}
    >
      <span style={{
        fontSize: s.primary,
        fontWeight: 600,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'currentColor',
        lineHeight: 1,
        fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)',
      }}>
        STARDUST
      </span>
      <span style={{
        fontSize: s.secondary,
        fontWeight: 300,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: 'currentColor',
        opacity: 0.4,
        lineHeight: 1,
        fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)',
      }}>
        Ticket
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StardustLogo — combined lockup
// ─────────────────────────────────────────────────────────────

const MARK_SIZE: Record<WordmarkSize, number> = {
  xs: 16, sm: 22, md: 32, lg: 44, xl: 60,
};

interface LogoProps {
  layout?: 'horizontal' | 'stacked';
  size?: WordmarkSize;
  className?: string;
  style?: React.CSSProperties;
}

export function StardustLogo({ layout = 'horizontal', size = 'sm', className, style }: LogoProps) {
  const markSize = MARK_SIZE[size];
  const gap = size === 'xs' ? 6 : size === 'sm' ? 8 : 10;

  if (layout === 'stacked') {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, ...style }}>
        <StardustTicketMark size={markSize} aria-hidden="true" />
        <StardustWordmark size={size} />
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap, ...style }}>
      <StardustTicketMark size={markSize} aria-hidden="true" />
      <StardustWordmark size={size} />
    </div>
  );
}
