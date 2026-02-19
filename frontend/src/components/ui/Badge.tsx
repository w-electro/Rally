import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default:
    'bg-rally-blue/10 border-rally-blue/30 text-rally-blue shadow-[0_0_8px_rgba(0,217,255,0.15)]',
  success:
    'bg-rally-green/10 border-rally-green/30 text-rally-green shadow-[0_0_8px_rgba(57,255,20,0.15)]',
  danger:
    'bg-rally-magenta/10 border-rally-magenta/30 text-rally-magenta shadow-[0_0_8px_rgba(255,0,110,0.15)]',
  warning:
    'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.15)]',
  purple:
    'bg-rally-purple/10 border-rally-purple/30 text-rally-purple shadow-[0_0_8px_rgba(139,0,255,0.15)]',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border font-display font-semibold uppercase tracking-wider clip-angular-sm',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
