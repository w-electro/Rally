import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Smile, Send, X } from 'lucide-react';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputProps {
  channelName: string;
  replyingTo?: Message | null;
  onSend: (content: string, replyToId?: string) => void;
  onCancelReply?: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 2000;
const TYPING_DEBOUNCE_MS = 2000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({
  channelName,
  replyingTo,
  onSend,
  onCancelReply,
  onTyping,
  disabled = false,
  className,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  // Focus textarea when replying to a message
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Debounced typing indicator
  const emitTyping = useCallback(() => {
    if (!onTyping) return;

    onTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [onTyping]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Send handler
  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_CHARS) return;

    onSend(trimmed, replyingTo?.id);
    setContent('');
    onCancelReply?.();

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, replyingTo, onSend, onCancelReply]);

  // Key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setContent(value);
      emitTyping();
    }
  };

  const charsRemaining = MAX_CHARS - content.length;
  const showCharCount = charsRemaining <= 200;

  return (
    <div className={cn('px-4 pb-4', className)}>
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="mb-1 flex items-center gap-2 rounded-t border border-b-0 border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-400">
          <span className="flex-1 truncate">
            {t('chat.replyingTo', { name: replyingTo.author?.displayName ?? 'Unknown' })}
          </span>
          <button
            onClick={onCancelReply}
            className="rounded p-0.5 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div
        className={cn(
          'flex items-end gap-2 rounded border bg-white/[0.03] px-3 py-2 transition-all',
          replyingTo && 'rounded-t-none',
          isFocused
            ? 'border-rally-blue/50 shadow-[0_0_12px_rgba(0,217,255,0.15)]'
            : 'border-white/10',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {/* Attachment button */}
        <button
          className="mb-0.5 shrink-0 rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
          title={t('chat.addAttachment')}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={t('chat.messagePlaceholder', { channel: channelName })}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          style={{ maxHeight: '300px' }}
        />

        {/* Right side controls */}
        <div className="mb-0.5 flex items-center gap-1 shrink-0">
          {/* Character count */}
          {showCharCount && (
            <span
              className={cn(
                'text-[10px] tabular-nums mr-1 select-none',
                charsRemaining <= 50
                  ? 'text-rally-magenta'
                  : 'text-gray-600',
              )}
            >
              {charsRemaining}
            </span>
          )}

          {/* Emoji button */}
          <button
            className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
            title={t('chat.emoji')}
          >
            <Smile className="h-5 w-5" />
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!content.trim()}
            className={cn(
              'rounded p-1 transition-colors',
              content.trim()
                ? 'text-rally-blue hover:bg-rally-blue/10'
                : 'text-gray-700 cursor-default',
            )}
            title={t('chat.sendMessage')}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
