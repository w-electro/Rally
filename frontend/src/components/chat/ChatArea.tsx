import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Hash,
  Search,
  Pin,
  Users,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { BubbleMessage } from '@/components/chat/BubbleMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThreadView } from '@/components/chat/ThreadView';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import type { Message, Channel } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatAreaProps {
  channel: Channel;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine whether two messages should be visually grouped (compact). */
function shouldGroup(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false;
  if (prev.authorId !== curr.authorId) return false;
  if (prev.type !== 'DEFAULT' || curr.type !== 'DEFAULT') return false;
  // More than 5 min gap -> break
  const gap =
    new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  if (gap > 5 * 60 * 1000) return false;
  return true;
}

/** Should a date divider appear between two messages? */
function needsDateDivider(
  prev: Message | undefined,
  curr: Message,
): boolean {
  if (!prev) return true;
  const d1 = new Date(prev.createdAt).toDateString();
  const d2 = new Date(curr.createdAt).toDateString();
  return d1 !== d2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatArea({ channel, className }: ChatAreaProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    sendMessage,
    editMessage,
    deleteMessage: deleteMsg,
    addReaction,
    startTyping,
    joinChannel,
    leaveChannel,
  } = useSocket();
  const {
    messages: allMessages,
    isLoading,
    hasMore,
    setMessages,
    prependMessages,
    setLoading,
    setHasMore,
  } = useMessageStore();

  // Local state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevChannelId = useRef<string | null>(null);

  const channelMessages = allMessages[channel.id] ?? [];

  // ------------------------------------------------------------------
  // Socket: join / leave channel room
  // ------------------------------------------------------------------
  useEffect(() => {
    joinChannel(channel.id);

    return () => {
      leaveChannel(channel.id);
    };
  }, [channel.id, joinChannel, leaveChannel]);

  // ------------------------------------------------------------------
  // Fetch messages on channel change
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      // Avoid re-fetching if we already have messages for this channel
      if (allMessages[channel.id]?.length) {
        isInitialLoad.current = false;
        return;
      }

      setLoading(true);
      try {
        const data: any = await api.getMessages(channel.id);
        if (cancelled) return;
        const msgs = Array.isArray(data) ? data : data?.messages ?? data?.items ?? [];
        setMessages(channel.id, msgs);
        setHasMore(channel.id, msgs.length >= 50);
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          isInitialLoad.current = false;
        }
      }
    };

    isInitialLoad.current = true;
    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Auto-scroll on new messages (only if already near bottom)
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isInitialLoad.current) {
      // Always scroll to bottom on first load
      bottomRef.current?.scrollIntoView();
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setShowScrollDown(true);
    }
  }, [channelMessages.length]);

  // ------------------------------------------------------------------
  // Load more (scroll to top)
  // ------------------------------------------------------------------
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Track "scroll down" visibility
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 300);

    // Load more when scrolled to top
    if (scrollTop < 60 && hasMore[channel.id] && !isLoading) {
      const firstMsg = channelMessages[0];
      if (!firstMsg) return;

      const prevScrollHeight = container.scrollHeight;
      setLoading(true);

      api
        .getMessages(channel.id, firstMsg.id)
        .then((raw: any) => {
          const older = Array.isArray(raw) ? raw : raw?.messages ?? raw?.items ?? [];
          if (older.length === 0) {
            setHasMore(channel.id, false);
          } else {
            prependMessages(channel.id, older);
            setHasMore(channel.id, older.length >= 50);

            // Maintain scroll position after prepend
            requestAnimationFrame(() => {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - prevScrollHeight;
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [channel.id, channelMessages, hasMore, isLoading, prependMessages, setHasMore, setLoading]);

  // ------------------------------------------------------------------
  // Typing indicator (incoming) -- listen via socket event at component level
  // ------------------------------------------------------------------
  useEffect(() => {
    // Placeholder: in a real implementation we'd listen to the socket
    // for 'typing:update' events and update `typingUsers`.
    // For now this stays empty.
  }, [channel.id]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const { addMessage } = useMessageStore();
  const handleSend = useCallback(
    (content: string, replyToId?: string, attachments?: any[]) => {
      // Optimistic: add message to store immediately
      if (user) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        addMessage(channel.id, {
          id: tempId,
          channelId: channel.id,
          authorId: user.id,
          content,
          replyToId: replyToId ?? null,
          attachments: attachments ?? [],
          reactions: {},
          createdAt: new Date().toISOString(),
          isEdited: false,
          author: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
        } as any);
      }
      sendMessage(channel.id, content, replyToId, attachments);
    },
    [sendMessage, channel.id, user, addMessage],
  );

  const handleTyping = useCallback(() => {
    startTyping(channel.id);
  }, [startTyping, channel.id]);

  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      addReaction(messageId, emoji);
    },
    [addReaction],
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      deleteMsg(messageId);
    },
    [deleteMsg],
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className={cn('flex h-full flex-1', className)}>
      {/* ---- Main chat column ---- */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Channel header */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <Hash className="h-5 w-5 text-gray-500" />
          <h2 className="font-display text-sm font-semibold text-white truncate">
            {channel.name}
          </h2>
          {channel.topic && (
            <>
              <span className="h-4 w-px bg-white/10" />
              <span className="text-xs text-gray-500 truncate">
                {channel.topic}
              </span>
            </>
          )}
          <div className="flex-1" />

          {/* Right header icons */}
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
            title={t('chat.searchMessages')}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
            title={t('chat.pinnedMessages')}
          >
            <Pin className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
            title={t('chat.members')}
          >
            <Users className="h-4 w-4" />
          </button>
        </header>

        {/* Message list */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-grid scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
        >
          {/* Loading spinner (top) */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-rally-blue" />
            </div>
          )}

          {/* Beginning of channel indicator */}
          {!isLoading && !hasMore[channel.id] && channelMessages.length > 0 && (
            <div className="px-4 pb-4 pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Hash className="h-8 w-8 text-rally-blue" />
                <h3 className="font-display text-xl font-bold text-white">
                  {channel.name}
                </h3>
              </div>
              <p className="text-sm text-gray-500">
                {t('chat.beginningOfChannel', { channel: channel.name })}
              </p>
              <div className="mt-4 h-px bg-white/10" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && channelMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Hash className="h-12 w-12 text-gray-700 mb-3" />
              <h3 className="font-display text-lg font-semibold text-gray-400 mb-1">
                {t('chat.welcomeToChannel', { channel: channel.name })}
              </h3>
              <p className="text-sm text-gray-600 max-w-md">
                {t('chat.sendToBegin')}
              </p>
            </div>
          )}

          {/* Messages */}
          {channelMessages.map((msg, idx) => {
            const prev = channelMessages[idx - 1];
            const isCompact = shouldGroup(prev, msg);
            const showDate = needsDateDivider(prev, msg);

            return (
              <React.Fragment key={msg.id}>
                {/* Date divider */}
                {showDate && (
                  <div className="flex items-center gap-3 px-4 py-2 select-none">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {formatDate(msg.createdAt)}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}

                <BubbleMessage
                  message={msg}
                  isCompact={isCompact}
                  onReply={(m) => setReplyingTo(m)}
                  onEdit={(m) => {
                    // Simple inline edit: prompt for simplicity; a full modal editor
                    // can be built separately.
                    const newContent = window.prompt(t('chat.editMessage'), m.content);
                    if (newContent && newContent !== m.content) {
                      editMessage(m.id, newContent);
                    }
                  }}
                  onDelete={handleDelete}
                  onReaction={handleReaction}
                  onRepost={(m) => {
                    // Repost: send the content as a quoted message
                    sendMessage(channel.id, `> ${m.content}\n\n-- reposted from @${m.author.displayName}`);
                  }}
                  onThreadOpen={(m) => setThreadMessage(m)}
                />
              </React.Fragment>
            );
          })}

          <div ref={bottomRef} className="h-1" />
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollDown && (
          <div className="relative">
            <button
              onClick={scrollToBottom}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-white/10 bg-rally-navy/90 px-3 py-1.5 text-xs text-gray-300 shadow-lg backdrop-blur hover:bg-rally-navy transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              {t('chat.newMessages')}
            </button>
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rally-blue [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rally-blue [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rally-blue [animation-delay:300ms]" />
              </span>
              <span className="ml-1">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} ${t('chat.isTyping')}`
                  : typingUsers.length === 2
                    ? `${typingUsers[0]} and ${typingUsers[1]} ${t('chat.areTyping')}`
                    : `${typingUsers[0]} ${t('chat.othersTyping', { count: typingUsers.length - 1 })}`}
              </span>
            </span>
          </div>
        )}

        {/* Message input */}
        <ChatInput
          channelName={channel.name}
          replyingTo={replyingTo}
          onSend={handleSend}
          onCancelReply={() => setReplyingTo(null)}
          onTyping={handleTyping}
        />
      </div>

      {/* ---- Thread panel (right side) ---- */}
      {threadMessage && (
        <ThreadView
          parentMessage={threadMessage}
          channelName={channel.name}
          onClose={() => setThreadMessage(null)}
        />
      )}
    </div>
  );
}
