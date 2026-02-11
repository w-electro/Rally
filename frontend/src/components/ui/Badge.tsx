import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'cyan' | 'role';
  size?: 'sm' | 'md';
  color?: string;
  className?: string;
}

const variantClasses = {
  default: 'bg-rally-cardBg text-rally-muted border border-primary',
  primary: 'bg-rally-purple/20 text-rally-purple border border-rally-purple/30',
  success: 'bg-rally-green/20 text-rally-green border border-rally-green/30',
  danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  cyan: 'bg-rally-cyan/20 text-rally-cyan border border-rally-cyan/30',
  role: '',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  color,
  className,
}: BadgeProps) {
  const roleStyle = variant === 'role' && color
    ? {
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}50`,
      }
    : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        variantClasses[variant],
        variant === 'role' && 'border',
        sizeClasses[size],
        className
      )}
      style={roleStyle}
    >
      {children}
    </span>
  );
}

export function NotificationBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center',
        'rounded-full bg-red-500 text-white text-[10px] font-bold px-1',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
