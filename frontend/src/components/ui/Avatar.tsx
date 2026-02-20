import React from 'react';
import { cn, getInitials, getStatusColor, generateAvatarGradient } from '@/lib/utils';
import type { UserStatus } from '@/lib/types';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
  onClick?: () => void;
  className?: string;
}

const sizeClasses: Record<AvatarProps['size'] & string, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const statusSizeClasses: Record<AvatarProps['size'] & string, string> = {
  sm: 'w-2.5 h-2.5 border-[1.5px]',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-2',
};

export function Avatar({
  src,
  name,
  size = 'md',
  status,
  onClick,
  className,
}: AvatarProps) {
  const safeName = name || '?';
  const initials = getInitials(safeName);

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden font-display font-bold uppercase select-none',
          sizeClasses[size],
          onClick && 'cursor-pointer transition-transform duration-150 hover:scale-105',
        )}
        style={{
          clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={safeName}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-white"
            style={{ background: generateAvatarGradient(safeName) }}
          >
            {initials}
          </div>
        )}
      </div>

      {status && status !== 'OFFLINE' && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-rally-dark-surface',
            statusSizeClasses[size],
          )}
          style={{ backgroundColor: getStatusColor(status) }}
          title={status}
        />
      )}

      {status === 'OFFLINE' && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-rally-dark-surface',
            statusSizeClasses[size],
          )}
          style={{ backgroundColor: getStatusColor(status) }}
          title={status}
        />
      )}
    </div>
  );
}
