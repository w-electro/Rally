import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const sizeClasses: Record<string, string> = {
  sm: 'h-[30px] text-xs px-2.5',
  md: 'h-[38px] text-sm px-3',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, size = 'md', className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rally-text-muted pointer-events-none">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-sm bg-rally-dark-surface/80 text-rally-text font-body',
              'border outline-none transition-all duration-[170ms] ease-out',
              'placeholder:text-rally-text-muted/50',
              error
                ? 'border-rally-magenta/50 focus:border-rally-magenta focus:shadow-neon-magenta'
                : 'border-rally-blue/15 focus:border-rally-blue focus:shadow-[0_0_10px_rgba(0,217,255,0.15)]',
              sizeClasses[size],
              icon && 'pl-9',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-rally-magenta" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-rally-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
