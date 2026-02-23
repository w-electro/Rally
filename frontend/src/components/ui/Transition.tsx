import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import {
  fadeIn,
  scaleIn,
  slideInLeft,
  slideInRight,
  duration,
  easing,
} from '@/lib/motion';

// Re-export AnimatePresence for convenience
export { AnimatePresence };

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

interface TransitionProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// FadeTransition
// ---------------------------------------------------------------------------

export function FadeTransition({ children, ...props }: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeIn}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ScaleTransition — modals, popovers
// ---------------------------------------------------------------------------

export function ScaleTransition({ children, ...props }: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={scaleIn}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SlideTransition — sidebars, panels
// ---------------------------------------------------------------------------

export function SlideTransition({
  children,
  direction = 'left',
  ...props
}: TransitionProps & { direction?: 'left' | 'right' }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={direction === 'left' ? slideInLeft : slideInRight}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ChannelTransition — wraps chat content, keyed on channel id
// ---------------------------------------------------------------------------

export function ChannelTransition({
  children,
  channelId,
  className,
}: {
  children: React.ReactNode;
  channelId: string;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={channelId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: duration.normal } }}
        exit={{ opacity: 0, transition: { duration: 0.05 } }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
