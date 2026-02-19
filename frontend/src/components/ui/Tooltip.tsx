import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses: Record<string, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-rally-surface-light border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-rally-surface-light border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-rally-surface-light border-y-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-rally-surface-light border-y-transparent border-l-transparent',
};

export function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}

      {visible && (
        <div
          className={cn(
            'absolute z-50 pointer-events-none whitespace-nowrap animate-fade-in',
            positionClasses[position],
          )}
        >
          <div className="relative px-2.5 py-1.5 text-xs font-body text-rally-text bg-rally-surface-light border border-rally-blue/20 shadow-neon-blue rounded-sm">
            {content}
            <span
              className={cn(
                'absolute w-0 h-0 border-4',
                arrowClasses[position],
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
