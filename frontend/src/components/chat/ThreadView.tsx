import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Reply } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { MessageItem } from '@/components/chat/MessageItem';
import { ChatInput } from '@/components/chat/ChatInput';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import type { Message } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreadViewProps {
  parentMessage: Message;
  channelName: string;
  onClose: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadView({
  parentMessage,
  channelName,
  onClose,
  className,
}: ThreadViewProps) {
  const { user } = useAuthStore();
  const { sendMessage, addReaction } = useSocket();
  const { messages: allMessages } = useMessageStore();

  const [replies, setReplies] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Derive replies from the store -- messages in the same channel that reply to parentMessage
  useEffect(() => {
    const channelMessages = allMessages[parentMessage.channelId] ?? [];
    const threadReplies = channelMessages.filter(
      (m) => m.replyToId === parentMessage.id,
    );
    setReplies(threadReplies);
  }, [allMessages, parentMessage.channelId, parentMessage.id]);

  // Auto-scroll to bottom on new replies
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  // Send a reply in the thread
  const handleSend = useCallback(
    (content: string) => {
      sendMessage(parentMessage.channelId, content, parentMessage.id);
    },
    [sendMessage, parentMessage.channelId, parentMessage.id],
  );

  // Reaction handler
  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      addReaction(messageId, emoji);
    },
    [addReaction],
  );

  return (
    <div
      className={cn(
        'flex h-full w-80 flex-col border-l border-white/10 bg-black/80 backdrop-blur-sm',
        className,
      )}
    >
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Reply className="h-4 w-4 text-rally-blue -scale-x-100" />
          <h3 className="font-display text-sm font-semibold text-white">
            Thread
          </h3>
          <span className="text-xs text-gray-500">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ---- Original message ---- */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <Avatar
            src={parentMessage.author.avatarUrl}
            name={parentMessage.author.displayName}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xs font-semibold text-rally-blue">
                {parentMessage.author.displayName}
              </span>
              <span className="text-[10px] text-gray-600">
                {formatTime(parentMessage.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-300 whitespace-pre-wrap break-words line-clamp-4">
              {parentMessage.content}
            </p>
          </div>
        </div>
      </div>

      {/* ---- Replies list ---- */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {replies.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Reply className="h-8 w-8 text-gray-700 -scale-x-100 mb-2" />
            <p className="text-xs text-gray-600">
              No replies yet. Start the conversation!
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-rally-blue border-t-transparent" />
          </div>
        )}

        <div className="py-2">
          {replies.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onReaction={handleReaction}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ---- Thread input ---- */}
      <ChatInput
        channelName={channelName}
        onSend={handleSend}
      />
    </div>
  );
}
