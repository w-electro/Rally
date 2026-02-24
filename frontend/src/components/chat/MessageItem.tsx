import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
import { cn, formatTime, formatDate, getInitials } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';
import { reactionAppear } from '@/lib/motion';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageItemProps {
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
// Quick‑reaction palette shown on hover
// ---------------------------------------------------------------------------

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE22', '\uD83D\uDD25'];


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageItem({
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
}: MessageItemProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [showActions, setShowActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isOwn = user?.id === message.authorId;
  const author = message.author ?? { id: message.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: undefined };
  const isSystem =
    message.type === 'SYSTEM' ||
    message.type === 'JOIN' ||
    message.type === 'LEAVE' ||
    message.type === 'PIN' ||
    message.type === 'BOOST';

  // ---- System messages ----
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
        'group relative flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] transition-colors',
        isCompact ? 'items-baseline' : 'items-start pt-1',
        className,
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowMoreMenu(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* ---- Avatar / Timestamp gutter ---- */}
      {isCompact ? (
        <span className="w-9 shrink-0 text-right text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity select-none leading-5">
          {formatTime(message.createdAt)}
        </span>
      ) : (
        <div className="shrink-0 pt-0.5">
          <Avatar
            src={author.avatarUrl}
            name={author.displayName}
            size="sm"
          />
        </div>
      )}

      {/* ---- Body ---- */}
      <div className="min-w-0 flex-1">
        {/* Reply reference */}
        {message.replyTo && (
          <div className="mb-0.5 flex items-center gap-1.5 text-xs text-gray-500 truncate">
            <Reply className="h-3 w-3 rotate-180 text-gray-600" />
            <span className="font-semibold text-gray-400">
              {message.replyTo.author?.displayName ?? 'Unknown'}
            </span>
            <span className="truncate opacity-70">
              {message.replyTo.content}
            </span>
          </div>
        )}

        {/* Header (full mode only) */}
        {!isCompact && (
          <div className="flex items-baseline gap-2 leading-5">
            <span className="font-display font-semibold text-sm text-rally-blue hover:underline cursor-pointer">
              {author.displayName}
            </span>
            <span className="text-[10px] text-gray-600 select-none">
              {formatTime(message.createdAt)}
            </span>
            {message.isEdited && (
              <span className="text-[10px] text-gray-600 italic select-none">
                {t('chat.edited')}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-[1.375rem]">
          {isCompact && (
            <>
              <span className="font-display font-semibold text-rally-blue mr-1 cursor-pointer hover:underline text-xs">
                {author.displayName}
              </span>
              {message.isEdited && (
                <span className="text-[10px] text-gray-600 italic mr-1 select-none">
                  {t('chat.edited')}
                </span>
              )}
            </>
          )}
          {renderMarkdown(message.content ?? '')}
        </div>

        {/* Image attachments */}
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

        {/* File attachments */}
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

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([emoji, userIds]) => {
              const ids = Array.isArray(userIds) ? userIds : [];
              const hasReacted = user ? ids.includes(user.id) : false;
              return (
                <motion.button
                  key={emoji}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reactionAppear}
                  whileTap={{ scale: 1.15 }}
                  onClick={() => onReaction?.(message.id, emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                    hasReacted
                      ? 'border-rally-blue/40 bg-rally-blue/10 text-rally-blue'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10',
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{ids.length}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Hover action bar ---- */}
      {showActions && (
        <div className="absolute -top-3 right-4 z-10 flex items-center gap-0.5 rounded border border-white/10 bg-[#0A0E27] px-1 py-0.5 shadow-elevation-3">
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
              <div className="absolute bottom-full right-0 mb-1 flex flex-col gap-0.5 rounded border border-white/10 bg-[#0A0E27] p-1 shadow-elevation-3 z-20">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReaction?.(message.id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="rounded p-1 text-base hover:bg-white/10 transition-colors"
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
              <div className="absolute top-full right-0 mt-1 w-40 rounded border border-white/10 bg-[#0A0E27] py-1 shadow-elevation-3 z-20">
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
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rally-magenta hover:bg-rally-magenta/10 transition-colors"
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
    </div>
  );
}
