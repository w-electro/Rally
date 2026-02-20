import { useState, useEffect } from 'react';
import {
  Search,
  Users,
  X,
  PenSquare,
  MessageCircle,
  Inbox,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { cn, getInitials, getStatusColor, formatDate } from '@/lib/utils';
import type { DmConversation } from '@/lib/types';

export function DmSidebar() {
  const user = useAuthStore((s) => s.user);
  const activeConversationId = useUIStore((s) => s.activeDmConversationId);
  const setActiveDmConversation = useUIStore((s) => s.setActiveDmConversation);
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    api.getDmConversations()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.conversations ?? [];
        setConversations(list);
      })
      .catch(() => {});
  }, []);

  // Backend returns members as user objects directly (not wrapped in { user: ... })
  const getMember = (m: any) => (m?.user ? m.user : m);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (conv.name && conv.name.toLowerCase().includes(query)) return true;
    return conv.members.some((m: any) => {
      const member = getMember(m);
      return (
        member.id !== user?.id &&
        (member.displayName?.toLowerCase().includes(query) ||
          member.username?.toLowerCase().includes(query))
      );
    });
  });

  const getConversationName = (conv: DmConversation): string => {
    if (conv.name) return conv.name;
    const otherMembers = conv.members
      .filter((m: any) => getMember(m).id !== user?.id)
      .map((m: any) => getMember(m).displayName);
    return otherMembers.join(', ') || 'Unknown';
  };

  const getConversationAvatar = (conv: DmConversation) => {
    if (conv.isGroup) return null;
    const other = conv.members.find((m: any) => getMember(m).id !== user?.id);
    return other ? getMember(other) : null;
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ONLINE': return 'Online';
      case 'IDLE': return 'Idle';
      case 'DND': return 'Do Not Disturb';
      case 'IN_GAME': return 'In Game';
      case 'STREAMING': return 'Streaming';
      default: return 'Offline';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0D1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
          Messages
        </h2>
        <button
          className="p-1.5 rounded-md text-white/40 hover:text-rally-blue hover:bg-rally-blue/10 transition-colors"
          title="New Message"
        >
          <PenSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg bg-[#080B18] border transition-colors',
            isSearchFocused
              ? 'border-rally-blue/30 shadow-[0_0_8px_rgba(0,217,255,0.1)]'
              : 'border-white/5'
          )}
        >
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none font-body"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Friends Button */}
      <div className="px-2 py-1">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <Users className="w-5 h-5" />
          <span className="text-sm font-body font-medium">Friends</span>
        </button>
      </div>

      {/* Section Header */}
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-display font-semibold uppercase tracking-wider text-white/30">
          Direct Messages
        </span>
        <span className="text-[10px] text-white/20 font-body">
          {filteredConversations.length}
        </span>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 px-2 space-y-0.5 pb-2">
        {/* Empty State */}
        {filteredConversations.length === 0 && (
          <div className="text-center py-12 px-4">
            {searchQuery ? (
              <>
                <Search className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-body">No conversations found</p>
                <p className="text-white/15 text-xs mt-1 font-body">
                  Try a different search term
                </p>
              </>
            ) : (
              <>
                <Inbox className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-body font-medium">
                  No conversations yet
                </p>
                <p className="text-white/15 text-xs mt-1.5 font-body leading-relaxed">
                  Start a conversation by clicking the pen icon above
                  or messaging someone from a server.
                </p>
              </>
            )}
          </div>
        )}

        {filteredConversations.map((conv) => {
          const name = getConversationName(conv);
          const avatarUser = getConversationAvatar(conv);
          const isActive = activeConversationId === conv.id;
          const lastMsg = conv.lastMessage;
          const isOnline = avatarUser?.status && avatarUser.status !== 'OFFLINE';
          // Simulate unread: if there's a lastMessage and it's not from the current user
          const hasUnread = lastMsg && lastMsg.senderId !== user?.id && !lastMsg.isRead;

          return (
            <button
              key={conv.id}
              onClick={() => {
                setActiveDmConversation(conv.id);
                socket?.emit('dm:join', conv.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative',
                isActive
                  ? 'bg-rally-blue/10 text-white border border-rally-blue/20'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent',
                hasUnread && !isActive && 'bg-white/[0.02]'
              )}
            >
              {/* Unread indicator bar */}
              {hasUnread && !isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-rally-blue" />
              )}

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={cn(
                  'w-10 h-10 rounded-full overflow-hidden flex items-center justify-center',
                  isActive ? 'ring-2 ring-rally-blue/30' : ''
                )}
                style={{
                  backgroundColor: '#1A1F36',
                }}
                >
                  {avatarUser?.avatarUrl ? (
                    <img
                      src={avatarUser.avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/60">
                      {conv.isGroup ? (
                        <Users className="w-5 h-5 text-white/30" />
                      ) : (
                        getInitials(name)
                      )}
                    </div>
                  )}
                </div>
                {/* Online status dot */}
                {avatarUser && (
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 rounded-full border-[2.5px] border-[#0D1117]',
                      isOnline ? 'w-3.5 h-3.5' : 'w-3 h-3'
                    )}
                    style={{
                      backgroundColor: getStatusColor(avatarUser.status),
                    }}
                    title={getStatusLabel(avatarUser.status)}
                  />
                )}
              </div>

              {/* Name and last message */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm truncate',
                    hasUnread ? 'font-semibold text-white' : 'font-medium',
                    isActive && 'text-white'
                  )}>
                    {name}
                  </span>
                  {lastMsg && (
                    <span className={cn(
                      'text-[10px] shrink-0',
                      hasUnread ? 'text-rally-blue' : 'text-white/20'
                    )}>
                      {formatDate(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg ? (
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    hasUnread ? 'text-white/50' : 'text-white/25'
                  )}>
                    {lastMsg.senderId === user?.id && (
                      <span className="text-white/15">You: </span>
                    )}
                    {lastMsg.content}
                  </p>
                ) : (
                  <p className="text-xs text-white/15 mt-0.5 italic">
                    No messages yet
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {hasUnread && !isActive && (
                <div className="shrink-0 w-2 h-2 rounded-full bg-rally-blue" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
