import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  placement?: Placement;
  className?: string;
}

export function Popover({ trigger, children, placement = 'bottom', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + 6;
        left = rect.left + rect.width / 2;
        break;
      case 'top':
        top = rect.top - 6;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 6;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 6;
        break;
    }

    // Collision: keep inside viewport
    if (left < 8) left = 8;
    if (left > vw - 8) left = vw - 8;
    if (top < 8) top = 8;
    if (top > vh - 8) top = vh - 8;

    setCoords({ top, left });
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const originMap: Record<Placement, string> = {
    bottom: 'top center',
    top: 'bottom center',
    left: 'center right',
    right: 'center left',
  };

  const translateMap: Record<Placement, string> = {
    bottom: '-50%, 0',
    top: '-50%, -100%',
    left: '-100%, -50%',
    right: '0, -50%',
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onClick={() => setOpen((p) => !p)}
      >
        {trigger}
      </div>

      {ReactDOM.createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              className={cn(
                'fixed z-[80] border border-rally-blue/20 bg-rally-dark-surface rounded-md shadow-elevation-3 overflow-hidden',
                className,
              )}
              style={{
                top: coords.top,
                left: coords.left,
                transform: `translate(${translateMap[placement]})`,
                transformOrigin: originMap[placement],
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
