import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className={cn(
          'relative z-10 w-full mx-4 animate-scale-in',
          sizeClasses[size],
        )}
      >
        <div
          className="relative border border-rally-blue/20 bg-rally-dark-surface overflow-hidden"
          style={{
            clipPath:
              'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
          }}
        >
          {/* Top neon edge accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-rally-border/50">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-rally-text">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 text-rally-text-muted hover:text-rally-magenta transition-colors duration-150"
              aria-label="Close modal"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">{children}</div>

          {/* Bottom neon edge accent */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rally-blue/40 to-transparent" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
