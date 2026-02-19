import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { Story } from '@/lib/types';
import { cn, getInitials } from '@/lib/utils';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryBarProps {
  stories: Story[];
  onViewStory: (story: Story) => void;
  onAddStory: () => void;
}

interface GroupedStory {
  authorId: string;
  author: Story['author'];
  stories: Story[];
  hasUnviewed: boolean;
}

export function StoryBar({ stories, onViewStory, onAddStory }: StoryBarProps) {
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Group stories by author
  const grouped: GroupedStory[] = [];
  const authorMap = new Map<string, GroupedStory>();

  for (const story of stories) {
    const existing = authorMap.get(story.authorId);
    if (existing) {
      existing.stories.push(story);
    } else {
      const group: GroupedStory = {
        authorId: story.authorId,
        author: story.author,
        stories: [story],
        hasUnviewed: true, // Would be determined by viewed state
      };
      authorMap.set(story.authorId, group);
      grouped.push(group);
    }
  }

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative border-b border-rally-border/50 bg-rally-dark-surface px-2 py-3">
      {/* Left scroll arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-rally-surface-light/90 text-rally-text shadow-lg backdrop-blur-sm transition-colors hover:bg-rally-surface-light"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Right scroll arrow */}
      {showRightArrow && grouped.length > 0 && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-rally-surface-light/90 text-rally-text shadow-lg backdrop-blur-sm transition-colors hover:bg-rally-surface-light"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto px-2 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Add Story button */}
        <button
          onClick={onAddStory}
          className="group flex shrink-0 flex-col items-center gap-1.5"
        >
          <div className="relative">
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden border-2 border-dashed border-rally-border/60 transition-colors group-hover:border-rally-blue/60"
              style={{
                clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Your story"
                  className="h-full w-full object-cover opacity-60"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-rally-surface text-sm font-bold text-rally-text-muted">
                  {user ? getInitials(user.displayName) : '?'}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-rally-dark-surface bg-rally-blue">
              <Plus className="h-3 w-3 text-rally-dark-surface" />
            </div>
          </div>
          <span className="max-w-[64px] truncate text-[10px] text-rally-text-muted">
            Add Story
          </span>
        </button>

        {/* Story avatars */}
        {grouped.map((group) => (
          <button
            key={group.authorId}
            onClick={() => onViewStory(group.stories[0])}
            className="group flex shrink-0 flex-col items-center gap-1.5"
          >
            <StoryAvatar
              avatarUrl={group.author.avatarUrl}
              displayName={group.author.displayName}
              hasUnviewed={group.hasUnviewed}
            />
            <span className="max-w-[64px] truncate text-[10px] text-rally-text-muted">
              {group.author.displayName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==================== Story Avatar ==================== */

interface StoryAvatarProps {
  avatarUrl?: string;
  displayName: string;
  hasUnviewed: boolean;
}

function StoryAvatar({ avatarUrl, displayName, hasUnviewed }: StoryAvatarProps) {
  return (
    <div className="relative">
      {/* Gradient ring */}
      <div
        className={cn(
          'flex h-[68px] w-[68px] items-center justify-center p-[3px]',
          hasUnviewed ? 'opacity-100' : 'opacity-40'
        )}
        style={{
          background: hasUnviewed
            ? 'linear-gradient(135deg, #00D9FF, #39FF14)'
            : '#30363D',
          clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
        }}
      >
        {/* Inner container */}
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden bg-rally-dark-surface p-[2px]"
          style={{
            clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden"
            style={{
              clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-rally-surface text-sm font-bold text-rally-text">
                {getInitials(displayName)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
