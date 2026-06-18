/**
 * Stardust Ticket — Brand Identity
 *
 * Mark concept: ticket stub
 *   • Outer rounded rect = ticket body
 *   • Right-side semicircle notch = tear/perforation point
 *   • Inner rounded rect = the stub face / content area
 *
 * All geometry uses currentColor so the mark inherits
 * whatever color the parent sets (dark or light context).
 *
 * Usage:
 *   <StardustMark size={24} />
 *   <StardustWordmark size="md" />
 *   <StardustLogo layout="horizontal" />   ← sidebar
 *   <StardustLogo layout="stacked" />      ← login / splash
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────
// StardustMark
// ─────────────────────────────────────────────────────────────

interface MarkProps {
  /** Rendered height in px — width scales proportionally (≈ 0.86:1) */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function StardustMark({
  size = 24,
  className,
  style,
  'aria-hidden': ariaHidden,
}: MarkProps) {
  /**
   * Canonical viewBox: 52 × 60
   * Outer rect  : x=1, y=1, w=40, h=58, rx=7.5
   * Notch       : semicircle at right edge, cy=30, r=10
   * Inner rect  : x=7, y=11, w=26, h=38, rx=5
   *
   * The notch is drawn as a filled path that matches the parent
   * background color — rendered as a "bite" out of the ticket edge.
   * We use a clip-path approach instead so the mark works on any bg.
   */
  const W = 52;
  const H = 60;

  // Notch: semicircle on right edge
  // Arc from (40.5, 20) clockwise to (40.5, 40), r=10
  // Rendered as a "cutout" via clipPath
  const notchCY = 30;
  const notchR = 10;
  const notchX = 41; // right edge of outer rect

  return (
    <svg
      width={size * (W / H)}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
    >
      <defs>
        <clipPath id="sd-ticket-clip">
          {/* Outer shape minus the notch semicircle */}
          <path
            d={[
              // Start at top-left corner (after rx)
              `M 8.5 1`,
              // Top edge
              `H 41`,
              // Top-right corner
              `Q 41 1 41 8.5`,
              // Right side down to notch top
              `V ${notchCY - notchR}`,
              // Notch: concave semicircle (arc sweeps LEFT = bite into rect)
              `A ${notchR} ${notchR} 0 0 0 41 ${notchCY + notchR}`,
              // Right side from notch bottom to bottom-right corner
              `V 51.5`,
              // Bottom-right corner
              `Q 41 59 33.5 59`,
              // Bottom edge
              `H 8.5`,
              // Bottom-left corner
              `Q 1 59 1 51.5`,
              // Left side
              `V 8.5`,
              // Top-left corner
              `Q 1 1 8.5 1`,
              `Z`,
            ].join(' ')}
          />
        </clipPath>
      </defs>

      {/* Outer ticket body */}
      <rect
        x="1" y="1"
        width="40" height="58"
        rx="7.5"
        fill="currentColor"
        opacity="1"
      />

      {/* Notch cutout — transparent circle punched into the right edge */}
      <circle
        cx={notchX}
        cy={notchCY}
        r={notchR}
        fill="transparent"
        style={{ mixBlendMode: 'destination-out' }}
      />

      {/* Inner stub face */}
      <rect
        x="7" y="11"
        width="26" height="38"
        rx="5"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="0"
      />

      {/*
        Since CSS mix-blend-mode for SVG cutouts is unreliable across renderers,
        we use a single compound path approach instead.
        The outer fill paints the ticket; the inner "window" is transparent.
      */}
    </svg>
  );
}

/**
 * Refined single-path implementation that works reliably at all sizes,
 * including 16px favicon rasterization. Uses evenodd fill rule for the
 * notch cutout — no blend modes required.
 */
export function StardustMarkClean({
  size = 24,
  className,
  style,
  'aria-hidden': ariaHidden,
}: MarkProps) {
  const W = 52;
  const H = 60;

  // Outer rect corners (rx=7.5)
  // Inner rect corners (rx=5) — the "stub face" as a hole
  // Notch: semicircle bite from right edge at mid-height

  return (
    <svg
      width={size * (W / H)}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : 'img'}
    >
      {!ariaHidden && <title>Stardust Ticket</title>}
      {/*
        Outer body: rounded rect with notch bite on right side.
        Drawn as a single path using evenodd, combining:
          1. Outer rounded rectangle (clockwise)
          2. Notch semicircle on right edge (clockwise = subtract with evenodd)
          3. Inner rounded rectangle window (clockwise = subtract with evenodd)
      */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d={[
          // ── Outer rounded rect (CW) ──────────────────────────────
          'M 8.5 1',
          'H 33.5',
          'Q 41 1 41 8.5',
          'V 20',             // down to notch top
          // Notch: concave arc — goes LEFT (inward), so it subtracts
          'A 10 10 0 0 0 41 40',
          'V 51.5',
          'Q 41 59 33.5 59',
          'H 8.5',
          'Q 1 59 1 51.5',
          'V 8.5',
          'Q 1 1 8.5 1',
          'Z',

          // ── Inner window rect (CW → subtracts under evenodd) ─────
          'M 7 16',
          'Q 7 11 12 11',
          'H 27',
          'Q 33 11 33 16',
          'V 44',
          'Q 33 49 28 49',
          'H 12',
          'Q 7 49 7 44',
          'Z',
        ].join(' ')}
      />
    </svg>
  );
}

// Export the clean version as the default mark
export { StardustMarkClean as StardustMark_ };

// ─────────────────────────────────────────────────────────────
// The actual production mark — simplified, pixel-perfect
// ─────────────────────────────────────────────────────────────

/**
 * Production mark. Single compound path, evenodd, no tricks.
 * Outer = ticket stub with right-side notch
 * Inner = transparent window (letterbox / stub face)
 *
 * At 16px → reads as a clear geometric shape
 * At 512px → all proportions and radii visible
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
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d={
          // Outer ticket body with right-side notch
          'M8.5 1 H33.5 Q41 1 41 8.5 V20 A10 10 0 0 0 41 40 V51.5 Q41 59 33.5 59 H8.5 Q1 59 1 51.5 V8.5 Q1 1 8.5 1 Z ' +
          // Inner window (evenodd subtracts this)
          'M7 16 Q7 11 12 11 H27 Q33 11 33 16 V44 Q33 49 28 49 H12 Q7 49 7 44 Z'
        }
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// StardustWordmark
// ─────────────────────────────────────────────────────────────

type WordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
  style?: React.CSSProperties;
}

const WORDMARK_SCALE: Record<WordmarkSize, { primary: number; secondary: number; gap: number }> = {
  xs:  { primary: 10, secondary: 7,  gap: 1.5 },
  sm:  { primary: 13, secondary: 9,  gap: 2   },
  md:  { primary: 16, secondary: 10, gap: 2.5 },
  lg:  { primary: 20, secondary: 12, gap: 3   },
  xl:  { primary: 28, secondary: 15, gap: 4   },
};

export function StardustWordmark({ size = 'sm', className, style }: WordmarkProps) {
  const scale = WORDMARK_SCALE[size];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: scale.gap,
        ...style,
      }}
    >
      <span
        style={{
          fontSize: scale.primary,
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          color: 'currentColor',
          lineHeight: 1,
          fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)',
        }}
      >
        STARDUST
      </span>
      <span
        style={{
          fontSize: scale.secondary,
          fontWeight: 300,
          letterSpacing: '0.24em',
          textTransform: 'uppercase' as const,
          color: 'currentColor',
          opacity: 0.4,
          lineHeight: 1,
          fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)',
        }}
      >
        Ticket
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StardustLogo — combined lockup
// ─────────────────────────────────────────────────────────────

interface LogoProps {
  /** horizontal: mark left + wordmark right (sidebar) */
  layout?: 'horizontal' | 'stacked';
  /** Controls mark size — wordmark scales accordingly */
  size?: WordmarkSize;
  className?: string;
  style?: React.CSSProperties;
}

const LAYOUT_MARK_SIZE: Record<WordmarkSize, number> = {
  xs: 16,
  sm: 22,
  md: 32,
  lg: 44,
  xl: 60,
};

export function StardustLogo({
  layout = 'horizontal',
  size = 'sm',
  className,
  style,
}: LogoProps) {
  const markSize = LAYOUT_MARK_SIZE[size];

  if (layout === 'stacked') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 14,
          ...style,
        }}
      >
        <StardustTicketMark size={markSize} aria-hidden="true" />
        <StardustWordmark size={size} />
      </div>
    );
  }

  // horizontal
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'xs' ? 6 : size === 'sm' ? 8 : 10,
        ...style,
      }}
    >
      <StardustTicketMark size={markSize} aria-hidden="true" />
      <StardustWordmark size={size} />
    </div>
  );
}
