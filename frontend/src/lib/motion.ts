import { useEffect, useState } from 'react';
import type { Variants, Transition } from 'framer-motion';

// ---------------------------------------------------------------------------
// Duration tokens (seconds) — use these instead of hardcoding
// ---------------------------------------------------------------------------

export const duration = {
  fast: 0.1,
  normal: 0.15,
  slow: 0.2,
  slower: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Easing curves
// ---------------------------------------------------------------------------

export const easing = {
  /** Slight overshoot — modals, popovers */
  spring: [0.175, 0.885, 0.32, 1.275] as const,
  /** Material-style smooth decel */
  smooth: [0.4, 0, 0.2, 1] as const,
  /** Quick exit feel */
  easeOut: [0, 0, 0.2, 1] as const,
};

// ---------------------------------------------------------------------------
// Reusable framer-motion variants
// ---------------------------------------------------------------------------

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.slow } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: duration.slow, ease: easing.smooth } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: duration.normal } },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -4 },
  animate: { opacity: 1, x: 0, transition: { duration: duration.normal, ease: easing.smooth } },
  exit: { opacity: 0, x: -4, transition: { duration: duration.fast } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: duration.normal, ease: easing.smooth } },
  exit: { opacity: 0, x: 16, transition: { duration: duration.fast } },
};

/** New messages sliding up into view */
export const messageAppear: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: easing.easeOut },
  },
};

/** Channel switch: fast fade for the whole message list */
export const channelTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.normal } },
  exit: { opacity: 0, transition: { duration: 0.05 } },
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.slow } },
  exit: { opacity: 0, transition: { duration: duration.normal } },
};

export const modalPanel: Variants = {
  initial: { opacity: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.slower, ease: easing.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    transition: { duration: duration.normal, ease: easing.smooth },
  },
};

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export const contextMenuVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.fast, ease: easing.easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.075 },
  },
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export const tooltipVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: 0.05 } },
};

// ---------------------------------------------------------------------------
// Reaction animations (imperative — use with animate())
// ---------------------------------------------------------------------------

/** For a brand-new reaction chip appearing */
export const reactionAppear: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 15,
};

/** For clicking an existing reaction (pulse) */
export const reactionPulse = {
  scale: [1, 1.15, 1],
  transition: { duration: duration.normal },
};

// ---------------------------------------------------------------------------
// Reduced motion hook
// ---------------------------------------------------------------------------

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
