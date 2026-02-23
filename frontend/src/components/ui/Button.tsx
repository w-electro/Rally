import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'angular';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const variantClasses: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-rally-blue to-rally-green text-black font-semibold hover:shadow-neon-blue',
  secondary:
    'bg-white/5 border border-white/10 text-rally-text hover:bg-white/10 hover:border-white/20',
  danger:
    'bg-rally-magenta/10 border border-rally-magenta/30 text-rally-magenta hover:bg-rally-magenta/20 hover:border-rally-magenta/50',
  ghost:
    'bg-transparent text-rally-text-muted hover:bg-white/5 hover:text-rally-text',
  angular:
    'bg-gradient-to-r from-rally-blue/10 to-rally-green/10 border border-rally-blue/30 text-rally-blue font-display font-semibold uppercase tracking-wider hover:from-rally-blue/20 hover:to-rally-green/20 hover:border-rally-blue hover:shadow-neon-blue',
};

const sizeClasses: Record<string, string> = {
  sm: 'h-[30px] px-3 text-xs gap-1.5',
  md: 'h-[38px] px-4 text-sm gap-2',
  lg: 'h-[44px] px-5 text-sm gap-2',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm font-body',
        'transition-all duration-[170ms] ease-out',
        'focus-visible:outline-2 focus-visible:outline-rally-blue focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        variant === 'angular' && 'clip-angular',
        isDisabled && 'opacity-50 pointer-events-none',
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}

      {children && <span>{children}</span>}
    </button>
  );
}
