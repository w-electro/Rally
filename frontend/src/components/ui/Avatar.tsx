import { cn, getAvatarUrl, getInitials, generateColor } from '@/lib/utils';
import type { User } from '@/lib/types';

interface AvatarProps {
  user?: Pick<User, 'id' | 'username' | 'avatar' | 'status'> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-2 h-2 border', statusOffset: '-bottom-0 -right-0' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2.5 h-2.5 border-[1.5px]', statusOffset: '-bottom-0 -right-0' },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-3 h-3 border-2', statusOffset: '-bottom-0.5 -right-0.5' },
  lg: { container: 'w-16 h-16', text: 'text-xl', status: 'w-4 h-4 border-2', statusOffset: '-bottom-0.5 -right-0.5' },
  xl: { container: 'w-20 h-20', text: 'text-2xl', status: 'w-5 h-5 border-[3px]', statusOffset: '-bottom-1 -right-1' },
};

const statusColors: Record<string, string> = {
  online: 'bg-rally-green',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export default function Avatar({
  user,
  size = 'md',
  showStatus = false,
  className,
  onClick,
}: AvatarProps) {
  const config = sizeMap[size];
  const avatarUrl = user ? getAvatarUrl(user.avatar) : null;
  const initials = user ? getInitials(user.username) : '?';
  const bgColor = user ? generateColor(user.id) : '#4B5563';

  return (
    <div
      className={cn('relative flex-shrink-0', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user?.username || 'Avatar'}
          className={cn(
            'rounded-full object-cover',
            config.container
          )}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold text-white select-none',
            config.container,
            config.text
          )}
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </div>
      )}
      {showStatus && user?.status && (
        <span
          className={cn(
            'absolute rounded-full border-rally-darkBg',
            config.status,
            config.statusOffset,
            statusColors[user.status] || statusColors.offline
          )}
        />
      )}
    </div>
  );
}
