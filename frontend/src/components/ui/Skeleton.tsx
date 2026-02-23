import React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        'skeleton-shimmer',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-3 rounded-sm',
        variant === 'rect' && 'rounded-md',
        className,
      )}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// MessageSkeleton — matches real message layout
// ---------------------------------------------------------------------------

const TEXT_WIDTHS = [
  ['60%', '80%'],
  ['75%', '45%', '55%'],
  ['40%', '70%'],
  ['85%', '50%'],
  ['65%', '40%', '70%'],
  ['50%', '80%'],
];

export function MessageSkeleton({ index = 0 }: { index?: number }) {
  const widths = TEXT_WIDTHS[index % TEXT_WIDTHS.length];

  return (
    <div className="flex gap-3 px-4 py-2">
      {/* Avatar */}
      <Skeleton variant="circle" width={40} height={40} className="shrink-0" />

      {/* Content */}
      <div className="flex-1 space-y-2 py-1">
        {/* Name + timestamp row */}
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={`${80 + (index % 3) * 30}px`} className="h-3.5" />
          <Skeleton variant="text" width="50px" className="h-2.5" />
        </div>

        {/* Text lines */}
        {widths.map((w, i) => (
          <Skeleton key={i} variant="text" width={w} className="h-3" />
        ))}
      </div>
    </div>
  );
}

/** Renders a full page of message skeletons */
export function MessageListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="flex flex-col py-2">
      {Array.from({ length: count }, (_, i) => (
        <MessageSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChannelListSkeleton
// ---------------------------------------------------------------------------

export function ChannelListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2 py-2">
      {/* Category header skeleton */}
      <Skeleton variant="text" width="40%" className="h-2.5 mb-2 mx-1" />

      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded">
          <Skeleton variant="rect" width={16} height={16} className="shrink-0 rounded-sm" />
          <Skeleton
            variant="text"
            width={`${40 + ((i * 17) % 40)}%`}
            className="h-3"
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberListSkeleton
// ---------------------------------------------------------------------------

export function MemberListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-0.5 px-2 py-2">
      {/* Section header */}
      <Skeleton variant="text" width="60px" className="h-2 mb-2 mx-2" />

      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton variant="circle" width={32} height={32} className="shrink-0" />
          <Skeleton
            variant="text"
            width={`${50 + ((i * 13) % 30)}%`}
            className="h-3"
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServerCardSkeleton — for Dashboard grid
// ---------------------------------------------------------------------------

export function ServerCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/5 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1 space-y-1.5">
          <Skeleton variant="text" width="60%" className="h-3.5" />
          <Skeleton variant="text" width="35%" className="h-2.5" />
        </div>
      </div>
      <Skeleton variant="rect" width="100%" height={4} className="rounded-full" />
    </div>
  );
}
