import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Hash,
  Search,
  Pin,
  Users,
  ChevronDown,
  X,
} from 'lucide-react';
import { BubbleMessage } from '@/components/chat/BubbleMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThreadView } from '@/components/chat/ThreadView';
import { MessageListSkeleton } from '@/components/ui/Skeleton';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { channelTransition, messageAppear } from '@/lib/motion';
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
    pinMessage,
    startTyping,
    joinChannel,
    leaveChannel,
  } = useSocket();
  const {
    messages: allMessages,
    loadingChannels,
    hasMore,
    setMessages,
    prependMessages,
    setLoading,
    setHasMore,
  } = useMessageStore();

  const isLoading = loadingChannels[channel.id] ?? false;

  const { rightPanel, setRightPanel } = useUIStore();

  // Local state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [failedTempIds, setFailedTempIds] = useState<Set<string>>(new Set());
  const [focusedMsgIdx, setFocusedMsgIdx] = useState<number | null>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isInitialLoad = useRef(true);
  const [firstItemIndex, setFirstItemIndex] = useState(100000);

  const rawMessages = allMessages[channel.id] ?? [];
  // Filter by search query if active
  const channelMessages = searchQuery
    ? rawMessages.filter((m) =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.author?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rawMessages;

  // ------------------------------------------------------------------
  // Socket: join / leave channel room
  // ------------------------------------------------------------------
  useEffect(() => {
    joinChannel(channel.id);
    // Clear unread count when entering channel
    useUIStore.getState().markRead(channel.id);

    return () => {
      leaveChannel(channel.id);
    };
  }, [channel.id, joinChannel, leaveChannel]);

  // ------------------------------------------------------------------
  // Fetch messages on channel change
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const hasCached = !!allMessages[channel.id]?.length;

    const fetchMessages = async () => {
      // Only show loading spinner if we have no cached messages
      if (!hasCached) setLoading(channel.id, true);

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
          setLoading(channel.id, false);
          isInitialLoad.current = false;
        }
      }
    };

    // Reset virtualization index for new channel
    setFirstItemIndex(100000);

    // If cached messages exist, show them immediately (no flash)
    // but still re-fetch in the background for freshness
    isInitialLoad.current = !hasCached;
    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Load older messages when Virtuoso reaches the top
  // ------------------------------------------------------------------
  const handleStartReached = useCallback(() => {
    if (!hasMore[channel.id] || isLoading) return;
    const firstMsg = rawMessages[0];
    if (!firstMsg) return;

    setLoading(channel.id, true);

    api
      .getMessages(channel.id, firstMsg.id)
      .then((raw: any) => {
        const older = Array.isArray(raw) ? raw : raw?.messages ?? raw?.items ?? [];
        if (older.length === 0) {
          setHasMore(channel.id, false);
        } else {
          prependMessages(channel.id, older);
          setHasMore(channel.id, older.length >= 50);
          setFirstItemIndex((prev) => prev - older.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(channel.id, false));
  }, [channel.id, rawMessages, hasMore, isLoading, prependMessages, setHasMore, setLoading]);

  // ------------------------------------------------------------------
  // Typing indicator (incoming) -- listen via socket event at component level
  // ------------------------------------------------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

    const handleTypingStarted = (data: { channelId: string; userId: string; username: string }) => {
      if (data.channelId !== channel.id) return;
      if (data.userId === user?.id) return;
      setTypingUsers((prev) =>
        prev.includes(data.username) ? prev : [...prev, data.username],
      );
      // Auto-clear after 5s in case stopped event never fires
      if (timeouts.has(data.userId)) clearTimeout(timeouts.get(data.userId)!);
      timeouts.set(
        data.userId,
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== data.username));
          timeouts.delete(data.userId);
        }, 5000),
      );
    };

    const handleTypingStopped = (data: { channelId: string; userId: string; username?: string }) => {
      if (data.channelId !== channel.id) return;
      if (timeouts.has(data.userId)) {
        clearTimeout(timeouts.get(data.userId)!);
        timeouts.delete(data.userId);
      }
      // Remove by username if provided, otherwise clear the oldest entry
      if (data.username) {
        setTypingUsers((prev) => prev.filter((u) => u !== data.username));
      }
    };

    socket.on('typing:started', handleTypingStarted);
    socket.on('typing:stopped', handleTypingStopped);

    return () => {
      socket.off('typing:started', handleTypingStarted);
      socket.off('typing:stopped', handleTypingStopped);
      timeouts.forEach((t) => clearTimeout(t));
      setTypingUsers([]);
    };
  }, [channel.id, user?.id]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const { addMessage, deleteMessage: removeMessage } = useMessageStore();
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

        // After 15s, mark as failed if still a temp message
        setTimeout(() => {
          const msgs = useMessageStore.getState().messages[channel.id] ?? [];
          if (msgs.some((m) => m.id === tempId)) {
            setFailedTempIds((prev) => new Set(prev).add(tempId));
          }
        }, 15000);
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

  const handlePin = useCallback(
    (messageId: string) => {
      pinMessage(messageId);
    },
    [pinMessage],
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      deleteMsg(messageId);
    },
    [deleteMsg],
  );

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
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
            onClick={() => setShowSearch((p) => !p)}
            className={cn(
              'rounded p-1.5 transition-colors',
              showSearch ? 'bg-white/10 text-rally-blue' : 'text-gray-500 hover:bg-white/10 hover:text-gray-300',
            )}
            title={t('chat.searchMessages')}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowPinnedPanel((p) => !p)}
            className={cn(
              'rounded p-1.5 transition-colors',
              showPinnedPanel ? 'bg-white/10 text-rally-blue' : 'text-gray-500 hover:bg-white/10 hover:text-gray-300',
            )}
            title={t('chat.pinnedMessages')}
          >
            <Pin className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === 'members' ? 'none' : 'members')}
            className={cn(
              'rounded p-1.5 transition-colors',
              rightPanel === 'members' ? 'bg-white/10 text-rally-blue' : 'text-gray-500 hover:bg-white/10 hover:text-gray-300',
            )}
            title={t('chat.members')}
          >
            <Users className="h-4 w-4" />
          </button>
        </header>

        {/* Search bar (toggleable) */}
        {showSearch && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#0A0E27]">
            <Search className="h-4 w-4 text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder={t('chat.searchMessages')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
              autoFocus
            />
            {searchQuery && (
              <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
                {channelMessages.length} {channelMessages.length === 1 ? 'result' : 'results'}
              </span>
            )}
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pinned messages panel (toggleable) */}
        {showPinnedPanel && (
          <div className="max-h-64 overflow-y-auto border-b border-white/10 bg-[#0A0E27]/80">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-display font-semibold uppercase tracking-wider text-gray-400">
                <Pin className="inline h-3 w-3 mr-1" />
                {t('chat.pinnedMessages')}
              </span>
              <button onClick={() => setShowPinnedPanel(false)} className="text-gray-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {channelMessages.filter((m) => m.isPinned).length === 0 ? (
              <p className="px-4 pb-3 text-xs text-gray-600">{t('chat.noPinnedMessages') || 'No pinned messages yet.'}</p>
            ) : (
              channelMessages.filter((m) => m.isPinned).map((m) => (
                <div key={m.id} className="px-4 py-2 border-t border-white/5 hover:bg-white/[0.02]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-rally-blue">{m.author?.displayName}</span>
                    <span className="text-[10px] text-gray-600">{formatDate(m.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">{m.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Message list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={channel.id}
            variants={channelTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 min-h-0 outline-none"
            tabIndex={0}
            onKeyDown={(e) => {
              // Message keyboard navigation when not in an input
              const tag = (e.target as HTMLElement)?.tagName;
              if (tag === 'INPUT' || tag === 'TEXTAREA') return;
              if (channelMessages.length === 0) return;

              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedMsgIdx((prev) =>
                  prev === null ? channelMessages.length - 1 : Math.max(0, prev - 1),
                );
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedMsgIdx((prev) =>
                  prev === null ? 0 : Math.min(channelMessages.length - 1, prev + 1),
                );
              } else if (e.key === 'Escape') {
                setFocusedMsgIdx(null);
              } else if (focusedMsgIdx !== null) {
                const msg = channelMessages[focusedMsgIdx];
                if (!msg) return;
                const isOwn = msg.authorId === user?.id;
                if (e.key === 'e' && isOwn) setEditingMessage(msg);
                else if (e.key === 'r') setReplyingTo(msg);
                else if (e.key === 'p') handlePin(msg.id);
                else if (e.key === 'Delete' && isOwn) handleDelete(msg.id);
              }
            }}
          >
          {/* Loading skeleton */}
          {isLoading && channelMessages.length === 0 ? (
            <div className="h-full overflow-y-auto bg-grid scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              <MessageListSkeleton count={10} />
            </div>
          ) : channelMessages.length === 0 ? (
            /* Empty state — branded welcome */
            <div className="flex flex-col items-center justify-center h-full text-center px-4 bg-grid">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rally-cyan/10 border border-rally-cyan/20">
                <Hash className="h-10 w-10 text-rally-cyan/60" />
              </div>
              <h3 className="font-display text-xl font-bold text-white/80 mb-1">
                {t('chat.welcomeToChannel', { channel: channel.name })}
              </h3>
              <p className="text-sm text-white/60 max-w-md font-body">
                {t('chat.sendToBegin')}
              </p>
            </div>
          ) : (
            /* Virtualized message list */
            <Virtuoso
              ref={virtuosoRef}
              data={channelMessages}
              firstItemIndex={firstItemIndex}
              initialTopMostItemIndex={channelMessages.length - 1}
              followOutput="smooth"
              startReached={handleStartReached}
              atBottomStateChange={(atBottom) => setShowScrollDown(!atBottom)}
              role="log"
              aria-live="polite"
              aria-label="Messages"
              className="h-full bg-grid scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
              components={{
                Header: () =>
                  !hasMore[channel.id] ? (
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
                  ) : null,
              }}
              itemContent={(index, msg) => {
                const arrayIdx = index - firstItemIndex;
                const prev = arrayIdx > 0 ? channelMessages[arrayIdx - 1] : undefined;
                const isCompact = shouldGroup(prev, msg);
                const showDate = needsDateDivider(prev, msg);
                const isRecent = Date.now() - new Date(msg.createdAt).getTime() < 2000;
                const isFocused = focusedMsgIdx === arrayIdx;

                return (
                  <div className={isFocused ? 'ring-1 ring-rally-blue/30 rounded' : undefined}>
                    {showDate && (
                      <div className="flex items-center gap-3 px-4 py-2 select-none">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {formatDate(msg.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    )}

                    {isRecent ? (
                      <motion.div
                        variants={messageAppear}
                        initial="initial"
                        animate="animate"
                      >
                        <BubbleMessage
                          message={msg}
                          isCompact={isCompact}
                          highlightQuery={searchQuery}
                          onReply={(m) => setReplyingTo(m)}
                          onEdit={(m) => setEditingMessage(m)}
                          onDelete={handleDelete}
                          onPin={handlePin}
                          onReaction={handleReaction}
                          onRepost={(m) => {
                            sendMessage(channel.id, `> ${m.content}\n\n-- reposted from @${m.author.displayName}`);
                          }}
                          onThreadOpen={(m) => setThreadMessage(m)}
                        />
                      </motion.div>
                    ) : (
                      <BubbleMessage
                        message={msg}
                        isCompact={isCompact}
                        highlightQuery={searchQuery}
                        onReply={(m) => setReplyingTo(m)}
                        onEdit={(m) => setEditingMessage(m)}
                        onDelete={handleDelete}
                        onPin={handlePin}
                        onReaction={handleReaction}
                        onRepost={(m) => {
                          sendMessage(channel.id, `> ${m.content}\n\n-- reposted from @${m.author.displayName}`);
                        }}
                        onThreadOpen={(m) => setThreadMessage(m)}
                      />
                    )}

                    {failedTempIds.has(msg.id) && (
                      <div className="flex items-center gap-2 px-4 py-1 text-[11px] text-rally-magenta">
                        <span>{t('chat.messageFailed') || 'Failed to send'}</span>
                        <button
                          onClick={() => {
                            setFailedTempIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s; });
                            removeMessage(channel.id, msg.id);
                            sendMessage(channel.id, msg.content);
                          }}
                          className="underline hover:text-white transition-colors"
                        >
                          {t('common.retry') || 'Retry'}
                        </button>
                        <button
                          onClick={() => {
                            setFailedTempIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s; });
                            removeMessage(channel.id, msg.id);
                          }}
                          className="underline hover:text-white transition-colors"
                        >
                          {t('common.dismiss') || 'Dismiss'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
          </motion.div>
        </AnimatePresence>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollDown && (
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <button
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border border-rally-cyan/20 bg-rally-navy/90 px-3 py-1.5 text-xs text-white/70 shadow-elevation-2 backdrop-blur hover:bg-rally-navy hover:text-white transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {t('chat.newMessages')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-1 text-xs text-gray-500"
            >
              <span className="inline-flex items-center gap-1">
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-rally-blue"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
                <span className="ml-1">
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} ${t('chat.isTyping')}`
                    : typingUsers.length === 2
                      ? `${typingUsers[0]} and ${typingUsers[1]} ${t('chat.areTyping')}`
                      : `${typingUsers[0]} ${t('chat.othersTyping', { count: typingUsers.length - 1 })}`}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline edit bar */}
        {editingMessage && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-[#00D9FF]/20 bg-[#0A0E27]">
            <span className="text-xs text-gray-400 shrink-0">{t('chat.editMsg') || 'Edit'}:</span>
            <input
              type="text"
              defaultValue={editingMessage.content}
              autoFocus
              className="flex-1 bg-transparent text-sm text-white outline-none border-b border-[#00D9FF]/30 py-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val && val !== editingMessage.content) {
                    editMessage(editingMessage.id, val);
                  }
                  setEditingMessage(null);
                }
                if (e.key === 'Escape') setEditingMessage(null);
              }}
            />
            <button onClick={() => setEditingMessage(null)} className="text-gray-500 hover:text-white text-xs">
              {t('common.cancel') || 'Cancel'}
            </button>
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
