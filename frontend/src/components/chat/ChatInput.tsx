import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Smile, Send, X, Paperclip, Image as ImageIcon, Loader2 } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/toastStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputProps {
  channelName: string;
  replyingTo?: Message | null;
  onSend: (content: string, replyToId?: string, attachments?: Attachment[]) => void;
  onCancelReply?: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  className?: string;
}

export interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 2000;
const TYPING_DEBOUNCE_MS = 2000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// ---------------------------------------------------------------------------
// Upload helper
// ---------------------------------------------------------------------------

async function uploadFile(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('accessToken');
  const serverUrl = localStorage.getItem('rally-server-url')
    || import.meta.env.VITE_API_URL
    || '';
  const base = serverUrl ? `${serverUrl.replace(/\/$/, '')}/api` : '/api';

  const res = await fetch(`${base}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await res.json();
  return {
    url: data.url,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

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

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Debounced typing indicator — only emit on leading edge
  const emitTyping = useCallback(() => {
    if (!onTyping) return;
    // Only fire if no recent typing event (leading-edge throttle)
    if (typingTimeoutRef.current) return;

    onTyping();
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [onTyping]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  // Send handler
  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if ((!trimmed && pendingAttachments.length === 0) || (trimmed && trimmed.length > MAX_CHARS)) return;

    const attachments = pendingAttachments.length > 0 ? pendingAttachments : undefined;
    onSend(trimmed || ' ', replyingTo?.id, attachments);
    setContent('');
    setPendingAttachments([]);
    onCancelReply?.();

    // Clear typing indicator immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, replyingTo, onSend, onCancelReply, pendingAttachments]);

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

  // Emoji handler
  const handleEmojiSelect = useCallback((emoji: any) => {
    const native = emoji.native;
    if (!native) return;

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + native + content.substring(end);
      if (newContent.length <= MAX_CHARS) {
        setContent(newContent);
        // Set cursor position after emoji
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + native.length;
          textarea.focus();
        });
      }
    } else {
      setContent((prev) => prev + native);
    }
    setShowEmojiPicker(false);
  }, [content]);

  // File handler
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        useToastStore.getState().addToast('error', `${file.name} exceeds 25MB limit`);
        continue;
      }
      try {
        const attachment = await uploadFile(file);
        newAttachments.push(attachment);
      } catch (err) {
        useToastStore.getState().addToast('error', `Failed to upload ${file.name}`);
      }
    }

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-2 rounded-t border border-b-0 border-white/10 bg-white/[0.03] p-2">
          {pendingAttachments.map((att, i) => (
            <div key={i} className="relative group flex items-center gap-2 rounded bg-white/5 border border-white/10 px-2 py-1.5">
              {att.type.startsWith('image/') ? (
                <ImageIcon className="h-4 w-4 text-rally-blue shrink-0" />
              ) : (
                <Paperclip className="h-4 w-4 text-rally-green shrink-0" />
              )}
              <span className="text-xs text-white/60 max-w-[120px] truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-white/30 hover:text-rally-magenta transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        className={cn(
          'flex items-end gap-2 rounded border bg-white/[0.03] px-3 py-2 transition-all',
          replyingTo && pendingAttachments.length === 0 && 'rounded-t-none',
          pendingAttachments.length > 0 && 'rounded-t-none',
          isFocused
            ? 'border-rally-blue/50 shadow-[0_0_12px_rgba(0,217,255,0.15)]'
            : 'border-white/10',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-0.5 shrink-0 rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
          title={t('chat.addAttachment')}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
        />

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

          {/* Emoji button + picker */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={cn(
                'rounded p-1 transition-colors',
                showEmojiPicker
                  ? 'text-rally-blue bg-rally-blue/10'
                  : 'text-gray-500 hover:bg-white/10 hover:text-gray-300',
              )}
              title={t('chat.emoji')}
            >
              <Smile className="h-5 w-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="dark"
                  set="native"
                  previewPosition="none"
                  skinTonePosition="none"
                  maxFrequentRows={2}
                  perLine={8}
                />
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!content.trim() && pendingAttachments.length === 0}
            className={cn(
              'rounded p-1 transition-colors',
              content.trim() || pendingAttachments.length > 0
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
