# Phase 3: Server Redesign, Profiles & Screen Share Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the server view with horizontal channel bar, bubble chat, compact member cards, minimal profile popups, and fix screen sharing.

**Architecture:** Replace the vertical ChannelSidebar with a horizontal ChannelBar component. Rewrite MessageItem as BubbleMessage with left/right alignment. Redesign MemberList with gamer cards. Add UserProfilePopup as a floating card. Fix screen share by using getDisplayMedia() for browser and fixing SimplePeer stream handling.

**Tech Stack:** React 18, TypeScript, Zustand 5, Tailwind CSS 3, SimplePeer, Socket.IO

---

## Dependency Map

```
Task 1: TopNav filter Rally HQ (independent)
Task 2: ChannelBar component (independent)
Task 3: BubbleMessage component (independent)
Task 4: MemberList redesign (independent)
Task 5: UserProfilePopup component (independent)
Task 6: Screen share fix — voicePeerManager (independent)
Task 7: Screen share fix — ScreenSharePicker fallback (depends on Task 6)
Task 8: Wire ChannelBar into AppLayout (depends on Task 2)
Task 9: Wire BubbleMessage into ChatArea (depends on Task 3)
Task 10: Wire ProfilePopup into MemberList (depends on Tasks 4, 5)
Task 11: Wire screen share end-to-end (depends on Tasks 6, 7)
Task 12: TypeScript check + visual verification
```

**Parallel waves:**
- Wave 1: Tasks 1, 2, 3, 4, 5, 6 (all independent)
- Wave 2: Tasks 7, 8, 9, 10 (wiring)
- Wave 3: Tasks 11, 12 (final wiring + verification)

---

### Task 1: Filter Rally HQ from TopNav server tabs

**Files:**
- Modify: `frontend/src/components/app/TopNav.tsx`

**Context:** The TopNav currently shows ALL servers as horizontal tabs. The user wants "Rally HQ" (the default seeded server) removed from the TopNav tabs — it should only be accessible from the Home Dashboard. Other user-created servers remain as tabs.

**Implementation:**

In `TopNav.tsx`, find the server tabs mapping at line 154:

```tsx
{servers.map((server) => (
  <ServerTab
    key={server.id}
    server={server}
    isActive={activeServer?.id === server.id && view === 'servers'}
    onClick={() => handleServerClick(server)}
  />
))}
```

Replace with filtered version:

```tsx
{servers
  .filter((server) => server.name !== 'Rally HQ')
  .map((server) => (
    <ServerTab
      key={server.id}
      server={server}
      isActive={activeServer?.id === server.id && view === 'servers'}
      onClick={() => handleServerClick(server)}
    />
  ))}
```

**Verify:** Run `npx tsc --noEmit` from `frontend/`. Visually confirm Rally HQ no longer shows in TopNav but still appears on the Home Dashboard.

**Commit:** `feat: filter Rally HQ from TopNav server tabs`

---

### Task 2: Create ChannelBar component

**Files:**
- Create: `frontend/src/components/app/ChannelBar.tsx`

**Context:** This replaces the 240px vertical ChannelSidebar with a horizontal scrollable tab bar below the TopNav. Channels appear as pills/tabs with type icons. Active channel gets cyan underline. A settings icon provides server actions (invite, settings, create channel). Voice channels auto-join when clicked.

**Implementation:**

Create `frontend/src/components/app/ChannelBar.tsx`:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Hash,
  Volume2,
  Camera,
  Megaphone,
  Theater,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Plus,
} from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import type { Channel } from '@/lib/types';

function getChannelIcon(type: string) {
  switch (type) {
    case 'TEXT': return Hash;
    case 'VOICE': return Volume2;
    case 'FEED': return Camera;
    case 'STAGE': return Theater;
    case 'ANNOUNCEMENT': return Megaphone;
    default: return Hash;
  }
}

export function ChannelBar() {
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const setActiveChannel = useServerStore((s) => s.setActiveChannel);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const openModal = useUIStore((s) => s.openModal);
  const { joinVoice } = useSocket();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, activeServer]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const handleChannelClick = useCallback((channel: Channel) => {
    if (channel.type === 'VOICE') {
      if (voiceChannelId !== channel.id) {
        joinVoice(channel.id);
      }
    }
    setActiveChannel(channel);
  }, [voiceChannelId, joinVoice, setActiveChannel]);

  if (!activeServer) return null;

  // Flatten all non-category channels
  const channels = (activeServer.channels || []).filter(
    (c) => c.type !== 'CATEGORY'
  );

  return (
    <div className="h-9 bg-[#0D1117] border-b border-white/5 flex items-center select-none relative">
      {/* Left scroll arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 w-7 h-full flex items-center justify-center bg-gradient-to-r from-[#0D1117] via-[#0D1117]/90 to-transparent"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
        </button>
      )}

      {/* Scrollable channel tabs */}
      <div
        ref={scrollRef}
        className="flex items-center h-full flex-1 overflow-x-auto scrollbar-none px-2 gap-1"
      >
        {channels
          .sort((a, b) => a.position - b.position)
          .map((channel) => {
            const Icon = getChannelIcon(channel.type);
            const isActive = activeChannel?.id === channel.id;
            const isInVoice = channel.type === 'VOICE' && voiceChannelId === channel.id;

            return (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 h-full shrink-0 text-xs font-medium transition-colors duration-150',
                  isActive
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5',
                  isInVoice && !isActive && 'text-[#39FF14]/70'
                )}
              >
                <Icon className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  isActive ? 'text-[#00D9FF]' : isInVoice ? 'text-[#39FF14]/70' : 'text-white/30'
                )} />
                <span className="whitespace-nowrap">{channel.name}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#00D9FF] rounded-full" />
                )}
              </button>
            );
          })}
      </div>

      {/* Right scroll arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-9 z-10 w-7 h-full flex items-center justify-center bg-gradient-to-l from-[#0D1117] via-[#0D1117]/90 to-transparent"
        >
          <ChevronRight className="w-4 h-4 text-white/60" />
        </button>
      )}

      {/* Server settings dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowServerMenu(!showServerMenu)}
          className="w-9 h-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          title="Server Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {showServerMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowServerMenu(false)} />
            <div className="absolute top-full right-0 z-50 mt-1 bg-[#1A1F36] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]">
              <button
                onClick={() => { setShowServerMenu(false); openModal('invite'); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite People
              </button>
              <button
                onClick={() => { setShowServerMenu(false); openModal('createChannel'); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Channel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Verify:** Run `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: create horizontal ChannelBar component`

---

### Task 3: Create BubbleMessage component

**Files:**
- Create: `frontend/src/components/chat/BubbleMessage.tsx`

**Context:** Replace the current flat Discord-style MessageItem with iMessage-style bubble messages. Own messages are right-aligned with cyan tint, others are left-aligned with dark surface background. First message in a group shows avatar + name + timestamp above the bubble. Consecutive messages from the same author stack tightly without repeating info.

**Implementation:**

Create `frontend/src/components/chat/BubbleMessage.tsx`:

```tsx
import React, { useState, useRef } from 'react';
import {
  Reply,
  MoreHorizontal,
  Smile,
  Pencil,
  Trash2,
  Share2,
  Pin,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/lib/types';
import { cn, formatTime, getInitials } from '@/lib/utils';

interface BubbleMessageProps {
  message: Message;
  isCompact?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onRepost?: (message: Message) => void;
  onThreadOpen?: (message: Message) => void;
  className?: string;
}

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE22', '\uD83D\uDD25'];

/** Highlight @mentions, #channels, and URLs */
function renderContent(content: string): React.ReactNode[] {
  const tokenRe = /(@[\w]+|#[\w-]+|https?:\/\/[^\s<]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('@') || token.startsWith('#')) {
      parts.push(
        <span key={`t-${match.index}`} className="rounded bg-[#00D9FF]/15 px-0.5 text-[#00D9FF] cursor-pointer hover:underline">
          {token}
        </span>
      );
    } else {
      parts.push(
        <a key={`l-${match.index}`} href={token} target="_blank" rel="noopener noreferrer" className="text-[#00D9FF] underline hover:brightness-125 break-all">
          {token}
        </a>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

export function BubbleMessage({
  message,
  isCompact = false,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReaction,
  onRepost,
  onThreadOpen,
  className,
}: BubbleMessageProps) {
  const { user } = useAuthStore();
  const [showActions, setShowActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isOwn = user?.id === message.authorId;
  const author = message.author ?? { id: message.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: undefined };
  const isSystem = message.type === 'SYSTEM' || message.type === 'JOIN' || message.type === 'LEAVE' || message.type === 'PIN' || message.type === 'BOOST';

  // System messages — centered, no bubble
  if (isSystem) {
    return (
      <div className={cn('flex items-center justify-center gap-2 py-1 px-4 text-xs text-gray-500 italic select-none', className)}>
        <span className="h-px flex-1 bg-white/5" />
        <span>{message.content}</span>
        <span className="h-px flex-1 bg-white/5" />
      </div>
    );
  }

  const reactions = message.reactions ?? {};
  const attachments = message.attachments ?? [];
  const imageAttachments = attachments.filter((a) => a.type?.startsWith('image/'));
  const fileAttachments = attachments.filter((a) => !a.type?.startsWith('image/'));

  return (
    <div
      className={cn(
        'group relative px-4',
        isCompact ? 'py-0.5' : 'pt-1 py-0.5',
        isOwn ? 'flex flex-col items-end' : 'flex flex-col items-start',
        className,
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowMoreMenu(false); setShowEmojiPicker(false); }}
    >
      {/* Header: avatar + name + time (only for first message in group) */}
      {!isCompact && (
        <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
          <Avatar src={author.avatarUrl} name={author.displayName} size="xs" />
          <span className="text-xs font-semibold text-[#00D9FF]">{author.displayName}</span>
          <span className="text-[10px] text-gray-600">{formatTime(message.createdAt)}</span>
          {message.isEdited && <span className="text-[10px] text-gray-600 italic">(edited)</span>}
        </div>
      )}

      {/* Reply reference */}
      {message.replyTo && (
        <div className={cn('flex items-center gap-1.5 text-xs text-gray-500 mb-1 max-w-[70%]', isOwn && 'flex-row-reverse')}>
          <Reply className="h-3 w-3 rotate-180 text-gray-600 shrink-0" />
          <span className="font-semibold text-gray-400">{message.replyTo.author?.displayName ?? 'Unknown'}</span>
          <span className="truncate opacity-70">{message.replyTo.content}</span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'relative max-w-[70%] px-3 py-2 text-sm leading-relaxed',
          isOwn
            ? 'bg-[#00D9FF]/10 border border-[#00D9FF]/20 text-gray-100 rounded-2xl rounded-br-md'
            : 'bg-[#1A1F2E] border border-white/5 text-gray-200 rounded-2xl rounded-bl-md',
        )}
      >
        {/* Compact: show author name inline */}
        {isCompact && (
          <span className={cn('text-xs font-semibold mr-1', isOwn ? 'text-[#00D9FF]' : 'text-[#00D9FF]')}>
            {author.displayName}
          </span>
        )}
        <span className="whitespace-pre-wrap break-words">{renderContent(message.content ?? '')}</span>

        {/* Image attachments */}
        {imageAttachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {imageAttachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg max-w-xs">
                <img src={att.url} alt={att.name} className="max-h-64 object-contain" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {/* File attachments */}
        {fileAttachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {fileAttachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors max-w-xs">
                <span className="truncate font-medium">{att.name}</span>
                <span className="text-gray-600 shrink-0">{(att.size / 1024).toFixed(1)} KB</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Reactions */}
      {Object.keys(reactions).length > 0 && (
        <div className={cn('mt-1 flex flex-wrap gap-1', isOwn && 'justify-end')}>
          {Object.entries(reactions).map(([emoji, userIds]) => {
            const ids = Array.isArray(userIds) ? userIds : [];
            const hasReacted = user ? ids.includes(user.id) : false;
            return (
              <button key={emoji} onClick={() => onReaction?.(message.id, emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  hasReacted ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF]' : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20',
                )}>
                <span>{emoji}</span>
                <span className="font-medium">{ids.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hover action bar */}
      {showActions && (
        <div className={cn(
          'absolute -top-3 z-10 flex items-center gap-0.5 rounded border border-white/10 bg-[#0A0E27] px-1 py-0.5 shadow-xl',
          isOwn ? 'left-4' : 'right-4',
        )}>
          <div className="relative">
            <button onClick={() => setShowEmojiPicker((p) => !p)} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors" title="Add reaction">
              <Smile className="h-4 w-4" />
            </button>
            {showEmojiPicker && (
              <div className="absolute top-full right-0 mt-1 flex gap-1 rounded border border-white/10 bg-[#0A0E27] p-1.5 shadow-xl z-20">
                {QUICK_REACTIONS.map((emoji) => (
                  <button key={emoji} onClick={() => { onReaction?.(message.id, emoji); setShowEmojiPicker(false); }} className="rounded p-1 text-sm hover:bg-white/10 transition-colors">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => onReply?.(message)} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors" title="Reply">
            <Reply className="h-4 w-4" />
          </button>

          {onThreadOpen && (
            <button onClick={() => onThreadOpen(message)} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors" title="Open thread">
              <Reply className="h-4 w-4 -scale-x-100" />
            </button>
          )}

          <div className="relative" ref={moreMenuRef}>
            <button onClick={() => setShowMoreMenu((p) => !p)} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors" title="More">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-1 w-40 rounded border border-white/10 bg-[#0A0E27] py-1 shadow-xl z-20">
                {isOwn && (
                  <button onClick={() => { onEdit?.(message); setShowMoreMenu(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit Message
                  </button>
                )}
                <button onClick={() => { onPin?.(message.id); setShowMoreMenu(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors">
                  <Pin className="h-3.5 w-3.5" /> {message.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => { onRepost?.(message); setShowMoreMenu(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors">
                  <Share2 className="h-3.5 w-3.5" /> Repost
                </button>
                {isOwn && (
                  <button onClick={() => { onDelete?.(message.id); setShowMoreMenu(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#FF006E] hover:bg-[#FF006E]/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note:** The Avatar component is imported from `@/components/ui/Avatar`. Size "xs" may need to be a ~28px variant. If the Avatar component doesn't support "xs", use a 28px inline avatar div instead.

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: create BubbleMessage component with iMessage-style bubbles`

---

### Task 4: Redesign MemberList with compact gamer cards

**Files:**
- Modify: `frontend/src/components/app/MemberList.tsx`

**Context:** Replace the plain name list with compact gamer cards showing avatar initials, display name, status dot, current game activity, and rank badge placeholder. Remove the "Online — N" / "Offline — N" section headers. Online members listed first, offline dimmed.

**Implementation:**

Rewrite `frontend/src/components/app/MemberList.tsx`:

```tsx
import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, getInitials, getStatusColor } from '@/lib/utils';
import type { ServerMember } from '@/lib/types';

export function MemberList() {
  const { members } = useServerStore();
  const { openModal } = useUIStore();

  const sorted = useMemo(() => {
    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];
    members.forEach((m) => {
      if (m.user.status === 'OFFLINE') offline.push(m);
      else online.push(m);
    });
    return [...online, ...offline];
  }, [members]);

  const onlineCount = sorted.filter((m) => m.user.status !== 'OFFLINE').length;

  return (
    <div className="w-60 bg-[#0D1117] border-l border-white/5 flex flex-col h-full">
      <div className="p-3 border-b border-white/5">
        <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-white/40">
          Members — {onlineCount} online
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {sorted.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            dimmed={m.user.status === 'OFFLINE'}
            onClick={() => openModal('userProfile', m.user)}
          />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, dimmed, onClick }: { member: ServerMember; dimmed?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors text-left',
        dimmed && 'opacity-40',
      )}
    >
      {/* Avatar with status dot */}
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center text-xs font-bold text-white/70">
          {member.user.avatarUrl ? (
            <img src={member.user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(member.user.displayName)
          )}
        </div>
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D1117]"
          style={{ backgroundColor: getStatusColor(member.user.status ?? 'OFFLINE') }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-tight">
          {member.nickname || member.user.displayName}
        </p>
        {member.user.currentGame && (
          <p className="text-[11px] text-[#00D9FF] truncate leading-tight">
            Playing {member.user.currentGame}
          </p>
        )}
        {!member.user.currentGame && member.user.customStatus && (
          <p className="text-[11px] text-white/30 truncate leading-tight">
            {member.user.customStatus}
          </p>
        )}
      </div>
    </button>
  );
}
```

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: redesign MemberList with compact gamer cards`

---

### Task 5: Create UserProfilePopup component

**Files:**
- Create: `frontend/src/components/app/UserProfilePopup.tsx`

**Context:** A minimal floating popup card that appears when clicking a member name. Shows avatar, display name, status dot, current game, and two action buttons (Message, Add Friend). Dismiss by clicking outside or pressing Escape. This is NOT a modal — it's positioned near the click target.

For now, render it as a simple modal overlay since the click positioning can be complex. Keep it minimal.

**Implementation:**

Create `frontend/src/components/app/UserProfilePopup.tsx`:

```tsx
import { useEffect, useCallback } from 'react';
import { MessageCircle, UserPlus, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { getInitials, getStatusColor } from '@/lib/utils';

export function UserProfilePopup() {
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const closeModal = useUIStore((s) => s.closeModal);
  const setView = useUIStore((s) => s.setView);
  const setActiveDmConversation = useUIStore((s) => s.setActiveDmConversation);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  }, [closeModal]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (activeModal !== 'userProfile' || !modalData) return null;

  const user = modalData as any;

  const handleMessage = () => {
    closeModal();
    setView('dms');
    // If we have a DM conversation ID, navigate to it
    // For now, just switch to DMs view
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" onClick={closeModal} />
      <div className="relative z-10 w-72 rounded-xl border border-white/10 bg-[#0D1117] shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-16 bg-gradient-to-r from-[#00D9FF]/20 via-[#8B00FF]/20 to-[#FF006E]/20 relative">
          <button
            onClick={closeModal}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar (overlapping the gradient bar) */}
        <div className="flex justify-center -mt-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1A1F36] border-4 border-[#0D1117] flex items-center justify-center text-lg font-bold text-white/70">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.displayName ?? 'User')
              )}
            </div>
            <div
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-3 border-[#0D1117]"
              style={{ backgroundColor: getStatusColor(user.status ?? 'OFFLINE'), borderWidth: '3px' }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-center px-4 pt-2 pb-3">
          <h3 className="text-base font-bold text-white">{user.displayName ?? 'User'}</h3>
          <p className="text-xs text-white/30">@{user.username ?? 'unknown'}</p>
          {user.currentGame && (
            <p className="text-xs text-[#00D9FF] mt-1">Playing {user.currentGame}</p>
          )}
          {!user.currentGame && user.customStatus && (
            <p className="text-xs text-white/40 mt-1">{user.customStatus}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleMessage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#00D9FF]/10 border border-[#00D9FF]/20 text-[#00D9FF] text-xs font-medium hover:bg-[#00D9FF]/20 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Message
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] text-xs font-medium hover:bg-[#39FF14]/20 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Friend
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Note:** Check `uiStore.ts` to see if `modalData` exists. If `openModal` only accepts a modal name string, you'll need to add a `modalData` field to the store. The current `MemberList.tsx` calls `openModal('userProfile', m.user)` so check if that second argument is stored.

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: create minimal UserProfilePopup component`

---

### Task 6: Fix screen share — voicePeerManager

**Files:**
- Modify: `frontend/src/lib/voicePeerManager.ts`

**Context:** The current `startScreenShare()` uses `navigator.mediaDevices.getUserMedia()` with Electron's `chromeMediaSource: 'desktop'` constraint. This only works inside Electron. In the browser (Vite dev server), it silently fails. Additionally, `peer.addTrack()` on SimplePeer does NOT trigger WebRTC renegotiation — SimplePeer needs `addStream()` or the peer must be recreated.

**Fix:**

1. Add a `getDisplayMedia()` browser fallback for when Electron API is not available.
2. Replace `addTrack/removeTrack` with `addStream/removeStream` (SimplePeer supports these natively and they trigger renegotiation).

In `voicePeerManager.ts`, replace the `startScreenShare` method (lines 308-343):

```tsx
async startScreenShare(sourceId: string, withAudio: boolean): Promise<MediaStream> {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  if (isElectron) {
    // Electron: use chromeMediaSource
    this.screenStream = await navigator.mediaDevices.getUserMedia({
      audio: withAudio ? {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as any : false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as any,
    });
  } else {
    // Browser fallback: use standard getDisplayMedia
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: withAudio,
    });
  }

  // Add the screen stream to all peers (triggers renegotiation)
  for (const [, peer] of this.peers) {
    try {
      (peer as any).addStream(this.screenStream);
    } catch (e) {
      console.error('[VoicePeerManager] Failed to add screen stream:', e);
    }
  }

  // Listen for track ending (user stops from OS or browser UI)
  const videoTrack = this.screenStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.onended = () => {
      this.stopScreenShare();
    };
  }

  return this.screenStream;
}
```

Also replace the `stopScreenShare` method (lines 349-369):

```tsx
stopScreenShare(): void {
  if (!this.screenStream) return;

  // Remove the screen stream from all peers
  for (const [, peer] of this.peers) {
    try {
      (peer as any).removeStream(this.screenStream);
    } catch (e) {
      // Peer may not have the stream
    }
  }

  // Stop all tracks
  for (const track of this.screenStream.getTracks()) {
    track.stop();
  }
  this.screenStream = null;
}
```

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `fix: use addStream/removeStream for screen share + browser fallback`

---

### Task 7: Fix screen share — ScreenSharePicker browser fallback

**Files:**
- Modify: `frontend/src/components/voice/ScreenSharePicker.tsx`

**Context:** The ScreenSharePicker currently shows "Screen sharing requires the Rally desktop app" when not in Electron. With the `getDisplayMedia()` fallback in voicePeerManager, we should instead show a simple "Share Screen" button that triggers the browser's native screen picker.

**Implementation:**

In `ScreenSharePicker.tsx`, replace the non-Electron fallback section (lines 134-146):

```tsx
{!isElectronAvailable ? (
  <div className="px-6 py-12 text-center">
    <Monitor size={48} className="mx-auto mb-4 text-[#00D9FF]" />
    <p className="text-gray-300 text-sm mb-2 font-medium">
      Share Your Screen
    </p>
    <p className="text-gray-500 text-xs mb-6">
      Your browser will ask which screen or window to share
    </p>
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={() => onSelect('browser', false)}
        className="px-6 py-2 rounded-lg bg-[#00D9FF] text-black text-sm font-medium hover:bg-[#00D9FF]/90 transition-colors"
      >
        Share Screen
      </button>
    </div>
  </div>
) : (
```

The `sourceId: 'browser'` is passed to distinguish from Electron source IDs. The voicePeerManager will use `getDisplayMedia()` when it's not in Electron, ignoring the sourceId.

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: add browser fallback UI to ScreenSharePicker`

---

### Task 8: Wire ChannelBar into AppLayout

**Files:**
- Modify: `frontend/src/components/app/AppLayout.tsx`

**Context:** Replace the ChannelSidebar with the new horizontal ChannelBar. The ChannelBar goes between the TopNav and the main content area. Remove the ChannelSidebar import and rendering.

**Implementation:**

In `AppLayout.tsx`:

1. Replace `import { ChannelSidebar } from './ChannelSidebar';` with `import { ChannelBar } from './ChannelBar';`

2. Remove the sidebar rendering in the layout (lines 141-145):
```tsx
{/* Channel / DM Sidebar */}
{renderSidebar() && (
  <div className="w-60 shrink-0 flex flex-col overflow-hidden">
    {renderSidebar()}
  </div>
)}
```

3. Replace the `renderSidebar` function: it should only return DmSidebar for DMs, not ChannelSidebar for servers.

4. Add `<ChannelBar />` after `<TopNav />` and before the main content flex container.

The modified layout structure becomes:

```tsx
<div className="h-screen w-screen flex flex-col overflow-hidden bg-[#000000]">
  {/* Custom Titlebar */}
  ...

  {/* Top Nav */}
  <TopNav />

  {/* Channel Bar (only when viewing a server) */}
  {view === 'servers' && activeServer && <ChannelBar />}

  {/* Main Content Area */}
  <div className="flex-1 flex overflow-hidden">
    {/* DM Sidebar (only for DMs view) */}
    {view === 'dms' && (
      <div className="w-60 shrink-0 flex flex-col overflow-hidden">
        <DmSidebar />
      </div>
    )}

    {/* Center: main content */}
    <div className="flex-1 flex overflow-hidden min-w-0">
      {renderMainContent()}
    </div>

    {/* Right Panel */}
    ...
  </div>

  {/* Voice Bar */}
  ...

  {/* Modals */}
  ...
</div>
```

Also remove the `renderSidebar` function entirely since it's no longer needed as a function.

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: wire ChannelBar into AppLayout, remove ChannelSidebar`

---

### Task 9: Wire BubbleMessage into ChatArea

**Files:**
- Modify: `frontend/src/components/chat/ChatArea.tsx`

**Context:** Replace `MessageItem` with `BubbleMessage` in ChatArea. The import and usage change, but all the message handling logic (grouping, date dividers, scrolling) stays the same.

**Implementation:**

In `ChatArea.tsx`:

1. Replace `import { MessageItem } from '@/components/chat/MessageItem';` with `import { BubbleMessage } from '@/components/chat/BubbleMessage';`

2. In the messages map (line 356), replace `<MessageItem` with `<BubbleMessage`:

```tsx
<BubbleMessage
  message={msg}
  isCompact={isCompact}
  onReply={(m) => setReplyingTo(m)}
  onEdit={(m) => {
    const newContent = window.prompt('Edit message:', m.content);
    if (newContent && newContent !== m.content) {
      editMessage(m.id, newContent);
    }
  }}
  onDelete={handleDelete}
  onReaction={handleReaction}
  onRepost={(m) => {
    sendMessage(channel.id, `> ${m.content}\n\n-- reposted from @${m.author.displayName}`);
  }}
  onThreadOpen={(m) => setThreadMessage(m)}
/>
```

3. Also remove the channel header from ChatArea since the ChannelBar now handles channel identity. Replace the header section (lines 257-291) with a simpler divider or remove it.

Actually, keep the header for now since it shows the channel topic and has search/pin/member buttons. Just simplify: remove the Hash icon and channel name (since ChannelBar already shows the active channel).

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: use BubbleMessage in ChatArea for iMessage-style chat`

---

### Task 10: Wire UserProfilePopup into AppLayout

**Files:**
- Modify: `frontend/src/components/app/AppLayout.tsx`

**Context:** Add the UserProfilePopup to the modals section in AppLayout so it renders when `activeModal === 'userProfile'`.

**Implementation:**

1. Add import: `import { UserProfilePopup } from './UserProfilePopup';`

2. In the modals section, add:
```tsx
{activeModal === 'userProfile' && <UserProfilePopup />}
```

3. Check that `uiStore.ts` supports `modalData`. If `openModal` signature is `openModal(modal: string, data?: any)` and stores the data, this will work. If not, add `modalData` to the store.

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `feat: wire UserProfilePopup into AppLayout`

---

### Task 11: Wire screen share end-to-end

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts`
- Modify: `frontend/src/components/voice/VoiceChannel.tsx`

**Context:** Ensure the full screen share flow works: picker → capture → send to peers → display. The main issue was `addTrack` not triggering renegotiation (fixed in Task 6). Now verify the socket events and the video display are properly wired.

**Implementation:**

1. In `useSocket.ts`, the `screen:start` socket handler (line 97-100) currently does nothing with the incoming event. It should set the screen share user info in the store so the UI knows who's sharing:

```tsx
socket.on('screen:start', (data: { userId: string; username: string }) => {
  useVoiceStore.getState().setRemoteScreenShare(data.userId, null as any);
  // The actual stream arrives via WebRTC peer 'stream' event
  // But we set the userId so the UI shows "X is sharing"
});
```

Wait — `setRemoteScreenShare` sets both userId and stream. We only want to set the userId here, the stream comes later via WebRTC. Add a `setScreenShareUser` action to the voiceStore:

In `voiceStore.ts`, add a new action:
```tsx
setScreenShareUser: (userId: string | null) => void;
```

And its implementation:
```tsx
setScreenShareUser: (userId) => set({ screenShareUserId: userId }),
```

Then in `useSocket.ts`:
```tsx
socket.on('screen:start', (data: { userId: string; username: string }) => {
  useVoiceStore.getState().setScreenShareUser(data.userId);
});
```

2. In `VoiceChannel.tsx`, display the sharing user's display name instead of just the userId:

```tsx
<span className="text-xs font-medium text-rally-text">
  {isScreenSharing
    ? 'You are sharing your screen'
    : `${participants.find(p => p.userId === screenShareUserId)?.displayName ?? 'Someone'} is sharing`
  }
</span>
```

**Verify:** `npx tsc --noEmit` from `frontend/`.

**Commit:** `fix: wire screen share socket events and display correctly`

---

### Task 12: TypeScript check + visual verification

**Files:** None (verification only)

**Steps:**

1. Run `npx tsc --noEmit` from `frontend/` — fix any errors.
2. Run `npm run build` from `frontend/` — confirm zero errors, successful build.
3. Start both servers:
   - `cd backend && npm run dev`
   - `cd frontend && npm run dev`
4. Open `http://localhost:5173` in browser.
5. Verify:
   - TopNav does NOT show "Rally HQ" as a tab
   - Clicking HOME shows Dashboard with Rally HQ server card
   - Clicking a user-created server shows the horizontal ChannelBar
   - Channels in ChannelBar are clickable and show active cyan underline
   - Chat messages display as bubbles (own = right/cyan, others = left/dark)
   - Member list shows compact gamer cards
   - Clicking a member opens the minimal profile popup
   - Screen share button opens picker in browser mode
   - Screen share video displays when sharing

**Commit:** (only if fixes were needed) `fix: resolve TypeScript errors from Phase 3 wiring`

---

## Summary

| Task | Component | Wave | Depends On |
|------|-----------|------|------------|
| 1 | TopNav filter | 1 | — |
| 2 | ChannelBar | 1 | — |
| 3 | BubbleMessage | 1 | — |
| 4 | MemberList redesign | 1 | — |
| 5 | UserProfilePopup | 1 | — |
| 6 | Screen share fix (peer mgr) | 1 | — |
| 7 | Screen share fix (picker UI) | 2 | 6 |
| 8 | Wire ChannelBar | 2 | 2 |
| 9 | Wire BubbleMessage | 2 | 3 |
| 10 | Wire ProfilePopup | 2 | 4, 5 |
| 11 | Wire screen share | 3 | 6, 7 |
| 12 | TypeScript + visual verify | 3 | all |
