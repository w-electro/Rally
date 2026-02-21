import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2, ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ChatInput } from '@/components/chat/ChatInput';
import { useAuthStore } from '@/stores/authStore';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { cn, formatTime, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import type { DirectMessage, DmConversation } from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DmChatViewProps {
  conversationId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine whether two DMs should be visually grouped (compact). */
function shouldGroup(prev: DirectMessage | undefined, curr: DirectMessage): boolean {
  if (!prev) return false;
  if (prev.senderId !== curr.senderId) return false;
  const gap =
    new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  if (gap > 5 * 60 * 1000) return false;
  return true;
}

/** Should a date divider appear between two messages? */
function needsDateDivider(
  prev: DirectMessage | undefined,
  curr: DirectMessage,
): boolean {
  if (!prev) return true;
  const d1 = new Date(prev.createdAt).toDateString();
  const d2 = new Date(curr.createdAt).toDateString();
  return d1 !== d2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DmChatView({ conversationId }: DmChatViewProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { sendDm } = useSocket();

  // Local state
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversation, setConversation] = useState<DmConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // ---------------------------------------------------------------------------
  // Derive partner info
  // ---------------------------------------------------------------------------

  const getMember = (m: any) => (m?.user ? m.user : m);

  const partnerName = (() => {
    if (!conversation || !user) return t('dm.directMessage');
    if (conversation.name) return conversation.name;
    const otherMembers = conversation.members
      .filter((m: any) => getMember(m).id !== user.id)
      .map((m: any) => getMember(m).displayName);
    return otherMembers.join(', ') || 'Unknown';
  })();

  const partnerAvatarUrl = (() => {
    if (!conversation || !user || conversation.isGroup) return undefined;
    const other = conversation.members.find((m: any) => getMember(m).id !== user.id);
    return other ? getMember(other).avatarUrl : undefined;
  })();

  // Derive the receiverId from conversation members or from the most recent message
  const receiverId = (() => {
    // Prefer deriving from conversation members
    if (conversation && user) {
      const other = conversation.members.find((m: any) => getMember(m).id !== user.id);
      if (other) return getMember(other).id;
    }
    // Fallback: derive from the most recent message
    if (messages.length > 0 && user) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== user.id) return lastMsg.senderId;
      return lastMsg.receiverId;
    }
    return null;
  })();

  // ---------------------------------------------------------------------------
  // Fetch conversation metadata + messages on mount / conversationId change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      isInitialLoad.current = true;

      try {
        // Fetch conversation list to find this conversation's metadata
        const convos: any = await api.getDmConversations();
        const list = Array.isArray(convos) ? convos : convos?.conversations ?? [];
        const matched = list.find((c: any) => c.id === conversationId) ?? null;
        if (!cancelled) setConversation(matched);

        // Fetch message history
        const msgData: any = await api.getDmMessages(conversationId);
        if (!cancelled) {
          const msgs = Array.isArray(msgData) ? msgData : msgData?.messages ?? [];
          setMessages(msgs);
        }
      } catch (err) {
        console.error('Failed to load DM data', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          isInitialLoad.current = false;
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // ---------------------------------------------------------------------------
  // Socket: listen for dm:new, emit dm:leave on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewDm = (dm: DirectMessage) => {
      if (dm.conversationId === conversationId) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === dm.id)) return prev;
          return [...prev, dm];
        });
      }
    };

    socket.on('dm:new', handleNewDm);

    return () => {
      socket.off('dm:new', handleNewDm);
      socket.emit('dm:leave', conversationId);
    };
  }, [conversationId]);

  // ---------------------------------------------------------------------------
  // Auto-scroll on new messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isInitialLoad.current) {
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
  }, [messages.length]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    (content: string) => {
      if (!receiverId) return;

      // Optimistic: add message immediately to local state
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const optimisticMsg: DirectMessage = {
        id: tempId,
        conversationId,
        senderId: user?.id ?? '',
        receiverId,
        content,
        isEncrypted: false,
        createdAt: new Date().toISOString(),
        sender: user ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        } : undefined,
      } as DirectMessage;
      setMessages((prev) => [...prev, optimisticMsg]);

      sendDm(conversationId, receiverId, content);
    },
    [sendDm, conversationId, receiverId, user],
  );

  const handleTyping = useCallback(() => {
    // Placeholder for typing indicator on DMs
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 300);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-1 flex-col bg-[#0D1117]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <MessageCircle className="h-5 w-5 text-rally-blue" />
        <h2 className="font-display text-sm font-semibold text-white truncate">
          {partnerName}
        </h2>
      </header>

      {/* Message list */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
      >
        {/* Loading spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-rally-blue" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle className="h-12 w-12 text-gray-700 mb-3" />
            <h3 className="font-display text-lg font-semibold text-gray-400 mb-1">
              {t('dm.startConversation')}
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              {t('dm.beginningOfDm', { name: partnerName })}
            </p>
          </div>
        )}

        {/* Beginning of conversation indicator */}
        {!isLoading && messages.length > 0 && (
          <div className="px-4 pb-4 pt-6">
            <div className="flex items-center gap-3 mb-1">
              <Avatar
                src={partnerAvatarUrl}
                name={partnerName}
                size="lg"
              />
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  {partnerName}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('dm.beginningOfDmGeneric')}
                </p>
              </div>
            </div>
            <div className="mt-4 h-px bg-white/10" />
          </div>
        )}

        {/* Messages */}
        {messages.map((dm, idx) => {
          const prev = messages[idx - 1];
          const isCompact = shouldGroup(prev, dm);
          const showDate = needsDateDivider(prev, dm);
          const isOwn = dm.senderId === user?.id;
          const sender = dm.sender ?? {
            id: dm.senderId,
            username: 'unknown',
            displayName: 'Unknown',
            avatarUrl: undefined,
          };

          return (
            <div key={dm.id}>
              {/* Date divider */}
              {showDate && (
                <div className="flex items-center gap-3 px-4 py-2 select-none">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {formatDate(dm.createdAt)}
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}

              {/* Message row */}
              <div
                className={cn(
                  'group relative flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] transition-colors',
                  isCompact ? 'items-baseline' : 'items-start pt-1',
                  isOwn && 'bg-rally-blue/[0.03]',
                )}
              >
                {/* Avatar / timestamp gutter */}
                {isCompact ? (
                  <span className="w-9 shrink-0 text-right text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity select-none leading-5">
                    {formatTime(dm.createdAt)}
                  </span>
                ) : (
                  <div className="shrink-0 pt-0.5">
                    <Avatar
                      src={sender.avatarUrl}
                      name={sender.displayName}
                      size="sm"
                    />
                  </div>
                )}

                {/* Body */}
                <div className="min-w-0 flex-1">
                  {/* Header (full mode only) */}
                  {!isCompact && (
                    <div className="flex items-baseline gap-2 leading-5">
                      <span
                        className={cn(
                          'font-display font-semibold text-sm cursor-pointer hover:underline',
                          isOwn ? 'text-rally-green' : 'text-rally-blue',
                        )}
                      >
                        {sender.displayName}
                      </span>
                      <span className="text-[10px] text-gray-600 select-none">
                        {formatTime(dm.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-[1.375rem]">
                    {isCompact && (
                      <span
                        className={cn(
                          'font-display font-semibold mr-1 cursor-pointer hover:underline text-xs',
                          isOwn ? 'text-rally-green' : 'text-rally-blue',
                        )}
                      >
                        {sender.displayName}
                      </span>
                    )}
                    {dm.content}
                  </div>

                  {/* Encrypted badge */}
                  {dm.isEncrypted && (
                    <span className="mt-0.5 inline-block text-[10px] text-gray-600 italic select-none">
                      {t('dm.encrypted')}
                    </span>
                  )}
                </div>
              </div>
            </div>
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

      {/* Message input */}
      <ChatInput
        channelName={partnerName}
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={!receiverId}
      />
    </div>
  );
}
