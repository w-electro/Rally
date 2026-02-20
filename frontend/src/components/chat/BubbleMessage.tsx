import React, { useState, useRef } from 'react';
import {
  Reply,
  MoreHorizontal,
  Smile,
  Pin,
  Pencil,
  Trash2,
  Share2,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/lib/types';
import { cn, formatTime, getInitials } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Quick-reaction palette shown on hover
// ---------------------------------------------------------------------------

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE22', '\uD83D\uDD25'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Highlight @mentions, #channels, and URLs in message content */
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

    if (token.startsWith('@')) {
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="rounded bg-[#00D9FF]/15 px-0.5 text-[#00D9FF] cursor-pointer hover:underline"
        >
          {token}
        </span>,
      );
    } else if (token.startsWith('#')) {
      parts.push(
        <span
          key={`channel-${match.index}`}
          className="rounded bg-[#00D9FF]/15 px-0.5 text-[#00D9FF] cursor-pointer hover:underline"
        >
          {token}
        </span>,
      );
    } else {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00D9FF] underline hover:brightness-125 break-all"
        >
          {token}
        </a>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const author = message.author ?? {
    id: message.authorId,
    username: 'unknown',
    displayName: 'Unknown',
    avatarUrl: undefined,
  };
  const isSystem =
    message.type === 'SYSTEM' ||
    message.type === 'JOIN' ||
    message.type === 'LEAVE' ||
    message.type === 'PIN' ||
    message.type === 'BOOST';

  // ---- System messages: centered, no bubble ----
  if (isSystem) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 py-1 px-4 text-xs text-gray-500 italic select-none',
          className,
        )}
      >
        <span className="h-px flex-1 bg-white/5" />
        <span>{message.content}</span>
        <span className="h-px flex-1 bg-white/5" />
      </div>
    );
  }

  // ---- Reactions ----
  const reactions = message.reactions ?? {};

  // ---- Attachments ----
  const attachments = message.attachments ?? [];
  const imageAttachments = attachments.filter((a) =>
    a.type?.startsWith('image/'),
  );
  const fileAttachments = attachments.filter(
    (a) => !a.type?.startsWith('image/'),
  );

  // ---- Render ----
  return (
    <div
      className={cn(
        'group relative flex flex-col px-4',
        isCompact ? 'py-0.5' : 'py-1',
        isOwn ? 'items-end' : 'items-start',
        className,
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowMoreMenu(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* ---- Avatar + Name + Timestamp (first message in group) ---- */}
      {!isCompact && (
        <div
          className={cn(
            'flex items-center gap-2 mb-1',
            isOwn ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <Avatar
            src={author.avatarUrl}
            name={author.displayName}
            size="sm"
          />
          <div
            className={cn(
              'flex items-baseline gap-2',
              isOwn ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <span className="font-display font-semibold text-sm text-[#00D9FF] hover:underline cursor-pointer">
              {author.displayName}
            </span>
            <span className="text-[10px] text-gray-600 select-none">
              {formatTime(message.createdAt)}
            </span>
          </div>
        </div>
      )}

      {/* ---- Bubble wrapper (for relative positioning of action bar) ---- */}
      <div className="relative max-w-[70%]">
        {/* ---- Hover action bar ---- */}
        {showActions && (
          <div
            className={cn(
              'absolute -top-3 z-10 flex items-center gap-0.5 rounded border border-white/10 bg-[#0A0E27] px-1 py-0.5 shadow-xl',
              isOwn ? 'left-4' : 'right-4',
            )}
          >
            {/* Quick emoji picker */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title="Add reaction"
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full right-0 mt-1 flex gap-1 rounded border border-white/10 bg-[#0A0E27] p-1.5 shadow-xl z-20">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction?.(message.id, emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="rounded p-1 text-sm hover:bg-white/10 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reply */}
            <button
              onClick={() => onReply?.(message)}
              className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
              title="Reply"
            >
              <Reply className="h-4 w-4" />
            </button>

            {/* Thread */}
            {onThreadOpen && (
              <button
                onClick={() => onThreadOpen(message)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title="Open thread"
              >
                <Reply className="h-4 w-4 -scale-x-100" />
              </button>
            )}

            {/* More */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title="More"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMoreMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 rounded border border-white/10 bg-[#0A0E27] py-1 shadow-xl z-20">
                  {isOwn && (
                    <button
                      onClick={() => {
                        onEdit?.(message);
                        setShowMoreMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Message
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onPin?.(message.id);
                      setShowMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    <Pin className="h-3.5 w-3.5" />
                    {message.isPinned ? 'Unpin Message' : 'Pin Message'}
                  </button>
                  <button
                    onClick={() => {
                      onRepost?.(message);
                      setShowMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Repost
                  </button>
                  {isOwn && (
                    <button
                      onClick={() => {
                        onDelete?.(message.id);
                        setShowMoreMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#FF006E] hover:bg-[#FF006E]/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Message
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Reply reference ---- */}
        {message.replyTo && (
          <div
            className={cn(
              'mb-1 flex items-center gap-1.5 text-xs text-gray-500 truncate',
              isOwn ? 'justify-end' : 'justify-start',
            )}
          >
            <Reply className="h-3 w-3 rotate-180 text-gray-600" />
            <span className="font-semibold text-gray-400">
              {message.replyTo.author?.displayName ?? 'Unknown'}
            </span>
            <span className="truncate opacity-70">
              {message.replyTo.content}
            </span>
          </div>
        )}

        {/* ---- The bubble ---- */}
        <div
          className={cn(
            'px-3 py-2 text-sm text-gray-200 whitespace-pre-wrap break-words leading-[1.375rem]',
            isOwn
              ? 'bg-[#00D9FF]/10 border border-[#00D9FF]/20 rounded-2xl rounded-br-md'
              : 'bg-[#1A1F2E] border border-white/5 rounded-2xl rounded-bl-md',
          )}
        >
          {/* Compact: show author name inline */}
          {isCompact && (
            <>
              <span className="font-display font-semibold text-[#00D9FF] mr-1 cursor-pointer hover:underline text-xs">
                {author.displayName}
              </span>
              {message.isEdited && (
                <span className="text-[10px] text-gray-600 italic mr-1 select-none">
                  (edited)
                </span>
              )}
            </>
          )}
          {!isCompact && message.isEdited && (
            <span className="text-[10px] text-gray-600 italic mr-1 select-none">
              (edited)
            </span>
          )}
          {renderContent(message.content ?? '')}
        </div>

        {/* ---- Image attachments ---- */}
        {imageAttachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {imageAttachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded border border-white/10 max-w-xs"
              >
                <img
                  src={att.url}
                  alt={att.name}
                  className="max-h-64 object-contain"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {/* ---- File attachments ---- */}
        {fileAttachments.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {fileAttachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors max-w-xs"
              >
                <span className="truncate font-medium">{att.name}</span>
                <span className="text-gray-600 shrink-0">
                  {(att.size / 1024).toFixed(1)} KB
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ---- Reactions ---- */}
      {Object.keys(reactions).length > 0 && (
        <div
          className={cn(
            'mt-1 flex flex-wrap gap-1',
            isOwn ? 'justify-end' : 'justify-start',
          )}
        >
          {Object.entries(reactions).map(([emoji, userIds]) => {
            const ids = Array.isArray(userIds) ? userIds : [];
            const hasReacted = user ? ids.includes(user.id) : false;
            return (
              <button
                key={emoji}
                onClick={() => onReaction?.(message.id, emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  hasReacted
                    ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF]'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10',
                )}
              >
                <span>{emoji}</span>
                <span className="font-medium">{ids.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
