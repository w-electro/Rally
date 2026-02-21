import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  highlightQuery?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Quick-reaction palette shown on hover
// ---------------------------------------------------------------------------

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE22', '\uD83D\uDD25'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap matching substrings in a highlight mark */
function highlightText(text: string, query: string, keyPrefix: string): React.ReactNode[] {
  if (!query) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={`${keyPrefix}-hl-${i}`} className="bg-rally-blue/30 text-white rounded-sm px-0.5">{p}</mark>
    ) : (
      p
    ),
  );
}

/** Highlight @mentions, #channels, and URLs in message content */
function renderContent(content: string, searchQuery?: string): React.ReactNode[] {
  const tokenRe = /(@[\w]+|#[\w-]+|https?:\/\/[^\s<]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const plain = content.slice(lastIndex, match.index);
      parts.push(...highlightText(plain, searchQuery || '', `p-${match.index}`));
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
    const remaining = content.slice(lastIndex);
    parts.push(...highlightText(remaining, searchQuery || '', 'end'));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BubbleMessage = React.memo(function BubbleMessage({
  message,
  isCompact = false,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReaction,
  onRepost,
  onThreadOpen,
  highlightQuery,
  className,
}: BubbleMessageProps) {
  const { t } = useTranslation();
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

  const renderedContent = useMemo(
    () => renderContent(message.content ?? '', highlightQuery),
    [message.content, highlightQuery],
  );

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
              'absolute bottom-full z-10 flex flex-col gap-0.5 rounded-md bg-[#1A1F2E]/90 backdrop-blur-sm px-0.5 py-1 shadow-lg mb-1',
              isOwn ? 'right-0' : 'left-0',
            )}
          >
            {/* Quick emoji picker */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title={t('chat.addReaction')}
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmojiPicker && (
                <div className={cn(
                  'absolute top-0 flex flex-col gap-0.5 rounded border border-white/10 bg-[#0A0E27] p-1 shadow-xl z-20',
                  isOwn ? 'right-full mr-1' : 'left-full ml-1',
                )}>
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
              title={t('chat.reply')}
            >
              <Reply className="h-4 w-4" />
            </button>

            {/* Thread */}
            {onThreadOpen && (
              <button
                onClick={() => onThreadOpen(message)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title={t('chat.openThread')}
              >
                <Reply className="h-4 w-4 -scale-x-100" />
              </button>
            )}

            {/* More */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
                title={t('chat.more')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMoreMenu && (
                <div className={cn(
                  'absolute top-0 w-40 rounded border border-white/10 bg-[#0A0E27] py-1 shadow-xl z-20',
                  isOwn ? 'right-full mr-1' : 'left-full ml-1',
                )}>
                  {isOwn && (
                    <button
                      onClick={() => {
                        onEdit?.(message);
                        setShowMoreMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('chat.editMsg')}
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
                    {message.isPinned ? t('chat.unpinMessage') : t('chat.pinMessage')}
                  </button>
                  <button
                    onClick={() => {
                      onRepost?.(message);
                      setShowMoreMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {t('chat.repost')}
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
                      {t('chat.deleteMessage')}
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
          {message.isEdited && (
            <span className="text-[10px] text-gray-600 italic mr-1 select-none">
              {t('chat.edited')}
            </span>
          )}
          {renderedContent}
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
});
