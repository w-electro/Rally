import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Hash, Plus, SmilePlus, Send } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/hooks/useSocket';
import { cn, formatDate } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import type { Message } from '@/lib/types';

export default function ChatArea() {
  const { activeChannelId, getActiveChannel, getActiveServer } = useServerStore();
  const { getMessages, setMessages, setLoading, isLoading } = useMessageStore();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const channel = getActiveChannel();
  const server = getActiveServer();
  const messages = activeChannelId ? getMessages(activeChannelId) : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Join channel room on socket when channel changes
  useEffect(() => {
    if (!activeChannelId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('channel:join', { channelId: activeChannelId });
    return () => {
      socket.emit('channel:leave', { channelId: activeChannelId });
    };
  }, [activeChannelId]);

  const handleSend = (e?: FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || !activeChannelId || sending) return;

    const socket = getSocket();
    if (!socket) return;

    setSending(true);
    socket.emit(
      'message:send',
      { channelId: activeChannelId, content: content.trim() },
      (res: { success: boolean; error?: string }) => {
        setSending(false);
        if (res.success) {
          setContent('');
          inputRef.current?.focus();
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group consecutive messages by the same author
  const groupedMessages = groupMessages(messages);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-rally-darkBg/50">
        <div className="text-center">
          <Hash size={48} className="mx-auto text-rally-dimmed mb-3" />
          <p className="text-rally-muted text-lg">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-rally-darkBg/50 min-w-0">
      {/* Channel header */}
      <div className="h-12 flex items-center px-4 border-b border-primary gap-2 flex-shrink-0">
        <Hash size={20} className="text-rally-dimmed flex-shrink-0" />
        <span className="font-semibold text-white">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="w-px h-5 bg-primary mx-2" />
            <span className="text-sm text-rally-dimmed truncate">{channel.topic}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Welcome message */}
        {messages.length === 0 && !isLoading && (
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-rally-cardBg flex items-center justify-center mb-4">
              <Hash size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Welcome to #{channel.name}!
            </h2>
            <p className="text-rally-muted">
              This is the start of the #{channel.name} channel
              {server ? ` in ${server.name}` : ''}.
            </p>
          </div>
        )}

        {groupedMessages.map((group, gi) => (
          <div key={gi} className="mb-4">
            {group.map((msg, mi) => {
              const isFirst = mi === 0;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'message-hover flex gap-4 px-2 py-0.5 rounded group',
                    isFirst && 'mt-3'
                  )}
                >
                  {isFirst ? (
                    <Avatar
                      user={msg.author}
                      size="sm"
                      className="mt-0.5 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {isFirst && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span
                          className="font-medium text-white hover:underline cursor-pointer text-sm"
                        >
                          {msg.author?.username || 'Unknown'}
                        </span>
                        <span className="text-[11px] text-rally-dimmed">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <p className="text-rally-muted text-sm leading-relaxed break-words">
                      {msg.content}
                      {msg.editedAt && (
                        <span className="text-[10px] text-rally-dimmed ml-1">(edited)</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="px-4 pb-6 flex-shrink-0">
        <form
          onSubmit={handleSend}
          className="bg-rally-darkerBg border border-primary rounded-lg flex items-end"
        >
          <button
            type="button"
            className="p-3 text-rally-dimmed hover:text-rally-muted transition-colors flex-shrink-0"
          >
            <Plus size={20} />
          </button>
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name}`}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-rally-dimmed py-3 resize-none outline-none text-sm max-h-48"
            style={{ minHeight: '24px' }}
          />
          <div className="flex items-center gap-1 p-2 flex-shrink-0">
            <button
              type="button"
              className="p-1.5 text-rally-dimmed hover:text-rally-muted transition-colors rounded"
            >
              <SmilePlus size={20} />
            </button>
            {content.trim() && (
              <button
                type="submit"
                disabled={sending}
                className="p-1.5 text-rally-cyan hover:text-white transition-colors rounded"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function groupMessages(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  let current: Message[] = [];

  for (const msg of messages) {
    const last = current[current.length - 1];
    const sameAuthor = last && last.author?.id === msg.author?.id;
    const withinTime =
      last &&
      new Date(msg.createdAt).getTime() - new Date(last.createdAt).getTime() <
        5 * 60 * 1000;

    if (sameAuthor && withinTime) {
      current.push(msg);
    } else {
      if (current.length > 0) groups.push(current);
      current = [msg];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
